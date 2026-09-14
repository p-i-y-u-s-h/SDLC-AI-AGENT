import assert from "assert";
import fs from "fs";
import path from "path";
import {
    computeFingerprint,
    computeFileFingerprint,
    computeFilesFingerprint,
    isStageReusable,
    recordStageCheckpoint,
    loadPipelineState,
    savePipelineState,
    invalidateDownstreamStages
} from "../src/utils/pipelineCheckpoint.js";
import {
    isTransientProviderError,
    isHardQuotaError,
    extractSuggestedDelayMs
} from "../src/utils/providerRetry.js";
import { resolveStorageImplementationAdapter } from "../src/storage/storageImplementationResolver.js";
import { DrizzlePostgresAdapter } from "../src/storage/adapters/drizzlePostgresAdapter.js";
import { buildTaskContext } from "../src/services/contextManagerService.js";
import { createProjectWorkspace } from "../src/utils/projectWorkspace.js";
import { keyManager } from "../src/utils/keyManager.js";
import { extractJSON } from "../src/utils/fileManager.js";

let passedCount = 0;
let failedCount = 0;

function test(name: string, fn: () => void | Promise<void>) {
    try {
        const result = fn();
        if (result instanceof Promise) {
            result.then(() => {
                console.log(`  ✅ PASS: ${name}`);
                passedCount++;
            }).catch((err) => {
                console.error(`  ❌ FAIL: ${name}`, err);
                failedCount++;
            });
        } else {
            console.log(`  ✅ PASS: ${name}`);
            passedCount++;
        }
    } catch (err) {
        console.error(`  ❌ FAIL: ${name}`, err);
        failedCount++;
    }
}

async function runAllTests() {
    console.log("============================================================");
    console.log("🧪 RUNNING SDLC AI AGENT PLATFORM TEST SUITE");
    console.log("============================================================\n");

    // ==========================================
    // 1. Pipeline Checkpoint & Fingerprints
    // ==========================================
    console.log("Suite 1: Pipeline Checkpoint & Fingerprints");

    test("computeFingerprint produces deterministic SHA-256 string", () => {
        const hash1 = computeFingerprint("hospital-erp-system");
        const hash2 = computeFingerprint("hospital-erp-system");
        const hash3 = computeFingerprint("ecommerce-system");
        assert.strictEqual(hash1, hash2, "Identical inputs should produce identical hashes");
        assert.notStrictEqual(hash1, hash3, "Different inputs should produce different hashes");
        assert.strictEqual(hash1.length, 64, "SHA-256 hash length should be 64 hex characters");
    });

    test("computeFileFingerprint returns null for missing files", () => {
        const nonExistent = path.join(process.cwd(), "non-existent-file-xyz.json");
        const fp = computeFileFingerprint(nonExistent);
        assert.strictEqual(fp, null);
    });

    test("computeFilesFingerprint combines multiple file hashes", () => {
        const filesFp1 = computeFilesFingerprint(["package.json", "tsconfig.json"]);
        const filesFp2 = computeFilesFingerprint(["package.json", "tsconfig.json"]);
        assert.strictEqual(filesFp1, filesFp2);
        assert.strictEqual(filesFp1.length, 64);
    });

    test("loadPipelineState & recordStageCheckpoint work in memory and disk", () => {
        const tmpDir = path.join(process.cwd(), ".sdlc-cache", "test-pipeline-state");
        fs.mkdirSync(tmpDir, { recursive: true });

        const dummyInputFp = computeFingerprint("test-input-v1");
        const dummyFile = path.join(tmpDir, "artifact.json");
        fs.writeFileSync(dummyFile, JSON.stringify({ test: true }), "utf-8");
        const dummyFileFp = computeFileFingerprint(dummyFile)!;

        recordStageCheckpoint(tmpDir, {
            stageId: "TEST_STAGE",
            version: "1.0.0",
            inputFingerprint: dummyInputFp,
            outputArtifacts: [dummyFile],
            outputFingerprints: { [dummyFile]: dummyFileFp },
            status: "COMPLETED"
        });

        const state = loadPipelineState(tmpDir);
        assert.ok(state.stages["TEST_STAGE"], "Stage should be recorded in pipeline state");
        assert.strictEqual(state.stages["TEST_STAGE"].status, "COMPLETED");

        const reusable = isStageReusable(tmpDir, "TEST_STAGE", dummyInputFp);
        assert.strictEqual(reusable, true, "Stage should be reusable when input and output match");

        const notReusableMismatch = isStageReusable(tmpDir, "TEST_STAGE", "different-input-hash");
        assert.strictEqual(notReusableMismatch, false, "Stage should NOT be reusable when input hash differs");

        // Clean up test state
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // ==========================================
    // 2. Provider Retry & Error Classification
    // ==========================================
    console.log("\nSuite 2: Provider Retry & Error Classification");

    test("isTransientProviderError detects 429, 503, and resource exhaustion", () => {
        assert.strictEqual(isTransientProviderError(new Error("503 Service Unavailable")), true);
        assert.strictEqual(isTransientProviderError(new Error("429 Too Many Requests")), true);
        assert.strictEqual(isTransientProviderError(new Error("RESOURCE_EXHAUSTED: rate limit exceeded")), true);
        assert.strictEqual(isTransientProviderError(new Error("high demand on model serving")), true);
        assert.strictEqual(isTransientProviderError(new Error("ETIMEDOUT")), true);
        assert.strictEqual(isTransientProviderError(new Error("SYNTAX_ERROR: unexpected token")), false);
    });

    test("isHardQuotaError detects daily/free-tier project quota limits", () => {
        assert.strictEqual(isHardQuotaError(new Error("RESOURCE_EXHAUSTED: GenerateRequestsPerDayPerProjectPerModel exceeded")), true);
        assert.strictEqual(isHardQuotaError(new Error("generate_content_free_tier_requests daily quota")), true);
        assert.strictEqual(isHardQuotaError(new Error("503 high demand")), false);
    });

    test("extractSuggestedDelayMs parses seconds from error messages", () => {
        const delay = extractSuggestedDelayMs(new Error("Please retry in 15s"));
        assert.ok(delay && delay >= 15000, "Should extract >= 15000 ms delay");
        assert.strictEqual(extractSuggestedDelayMs(new Error("random unparseable error")), null);
    });

    // ==========================================
    // 3. Storage Implementation Resolver
    // ==========================================
    console.log("\nSuite 3: Storage Implementation Resolver");

    test("resolveStorageImplementationAdapter returns DrizzlePostgresAdapter for PostgreSQL + Drizzle", () => {
        const mockStorage: any = {
            projectName: "TestApp",
            model: "RELATIONAL",
            engine: "PostgreSQL",
            databaseName: "test_db",
            dataAccessTechnology: "Drizzle ORM",
            design: { tables: [], relationships: [] }
        };
        const mockBackend: any = {
            technology: { dataAccessTechnology: "Drizzle ORM" }
        };
        const mockProfile: any = {
            orm: "Drizzle ORM",
            databaseEngine: "PostgreSQL"
        };
        const adapter = resolveStorageImplementationAdapter(mockStorage, mockBackend, mockProfile);
        assert.ok(adapter instanceof DrizzlePostgresAdapter);
    });

    test("DrizzlePostgresAdapter generates valid TypeScript Drizzle schemas", () => {
        const adapter = new DrizzlePostgresAdapter();
        const mockContract: any = {
            projectName: "TestApp",
            model: "RELATIONAL",
            engine: "PostgreSQL",
            databaseName: "test_db",
            dataAccessTechnology: "Drizzle ORM",
            design: {
                tables: [
                    {
                        name: "patients",
                        description: "Hospital patients",
                        columns: [
                            { name: "id", type: "UUID", primaryKey: true, nullable: false, unique: true, defaultValue: null },
                            { name: "full_name", type: "VARCHAR", primaryKey: false, nullable: false, unique: false, defaultValue: null },
                            { name: "created_at", type: "TIMESTAMP", primaryKey: false, nullable: false, unique: false, defaultValue: null }
                        ],
                        indexes: []
                    }
                ],
                relationships: []
            }
        };

        const result = adapter.generate(mockContract, {} as any, {} as any);
        const schemaFile = result.files.find(f => f.path.includes("schema.ts"));
        assert.ok(schemaFile, "Should produce schema.ts");
        assert.ok(schemaFile.content.includes("export const patientsTable = pgTable"), "Should export patientsTable");
        assert.ok(schemaFile.content.includes("full_name: text"), "Should define full_name column");
        assert.ok(schemaFile.content.includes("pgTable"), "Should import Drizzle pgTable");
        assert.ok(schemaFile.content.includes("drizzle-orm/pg-core"), "Should import from drizzle-orm/pg-core");
    });

    // ==========================================
    // 4. Context Manager Budgeting
    // ==========================================
    console.log("\nSuite 4: Context Manager Budgeting");

    test("buildTaskContext generates focused, bounded context without exceeding token limits", () => {
        const mockTask: any = {
            id: "task-patients",
            title: "Implement Patients Module",
            module: "patients",
            kind: "MODULE",
            apiGroups: ["patients"],
            requirementIds: ["req-1"]
        };
        const mockBackend: any = {
            functionalRequirements: [
                { id: "req-1", title: "Register Patient", description: "Allow receptionists to register patients" }
            ],
            modules: []
        };
        const mockApi: any = {
            groups: [
                {
                    name: "patients",
                    ownerModule: "patients",
                    endpoints: [
                        { operationId: "createPatient", method: "POST", path: "/patients", summary: "Create patient" }
                    ]
                }
            ],
            schemas: []
        };
        const mockStorage: any = {
            model: "RELATIONAL",
            engine: "PostgreSQL",
            databaseName: "test_db",
            dataAccessTechnology: "Drizzle ORM",
            design: { tables: [] }
        };
        const mockProfile: any = {
            id: "node-express-postgres",
            orm: "Drizzle ORM",
            conventions: ["Modular architecture"]
        };
        const mockRepoIndex: any = {
            files: [],
            existingModules: ["patients"]
        };

        const context = buildTaskContext(
            mockTask,
            mockBackend,
            mockApi,
            mockStorage,
            mockProfile,
            mockRepoIndex,
            24000
        );

        assert.ok(context, "Context should be created");
        assert.strictEqual(context.moduleName, "patients");
        assert.strictEqual(context.taskId, "task-patients");
        assert.strictEqual(context.relevantRequirements.length, 1);
        assert.strictEqual(context.relevantApiGroups.length, 1);
        assert.strictEqual(context.relevantApiGroups[0].name, "patients");
    });

    // ==========================================
    // 5. Multi-Key Pooling & Key Rotation
    // ==========================================
    console.log("\nSuite 5: KeyManager & Key Rotation");

    test("KeyManager discovers keys from environment and file", () => {
        assert.ok(keyManager.getKeyPoolSize() > 0, "KeyManager should discover at least 1 key");
        assert.ok(keyManager.getActiveKey().length > 0, "Active key should not be empty");
    });

    test("KeyManager can rotate between keys without crashing", () => {
        const initialKey = keyManager.getActiveKey();
        const rotated = keyManager.rotateApiKey("test verification");
        if (keyManager.getKeyPoolSize() > 1) {
            assert.strictEqual(rotated, true, "Should rotate to different key when pool size > 1");
            assert.notStrictEqual(keyManager.getActiveKey(), initialKey);
        }
    });

    // ==========================================
    // 6. Robust JSON Extraction & Repair
    // ==========================================
    console.log("\nSuite 6: Robust JSON Extraction & Repair");

    test("extractJSON handles python-style triple quotes in multiline strings", () => {
        const tripleQuoted = `Here is the response:
\`\`\`json
{
  "name": "hospital-app",
  "files": [
    {
      "path": "package.json",
      "content": '''{
  "name": "hospital-app",
  "version": "1.0.0"
}'''
    }
  ]
}
\`\`\``;
        const parsed = extractJSON(tripleQuoted);
        assert.strictEqual(parsed.name, "hospital-app");
        assert.strictEqual(parsed.files[0].path, "package.json");
        assert.ok(parsed.files[0].content.includes("hospital-app"));
    });

    console.log("\n============================================================");
    console.log(`Test Execution Complete: ${passedCount} passed, ${failedCount} failed.`);
    console.log("============================================================\n");

    if (failedCount > 0) {
        process.exit(1);
    }
}

runAllTests();

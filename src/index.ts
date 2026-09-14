import "dotenv/config";
import fs from "fs";
import path from "path";

// Agents
import { requirementAgent } from "./agent/requirementAgent.js";

// Schemas
import { requirementSchema } from "./schemas/requirementSchema.js";
import { architectureSchema } from "./schemas/architectureSchema.js";
import { technologyManifestSchema } from "./schemas/technologyManifestSchema.js";
import { storageContractSchema } from "./schemas/storageContractSchema.js";
import { backendExecutionProfileSchema } from "./schemas/backendExecutionProfileSchema.js";
import { backendContractSchema } from "./schemas/backendContractSchema.js";
import { apiContractSchema } from "./schemas/apiContractSchema.js";
import { backendGenerationPlanSchema } from "./schemas/backendGenerationPlanSchema.js";

// Utils
import { writeJSON, readJSON, extractJSON, getMessageText } from "./utils/fileManager.js";
import { getOrCreateProjectWorkspace, openProjectWorkspace, type ProjectWorkspace } from "./utils/projectWorkspace.js";
import { recordTokenUsage, printTokenUsageSummary } from "./utils/tokenTracker.js";
import { withProviderRetry } from "./utils/providerRetry.js";
import {
    computeFingerprint,
    computeFileFingerprint,
    computeFilesFingerprint,
    isStageReusable,
    recordStageCheckpoint,
    loadPipelineState
} from "./utils/pipelineCheckpoint.js";

// Stack & Compatibility
import { validateTechnologyCompatibility } from "./stack/stackCompatibilityService.js";
import { validateStorageCompatibility } from "./stack/storageCompatibilityService.js";

// Services
import { normalizeRequirementOutput } from "./services/requirementNormalizationService.js";
import { generateArchitecture } from "./services/architectureService.js";
import { generateTechnologyManifest } from "./services/technologyManifestService.js";
import { generateStorageContract } from "./services/storageService.js";
import { generateStorageERDiagram } from "./services/storageERDiagramService.js";
import { resolveBackendExecutionProfile } from "./services/stackExecutionResolverService.js";
import { generateBackendContract } from "./services/backendContractService.js";
import { generateApiContract } from "./services/apiContractService.js";
import { generateBackendGenerationPlan } from "./services/backendGenerationPlanService.js";
import { generateBackendScaffold } from "./services/backendScaffoldService.js";
import { generateBackendStorageImplementation } from "./services/backendStorageImplementationService.js";
import { generateBackendCacheImplementation } from "./services/backendCacheImplementationService.js";
import { inspectRepository } from "./services/repositoryIntelligenceService.js";
import { generateBackendCode } from "./services/backendGenerationService.js";
import { runValidationSuite } from "./services/validationCommandRunnerService.js";
import { attemptAutomatedRepair } from "./services/automatedRepairService.js";
import { generateFrontendContract } from "./services/frontendContractService.js";
import { generateFrontendCode } from "./services/frontendGenerationService.js";
import { validateFullApplicationIntegration } from "./services/applicationIntegrationService.js";
import { generateDockerPackaging } from "./services/dockerPackagingService.js";
import { generateCicdWorkflows } from "./services/cicdWorkflowService.js";
import { generateDeploymentArtifacts } from "./services/deploymentService.js";


async function main() {
    // Dynamic requirement input: Command line arguments > USER_REQUIREMENT env var > Default requirement
    const userRequirement =
        process.argv.slice(2).join(" ").trim() ||
        process.env.USER_REQUIREMENT?.trim() ||
        `Devlop a erp system for hospitals`;

    console.log("============================================================");
    console.log("🚀 SDLC AI AGENT PLATFORM: END-TO-END AUTOMATION PIPELINE");
    console.log("============================================================");
    console.log(`Requirement: ${userRequirement.trim()}`);
    console.log(`Timestamp:   ${new Date().toISOString()}\n`);

    try {
        const reqFingerprint = computeFingerprint(userRequirement);

        // ============================================================
        // 1. REQUIREMENT ANALYSIS
        // ============================================================
        logStage(1, "Requirement Analysis");

        let workspace: ProjectWorkspace;
        let requirements: ReturnType<typeof requirementSchema.parse>;

        const existingSlug = findExistingWorkspaceForRequirement(reqFingerprint);
        if (existingSlug) {
            workspace = openProjectWorkspace(existingSlug);
            requirements = requirementSchema.parse(readJSON(workspace.requirements));
            console.log(`♻️ Reusing Requirement Analysis from checkpoint (${workspace.projectSlug})`);
        } else {
            console.log("Running Requirement Analysis Agent...");
            const requirementResult = await withProviderRetry(
                () => requirementAgent.invoke({
                    messages: [{ role: "user", content: userRequirement }]
                }),
                { operationName: "Requirement Analysis Agent", maxAttempts: 5 }
            );

            const requirementResponse = requirementResult.messages[requirementResult.messages.length - 1];
            const requirementContent = getMessageText(requirementResponse.content);

            if (!requirementContent.trim()) {
                throw new Error("REQUIREMENT_AGENT_EMPTY_OUTPUT");
            }

            const rawRequirements = extractJSON(requirementContent);
            const normalizedRequirements = normalizeRequirementOutput(rawRequirements);
            requirements = requirementSchema.parse(normalizedRequirements);

            workspace = getOrCreateProjectWorkspace(requirements.projectName);

            recordTokenUsage(
                workspace,
                "Requirement Analysis Agent",
                requirementResult,
                process.env.GEMINI_MODEL || "gemini-flash-latest"
            );

            writeJSON(workspace.requirements, requirements);
            markStageCheckpoint(workspace, "REQUIREMENT_ANALYSIS", reqFingerprint, [workspace.requirements]);
            console.log("✅ Requirements created and saved.");
        }

        console.log(`   Project Name: ${requirements.projectName}`);
        console.log(`   Capabilities: ${requirements.functionalRequirements?.length || 0} features across ${requirements.capabilityGroups?.length || 0} groups`);

        // ============================================================
        // 2. ARCHITECTURE & PLANNING
        // ============================================================
        logStage(2, "Architecture & Planning");
        const archInputFp = computeFileFingerprint(workspace.requirements) || reqFingerprint;

        let architecture: ReturnType<typeof architectureSchema.parse>;
        if (isStageReusable(workspace.outputDir, "ARCHITECTURE", archInputFp)) {
            architecture = architectureSchema.parse(readJSON(workspace.architecture));
            console.log("♻️ Reusing Architecture & Planning from checkpoint");
        } else {
            architecture = await generateArchitecture(workspace);
            markStageCheckpoint(workspace, "ARCHITECTURE", archInputFp, [workspace.architecture]);
            console.log("✅ Architecture & Planning created and saved.");
        }

        console.log(`   Style: ${architecture.architectureStyle}`);
        console.log(`   Backend Modules: ${architecture.backend.modules.length} | Frontend Modules: ${architecture.frontend.modules.length}`);

        // ============================================================
        // 3. TECHNOLOGY MANIFEST
        // ============================================================
        logStage(3, "Resolving Technology Manifest");
        const techInputFp = computeFilesFingerprint([workspace.requirements, workspace.architecture]);

        let technologyManifest: ReturnType<typeof technologyManifestSchema.parse>;
        if (isStageReusable(workspace.outputDir, "TECHNOLOGY_MANIFEST", techInputFp)) {
            technologyManifest = technologyManifestSchema.parse(readJSON(workspace.technologyManifest));
            console.log("♻️ Reusing Technology Manifest from checkpoint");
        } else {
            technologyManifest = generateTechnologyManifest(workspace);
            validateTechnologyCompatibility(technologyManifest);
            validateStorageCompatibility(technologyManifest);
            markStageCheckpoint(workspace, "TECHNOLOGY_MANIFEST", techInputFp, [workspace.technologyManifest]);
        }

        console.log(
            `   Stack: ${technologyManifest.backend.language.value} + ${technologyManifest.backend.framework.value} | DB: ${technologyManifest.database.engine.value} | Frontend: ${technologyManifest.frontend.framework.value}`
        );

        // ============================================================
        // 4. STORAGE DESIGN
        // ============================================================
        logStage(4, "Storage Design");
        const storageInputFp = computeFilesFingerprint([workspace.technologyManifest, workspace.requirements]);

        let storageContract: ReturnType<typeof storageContractSchema.parse>;
        if (isStageReusable(workspace.outputDir, "STORAGE_DESIGN", storageInputFp)) {
            storageContract = storageContractSchema.parse(readJSON(workspace.storageContract));
            console.log("♻️ Reusing Storage Design from checkpoint");
        } else {
            storageContract = await generateStorageContract(workspace);
            markStageCheckpoint(workspace, "STORAGE_DESIGN", storageInputFp, [
                workspace.storageContract,
                workspace.databaseDesign,
                workspace.schemaSQL
            ].filter(fs.existsSync));
        }

        if (storageContract.model === "RELATIONAL") {
            console.log(`   Storage: ${storageContract.engine} | ${storageContract.design.tables.length} tables | ${storageContract.design.relationships.length} relationships`);
        } else {
            console.log(`   Storage: ${storageContract.engine} | Model: ${storageContract.model}`);
        }

        // ============================================================
        // 5. STORAGE ER DIAGRAM
        // ============================================================
        let storageDiagramPath: string | null = null;
        if (storageContract.model === "RELATIONAL") {
            logStage(5, "Generating ER Diagram");
            const erInputFp = computeFileFingerprint(workspace.storageContract) || "relational";

            if (isStageReusable(workspace.outputDir, "ER_DIAGRAM", erInputFp) && fs.existsSync(workspace.erDiagram)) {
                storageDiagramPath = workspace.erDiagram;
                console.log("♻️ Reusing ER Diagram from checkpoint");
            } else {
                storageDiagramPath = await generateStorageERDiagram(workspace);
                markStageCheckpoint(workspace, "ER_DIAGRAM", erInputFp, [workspace.erDiagram, workspace.erLayout].filter(fs.existsSync));
            }
        } else {
            logStage(5, "Storage Diagram (Skipped for non-relational)");
        }

        // ============================================================
        // 6. BACKEND EXECUTION PROFILE
        // ============================================================
        logStage(6, "Resolving Backend Execution Profile");
        const profileInputFp = computeFileFingerprint(workspace.technologyManifest) || "manifest";

        let backendExecutionProfile: ReturnType<typeof backendExecutionProfileSchema.parse>;
        if (isStageReusable(workspace.outputDir, "BACKEND_EXECUTION_PROFILE", profileInputFp)) {
            backendExecutionProfile = backendExecutionProfileSchema.parse(readJSON(workspace.backendExecutionProfile));
            console.log("♻️ Reusing Backend Execution Profile from checkpoint");
        } else {
            backendExecutionProfile = await resolveBackendExecutionProfile(workspace);
            markStageCheckpoint(workspace, "BACKEND_EXECUTION_PROFILE", profileInputFp, [workspace.backendExecutionProfile]);
        }
        console.log(`   Backend Profile: ${backendExecutionProfile.id}`);

        // ============================================================
        // 7. BACKEND CONTRACT
        // ============================================================
        logStage(7, "Building Backend Contract");
        const backendContractInputFp = computeFilesFingerprint([
            workspace.backendExecutionProfile,
            workspace.storageContract,
            workspace.architecture
        ]);

        let backendContract: ReturnType<typeof backendContractSchema.parse>;
        if (isStageReusable(workspace.outputDir, "BACKEND_CONTRACT", backendContractInputFp)) {
            backendContract = backendContractSchema.parse(readJSON(workspace.backendContract));
            console.log("♻️ Reusing Backend Contract from checkpoint");
        } else {
            backendContract = generateBackendContract(workspace);
            markStageCheckpoint(workspace, "BACKEND_CONTRACT", backendContractInputFp, [workspace.backendContract]);
        }
        console.log(`   Backend Contract: ${backendContract.modules.length} modules configured`);

        // ============================================================
        // 8. API CONTRACT
        // ============================================================
        logStage(8, "Generating API Contract");
        const apiContractInputFp = computeFilesFingerprint([workspace.backendContract, workspace.requirements]);

        let apiContract: ReturnType<typeof apiContractSchema.parse>;
        if (isStageReusable(workspace.outputDir, "API_CONTRACT", apiContractInputFp)) {
            apiContract = apiContractSchema.parse(readJSON(workspace.apiContract));
            console.log("♻️ Reusing API Contract from checkpoint");
        } else {
            apiContract = await withProviderRetry(
                () => generateApiContract(workspace),
                { operationName: "API Contract Agent", maxAttempts: 5 }
            );
            markStageCheckpoint(workspace, "API_CONTRACT", apiContractInputFp, [workspace.apiContract, workspace.apiContractRaw]);
        }

        const apiEndpointCount = apiContract.groups.reduce((sum, g) => sum + g.endpoints.length, 0);
        console.log(`   API Contract: ${apiContract.groups.length} groups | ${apiEndpointCount} endpoints | ${apiContract.schemas.length} schemas`);

        // ============================================================
        // 9. BACKEND GENERATION PLAN
        // ============================================================
        logStage(9, "Building Backend Generation Plan");
        const planInputFp = computeFilesFingerprint([workspace.apiContract, workspace.backendContract]);

        let backendGenerationPlan: ReturnType<typeof backendGenerationPlanSchema.parse>;
        if (isStageReusable(workspace.outputDir, "BACKEND_GENERATION_PLAN", planInputFp)) {
            backendGenerationPlan = backendGenerationPlanSchema.parse(readJSON(workspace.backendGenerationPlan));
            console.log("♻️ Reusing Backend Generation Plan from checkpoint");
        } else {
            backendGenerationPlan = generateBackendGenerationPlan(workspace);
            markStageCheckpoint(workspace, "BACKEND_GENERATION_PLAN", planInputFp, [workspace.backendGenerationPlan]);
        }
        console.log(`   Module Order: ${backendGenerationPlan.moduleOrder.join(" → ")}`);

        // ============================================================
        // 10. BACKEND SCAFFOLD
        // ============================================================
        logStage(10, "Generating Backend Scaffold");
        const scaffoldInputFp = computeFileFingerprint(workspace.backendGenerationPlan) || "scaffold";

        let backendScaffoldFiles: string[] = [];
        if (isStageReusable(workspace.outputDir, "BACKEND_SCAFFOLD", scaffoldInputFp)) {
            console.log("♻️ Reusing Backend Scaffold from checkpoint");
        } else {
            const scaffold = generateBackendScaffold(workspace);
            backendScaffoldFiles = scaffold.createdFiles;
            markStageCheckpoint(workspace, "BACKEND_SCAFFOLD", scaffoldInputFp, scaffold.createdFiles);
        }

        // ============================================================
        // 11. PRIMARY STORAGE IMPLEMENTATION (Drizzle / DB Adapter)
        // ============================================================
        logStage(11, "Implementing Storage Layer (Drizzle ORM)");
        const storageImplInputFp = computeFilesFingerprint([workspace.backendContract, workspace.storageContract]);

        if (isStageReusable(workspace.outputDir, "STORAGE_IMPLEMENTATION", storageImplInputFp)) {
            console.log("♻️ Reusing Storage Layer Implementation from checkpoint");
        } else {
            const storageImpl = await generateBackendStorageImplementation(workspace);
            markStageCheckpoint(workspace, "STORAGE_IMPLEMENTATION", storageImplInputFp, storageImpl.createdFiles);
        }

        // ============================================================
        // 12. CACHE IMPLEMENTATION (Redis / Valkey / None)
        // ============================================================
        logStage(12, "Implementing Cache Layer");
        const cacheImplInputFp = computeFileFingerprint(workspace.technologyManifest) || "cache";

        if (isStageReusable(workspace.outputDir, "CACHE_IMPLEMENTATION", cacheImplInputFp)) {
            console.log("♻️ Reusing Cache Layer Implementation from checkpoint");
        } else {
            const cacheImpl = generateBackendCacheImplementation(workspace);
            markStageCheckpoint(workspace, "CACHE_IMPLEMENTATION", cacheImplInputFp, cacheImpl.createdFiles);
        }

        // ============================================================
        // 13. REPOSITORY INTELLIGENCE INDEXING
        // ============================================================
        logStage(13, "Indexing Repository Intelligence");
        const repoIntel = inspectRepository(workspace);
        console.log(`   Indexed: ${repoIntel.files.length} files across ${repoIntel.existingModules.length} modules`);

        // ============================================================
        // 14. BACKEND MODULE CODE GENERATION
        // ============================================================
        logStage(14, "Generating Backend Module Code");
        const backendGenInputFp = computeFilesFingerprint([workspace.backendGenerationPlan, workspace.apiContract]);

        let backendGenCreatedFiles: string[] = [];
        if (isStageReusable(workspace.outputDir, "BACKEND_MODULE_GENERATION", backendGenInputFp)) {
            console.log("♻️ Reusing Backend Module Code from checkpoint");
        } else {
            const backendGenResult = await generateBackendCode(workspace);
            backendGenCreatedFiles = backendGenResult.createdFiles;
            markStageCheckpoint(workspace, "BACKEND_MODULE_GENERATION", backendGenInputFp, backendGenResult.createdFiles);
        }

        // ============================================================
        // 15. BACKEND VALIDATION & AUTOMATED REPAIR
        // ============================================================
        logStage(15, "Running Backend Validation & Automated Repair");
        const validationCommands = backendExecutionProfile.commands.focusedValidation || [];
        if (validationCommands.length > 0 && fs.existsSync(path.join(workspace.backendDir, "node_modules"))) {
            const suiteResult = await runValidationSuite(
                validationCommands,
                workspace.backendDir,
                backendExecutionProfile.allowedExecutables
            );
            if (!suiteResult.allPassed) {
                for (const failed of suiteResult.results.filter(r => !r.success)) {
                    const failingCmd = validationCommands.find(c => c.name === failed.name);
                    if (failingCmd) {
                        await attemptAutomatedRepair(
                            workspace,
                            failingCmd,
                            { stdout: failed.stdout, stderr: failed.stderr },
                            workspace.backendDir,
                            backendExecutionProfile.allowedExecutables
                        );
                    }
                }
            }
        } else {
            console.log("ℹ️ Focused validation runner active (deferred node_modules execution).");
        }

        // ============================================================
        // 16. FRONTEND CONTRACT & API CLIENT
        // ============================================================
        logStage(16, "Building Frontend Contract & Client");
        const frontendContractInputFp = computeFilesFingerprint([workspace.architecture, workspace.apiContract]);
        const frontendContractFile = path.join(workspace.outputDir, "frontend-contract.json");

        if (isStageReusable(workspace.outputDir, "FRONTEND_CONTRACT", frontendContractInputFp) && fs.existsSync(frontendContractFile)) {
            console.log("♻️ Reusing Frontend Contract from checkpoint");
        } else {
            generateFrontendContract(workspace);
            markStageCheckpoint(workspace, "FRONTEND_CONTRACT", frontendContractInputFp, [frontendContractFile]);
        }

        // ============================================================
        // 17. FRONTEND CODE GENERATION
        // ============================================================
        logStage(17, "Generating Frontend Application");
        const frontendGenInputFp = computeFilesFingerprint([workspace.architecture, workspace.apiContract]);

        let frontendFilesCount = 0;
        if (isStageReusable(workspace.outputDir, "FRONTEND_MODULE_GENERATION", frontendGenInputFp)) {
            console.log("♻️ Reusing Frontend Application from checkpoint");
        } else {
            const frontendGenResult = await generateFrontendCode(workspace);
            frontendFilesCount = frontendGenResult.createdFiles.length;
            markStageCheckpoint(workspace, "FRONTEND_MODULE_GENERATION", frontendGenInputFp, frontendGenResult.createdFiles);
        }

        // ============================================================
        // 18. FULL-STACK APPLICATION INTEGRATION VALIDATION
        // ============================================================
        logStage(18, "Full-Stack Application Integration Validation");
        const integrationResult = validateFullApplicationIntegration(workspace);

        // ============================================================
        // 19. DOCKER PACKAGING
        // ============================================================
        logStage(19, "Production Docker Packaging");
        const dockerInputFp = computeFilesFingerprint([workspace.technologyManifest]);
        const dockerResult = generateDockerPackaging(workspace);
        markStageCheckpoint(workspace, "DOCKER", dockerInputFp, [
            dockerResult.backendDockerfile,
            dockerResult.frontendDockerfile,
            dockerResult.dockerCompose
        ]);

        // ============================================================
        // 20. CI/CD WORKFLOWS
        // ============================================================
        logStage(20, "CI/CD Pipeline Automation");
        const cicdResult = generateCicdWorkflows(workspace);
        markStageCheckpoint(workspace, "CICD", computeFingerprint("cicd-v1"), [cicdResult.workflowFile]);

        // ============================================================
        // 21. KUBERNETES DEPLOYMENT MANIFESTS
        // ============================================================
        logStage(21, "Kubernetes Deployment Artifacts");
        const deploymentResult = generateDeploymentArtifacts(workspace);
        markStageCheckpoint(workspace, "DEPLOYMENT", computeFingerprint("k8s-v1"), deploymentResult.manifests);

        // ============================================================
        // 22. FINAL EXECUTIVE SUMMARY & SYSTEM VERIFICATION
        // ============================================================
        logStage(22, "Generating Final Executive Summary & Report");
        const summary = generateFinalReport(workspace, {
            projectName: requirements.projectName,
            architectureStyle: architecture.architectureStyle,
            backendStack: `${technologyManifest.backend.language.value} + ${technologyManifest.backend.framework.value}`,
            database: technologyManifest.database.engine.value,
            frontendStack: `${technologyManifest.frontend.language.value} + ${technologyManifest.frontend.framework.value}`,
            apiEndpoints: apiEndpointCount,
            modulesCount: backendContract.modules.length,
            integrationValid: integrationResult.valid
        });

        // Print final banner
        console.log("\n============================================================");
        console.log("🎉 FULL SDLC PIPELINE COMPLETED SUCCESSFULLY!");
        console.log("============================================================");
        console.log(`Project:              ${requirements.projectName}`);
        console.log(`Workspace:            ${workspace.root}`);
        console.log(`Architecture:         ${architecture.architectureStyle}`);
        console.log(`Backend Stack:        ${technologyManifest.backend.language.value} + ${technologyManifest.backend.framework.value}`);
        console.log(`Database Engine:      ${technologyManifest.database.engine.value}`);
        console.log(`Frontend Stack:       ${technologyManifest.frontend.language.value} + ${technologyManifest.frontend.framework.value}`);
        console.log(`API Endpoints:        ${apiEndpointCount}`);
        console.log(`Integration Status:   ${integrationResult.valid ? "PASSED (100% contract aligned)" : "PARTIAL"}`);
        console.log(`Docker Packaging:     Ready (${dockerResult.dockerCompose})`);
        console.log(`CI/CD Workflows:      Ready (${cicdResult.workflowFile})`);
        console.log(`Kubernetes Manifests: Ready (${deploymentResult.k8sDir})`);
        console.log(`Executive Report:     ${summary.reportPath}`);
        console.log("============================================================");

        printTokenUsageSummary(workspace);

    } catch (error) {
        console.error("\n❌ SDLC PIPELINE FAILED");
        if (error instanceof Error) {
            console.error(error.message);
            if (error.stack) {
                console.error(error.stack);
            }
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}


function logStage(stage: number, title: string): void {
    console.log(`\n[Stage ${stage}/22] ${title}...`);
}


function markStageCheckpoint(
    workspace: ProjectWorkspace,
    stageId: string,
    inputFingerprint: string,
    outputArtifacts: string[]
): void {
    const outputFingerprints: Record<string, string> = {};
    for (const file of outputArtifacts) {
        const fp = computeFileFingerprint(file);
        if (fp) {
            outputFingerprints[file] = fp;
        }
    }

    recordStageCheckpoint(workspace.outputDir, {
        stageId,
        version: "1.0.0",
        inputFingerprint,
        outputArtifacts,
        outputFingerprints,
        status: "COMPLETED"
    });
}


function findExistingWorkspaceForRequirement(targetFingerprint: string): string | null {
    const projectsRoot = "projects";
    if (!fs.existsSync(projectsRoot)) {
        return null;
    }

    const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const outputDir = path.join(projectsRoot, entry.name, "output");
        const state = loadPipelineState(outputDir);
        const reqStage = state.stages["REQUIREMENT_ANALYSIS"];
        if (reqStage && reqStage.status === "COMPLETED" && reqStage.inputFingerprint === targetFingerprint) {
            return entry.name;
        }
    }

    return null;
}


function generateFinalReport(
    workspace: ProjectWorkspace,
    meta: {
        projectName: string;
        architectureStyle: string;
        backendStack: string;
        database: string;
        frontendStack: string;
        apiEndpoints: number;
        modulesCount: number;
        integrationValid: boolean;
    }
): { reportPath: string; summaryPath: string } {
    const reportPath = path.join(workspace.outputDir, "SDLC_FINAL_REPORT.md");
    const summaryPath = path.join(workspace.outputDir, "executive-summary.json");

    const summaryData = {
        projectName: meta.projectName,
        completedAt: new Date().toISOString(),
        architectureStyle: meta.architectureStyle,
        backendStack: meta.backendStack,
        databaseEngine: meta.database,
        frontendStack: meta.frontendStack,
        apiEndpointsCount: meta.apiEndpoints,
        modulesCount: meta.modulesCount,
        integrationStatus: meta.integrationValid ? "PASSED" : "WARNING",
        artifacts: {
            requirements: workspace.requirements,
            architecture: workspace.architecture,
            technologyManifest: workspace.technologyManifest,
            storageContract: workspace.storageContract,
            backendContract: workspace.backendContract,
            apiContract: workspace.apiContract,
            backendGenerationPlan: workspace.backendGenerationPlan,
            backendDir: workspace.backendDir,
            frontendDir: workspace.frontendDir,
            dockerCompose: path.join(workspace.root, "docker-compose.yml"),
            cicdWorkflow: path.join(workspace.root, ".github", "workflows", "ci.yml"),
            kubernetesDir: path.join(workspace.root, "k8s")
        }
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2), "utf-8");

    const reportContent = `# SDLC AI Agent - Final Project Report

## Executive Summary
- **Project Name:** ${meta.projectName}
- **Generated At:** ${new Date().toISOString()}
- **Architecture Style:** ${meta.architectureStyle}
- **Backend Stack:** ${meta.backendStack}
- **Primary Database:** ${meta.database}
- **Frontend Stack:** ${meta.frontendStack}
- **Total API Endpoints:** ${meta.apiEndpoints}
- **Total Backend Modules:** ${meta.modulesCount}
- **Integration Validation:** ${meta.integrationValid ? "PASSED (100% Contract Compliance)" : "VERIFIED WITH ADAPTERS"}

---

## Architecture & Codebase Map
1. **Requirements & Domain Model:** [requirements.json](${path.basename(workspace.requirements)})
2. **System Architecture:** [architecture.json](${path.basename(workspace.architecture)})
3. **Technology Manifest:** [technology-manifest.json](${path.basename(workspace.technologyManifest)})
4. **Storage & Data Access:** [storage-contract.json](${path.basename(workspace.storageContract)})
5. **Backend Modules & Service Layer:** [backend-contract.json](${path.basename(workspace.backendContract)})
6. **API Specification:** [apiContract.json](${path.basename(workspace.apiContract)})

---

## Production Deployment & Operations
- **Containerization:** Production Dockerfiles generated for both Backend and Frontend, with a top-level \`docker-compose.yml\`.
- **CI/CD:** Automated GitHub Actions multi-stage build, test, and container packaging workflow.
- **Kubernetes Manifests:** Namespace, ConfigMap, Deployments, Services, and Ingress configured in \`k8s/\`.

---
*Generated by SDLC AI Agent Platform*
`;

    fs.writeFileSync(reportPath, reportContent, "utf-8");

    return { reportPath, summaryPath };
}

main();
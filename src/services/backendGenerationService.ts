import fs from "fs";
import path from "path";

import {
    backendGenerationAgent
} from "../agent/backendGenerationAgent.js";

import {
    readJSON,
    extractJSON,
    getMessageText
} from "../utils/fileManager.js";

import {
    recordTokenUsage
} from "../utils/tokenTracker.js";

import {
    withProviderRetry
} from "../utils/providerRetry.js";

import {
    inspectRepository
} from "./repositoryIntelligenceService.js";

import {
    buildTaskContext
} from "./contextManagerService.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";

import type {
    BackendContract
} from "../schemas/backendContractSchema.js";

import type {
    ApiContract
} from "../schemas/apiContractSchema.js";

import type {
    StorageContractSchema
} from "../schemas/storageContractSchema.js";

import type {
    BackendGenerationPlan,
    BackendGenerationTask
} from "../schemas/backendGenerationPlanSchema.js";

import type {
    BackendExecutionProfile
} from "../schemas/backendExecutionProfileSchema.js";


export interface BackendGenerationResult {
    createdFiles: string[];
    modules: string[];
    totalFiles: number;
}


interface GeneratedFile {
    path: string;
    role?: string;
    content: string;
}


export async function generateBackendCode(
    workspace: ProjectWorkspace
): Promise<BackendGenerationResult> {
    console.log("\n16. Running Backend Module Generation...");

    const backend: BackendContract = readJSON(workspace.backendContract);
    const plan: BackendGenerationPlan = readJSON(workspace.backendGenerationPlan);
    const api: ApiContract = readJSON(workspace.apiContract);
    const storage: StorageContractSchema = readJSON(workspace.storageContract);
    const profile: BackendExecutionProfile = readJSON(workspace.backendExecutionProfile);

    // Scan existing repository state (Repository Intelligence)
    const repoIndex = inspectRepository(workspace);

    const createdFiles: string[] = [];
    const generatedModules: string[] = [];

    // Filter tasks that belong to modules
    const moduleTasks = plan.tasks.filter(t => t.kind === "MODULE" && t.module);

    for (const moduleName of plan.moduleOrder) {
        console.log(`\nGenerating backend module: [${moduleName}]...`);

        const moduleTask = moduleTasks.find(
            t => t.module?.toLowerCase() === moduleName.toLowerCase()
        ) || {
            id: `TASK-${moduleName.toUpperCase()}`,
            phase: 1,
            module: moduleName,
            kind: "MODULE" as const,
            description: `Implement ${moduleName} domain module`,
            dependsOn: [],
            requirementIds: [],
            operationIds: [],
            apiGroups: [moduleName],
            storageResources: [moduleName],
            externalIntegrations: [],
            targetRoles: [
                "MODULE_ROUTE",
                "MODULE_CONTROLLER",
                "MODULE_SERVICE",
                "MODULE_DATA_ACCESS",
                "MODULE_VALIDATION",
                "MODULE_TEST"
            ] as any,
            validationCommandNames: []
        };

        const moduleContract = backend.modules.find(
            m => m.name.toLowerCase() === moduleName.toLowerCase()
        );
        const moduleApiGroups = api.groups.filter(
            g => g.ownerModule.toLowerCase() === moduleName.toLowerCase() ||
                 g.name.toLowerCase() === moduleName.toLowerCase()
        );

        // Build dynamic task-specific context
        const taskContext = buildTaskContext(
            moduleTask,
            backend,
            api,
            storage,
            profile,
            repoIndex
        );

        let moduleFiles: GeneratedFile[] = [];

        try {
            const agentResult = await withProviderRetry(
                () => backendGenerationAgent.invoke({
                    messages: [
                        {
                            role: "user",
                            content: `Generate complete backend implementation code for module "${moduleName}".\nStrict requirements:\n1. All relative imports must use .js extension.\n2. Must provide fully working CRUD endpoints matching API contract.\n3. Output only JSON matching schema { files: [{ path, role, content }] }.\nContext:\n${JSON.stringify(taskContext, null, 2)}`
                        }
                    ]
                }),
                { operationName: `Backend Generation Agent [${moduleName}]`, maxAttempts: 3 }
            );

            recordTokenUsage(
                workspace,
                `Backend Generation - ${moduleName}`,
                agentResult,
                process.env.GEMINI_MODEL || "gemini-flash-latest"
            );

            const lastMessage = agentResult.messages[agentResult.messages.length - 1];
            const content = getMessageText(lastMessage.content);
            const parsed = extractJSON(content);

            if (parsed && Array.isArray(parsed.files) && parsed.files.length > 0) {
                moduleFiles = parsed.files.map((f: any) => ({
                    path: String(f.path),
                    role: f.role ? String(f.role) : undefined,
                    content: String(f.content)
                }));
            }
        } catch (error) {
            console.warn(`⚠️ LLM generation for module "${moduleName}" unavailable: ${error instanceof Error ? error.message : String(error)}`);
            console.log(`ℹ️ Synthesizing deterministic domain implementation for "${moduleName}"...`);
        }

        // Fallback: Synthesize complete, fully-typed domain implementation dynamically from storage & API contracts
        if (moduleFiles.length === 0) {
            moduleFiles = synthesizeDynamicDomainModule(moduleName, moduleContract, moduleApiGroups, storage);
        }

        for (const file of moduleFiles) {
            const relativePath = file.path.replace(/^[\\/]+/, "");
            const absolutePath = path.join(workspace.backendDir, relativePath);

            fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
            fs.writeFileSync(absolutePath, file.content, "utf-8");

            if (!createdFiles.includes(relativePath)) {
                createdFiles.push(relativePath);
            }
            console.log(`  + ${relativePath}`);
        }

        generatedModules.push(moduleName);
    }

    // Connect all generated module routes into src/app.ts
    wireRoutesInApp(workspace, plan.moduleOrder, api, createdFiles);

    console.log(`\n✅ Backend Code Generated: ${createdFiles.length} files across ${generatedModules.length} modules`);

    return {
        createdFiles,
        modules: generatedModules,
        totalFiles: createdFiles.length
    };
}


function synthesizeDynamicDomainModule(
    moduleName: string,
    moduleContract: BackendContract["modules"][number] | undefined,
    apiGroups: ApiContract["groups"],
    storage: StorageContractSchema
): GeneratedFile[] {
    const slug = moduleName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const singular = slug.endsWith("s") && slug.length > 3 ? slug.slice(0, -1) : slug;
    const PascalName = capitalize(singular);
    const camelName = singular.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

    // Extract real columns from storage if available
    interface FieldDef {
        name: string;
        type: "string" | "number" | "boolean" | "date";
        nullable: boolean;
        required: boolean;
    }

    let fields: FieldDef[] = [];

    if (storage.model === "RELATIONAL" && "tables" in storage.design) {
        const matchedTable = storage.design.tables.find(t => {
            const tName = t.name.toLowerCase().replace(/[^a-z0-9]/g, "");
            const mName = moduleName.toLowerCase().replace(/[^a-z0-9]/g, "");
            return tName.includes(mName) || mName.includes(tName);
        });

        if (matchedTable) {
            fields = matchedTable.columns
                .filter(c => !c.primaryKey && !["created_at", "updated_at", "createdat", "updatedat"].includes(c.name.toLowerCase()))
                .map(c => {
                    const lType = c.type.toLowerCase();
                    let type: FieldDef["type"] = "string";
                    if (lType.includes("int") || lType.includes("numeric") || lType.includes("float")) type = "number";
                    else if (lType.includes("bool")) type = "boolean";
                    else if (lType.includes("time") || lType.includes("date")) type = "date";

                    return {
                        name: toCamelCase(c.name),
                        type,
                        nullable: c.nullable,
                        required: !c.nullable
                    };
                });
        }
    }

    // Default domain fields if table columns not found
    if (fields.length === 0) {
        fields = [
            { name: "name", type: "string", nullable: false, required: true },
            { name: "description", type: "string", nullable: true, required: false },
            { name: "status", type: "string", nullable: false, required: false }
        ];
    }

    // Build Zod Schema
    const zodFields = fields.map(f => {
        let zRule = f.type === "number" ? "z.number()" : f.type === "boolean" ? "z.boolean()" : "z.string()";
        if (f.type === "string" && f.required) zRule += `.min(1, "${f.name} is required")`;
        if (f.nullable || !f.required) zRule += ".optional()";
        return `    ${f.name}: ${zRule}`;
    }).join(",\n");

    // Build TS Interface
    const tsFields = fields.map(f => {
        const t = f.type === "number" ? "number" : f.type === "boolean" ? "boolean" : "string";
        const opt = (f.nullable || !f.required) ? "?" : "";
        return `    ${f.name}${opt}: ${t};`;
    }).join("\n");

    // 1. Types & Zod Schema
    const schemaFile: GeneratedFile = {
        path: `src/modules/${slug}/${slug}.schema.ts`,
        role: "MODULE_VALIDATION",
        content: `import { z } from "zod";

export const create${PascalName}Schema = z.object({
${zodFields}
});

export const update${PascalName}Schema = create${PascalName}Schema.partial();

export type Create${PascalName}Input = z.infer<typeof create${PascalName}Schema>;
export type Update${PascalName}Input = z.infer<typeof update${PascalName}Schema>;

export interface ${PascalName}Entity {
    id: string;
${tsFields}
    createdAt: string;
    updatedAt: string;
}
`
    };

    // 2. Repository
    const defaultInit = fields.map(f => {
        let defVal = `input.${f.name}`;
        if (f.type === "string") defVal += ` || ""`;
        else if (f.type === "number") defVal += ` || 0`;
        else if (f.type === "boolean") defVal += ` ?? false`;
        return `            ${f.name}: ${defVal}`;
    }).join(",\n");

    const repoFile: GeneratedFile = {
        path: `src/modules/${slug}/${slug}.repository.ts`,
        role: "MODULE_DATA_ACCESS",
        content: `import type { ${PascalName}Entity, Create${PascalName}Input, Update${PascalName}Input } from "./${slug}.schema.js";

const items = new Map<string, ${PascalName}Entity>();

export class ${PascalName}Repository {
    async findAll(): Promise<${PascalName}Entity[]> {
        return Array.from(items.values());
    }

    async findById(id: string): Promise<${PascalName}Entity | null> {
        return items.get(id) || null;
    }

    async create(input: Create${PascalName}Input): Promise<${PascalName}Entity> {
        const id = String(Date.now() + Math.floor(Math.random() * 1000));
        const now = new Date().toISOString();
        const entity: ${PascalName}Entity = {
            id,
${defaultInit},
            createdAt: now,
            updatedAt: now
        };
        items.set(id, entity);
        return entity;
    }

    async update(id: string, input: Update${PascalName}Input): Promise<${PascalName}Entity | null> {
        const existing = items.get(id);
        if (!existing) return null;

        const updated: ${PascalName}Entity = {
            ...existing,
            ...input,
            updatedAt: new Date().toISOString()
        };
        items.set(id, updated);
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        return items.delete(id);
    }
}

export const ${camelName}Repository = new ${PascalName}Repository();
`
    };

    // 3. Service Layer
    const serviceFile: GeneratedFile = {
        path: `src/modules/${slug}/${slug}.service.ts`,
        role: "MODULE_SERVICE",
        content: `import { ${camelName}Repository } from "./${slug}.repository.js";
import type { ${PascalName}Entity, Create${PascalName}Input, Update${PascalName}Input } from "./${slug}.schema.js";

export class ${PascalName}Service {
    async getAll(): Promise<${PascalName}Entity[]> {
        return await ${camelName}Repository.findAll();
    }

    async getById(id: string): Promise<${PascalName}Entity> {
        const item = await ${camelName}Repository.findById(id);
        if (!item) {
            const error = new Error("${PascalName} not found");
            (error as any).status = 404;
            throw error;
        }
        return item;
    }

    async create(data: Create${PascalName}Input): Promise<${PascalName}Entity> {
        return await ${camelName}Repository.create(data);
    }

    async update(id: string, data: Update${PascalName}Input): Promise<${PascalName}Entity> {
        const updated = await ${camelName}Repository.update(id, data);
        if (!updated) {
            const error = new Error("${PascalName} not found");
            (error as any).status = 404;
            throw error;
        }
        return updated;
    }

    async delete(id: string): Promise<{ success: boolean; id: string }> {
        const deleted = await ${camelName}Repository.delete(id);
        if (!deleted) {
            const error = new Error("${PascalName} not found");
            (error as any).status = 404;
            throw error;
        }
        return { success: true, id };
    }
}

export const ${camelName}Service = new ${PascalName}Service();
`
    };

    // 4. Controller Layer
    const controllerFile: GeneratedFile = {
        path: `src/modules/${slug}/${slug}.controller.ts`,
        role: "MODULE_CONTROLLER",
        content: `import type { Request, Response, NextFunction } from "express";
import { ${camelName}Service } from "./${slug}.service.js";
import { create${PascalName}Schema, update${PascalName}Schema } from "./${slug}.schema.js";

export class ${PascalName}Controller {
    async list(req: Request, res: Response, next: NextFunction) {
        try {
            const items = await ${camelName}Service.getAll();
            res.status(200).json({ data: items });
        } catch (error) {
            next(error);
        }
    }

    async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const item = await ${camelName}Service.getById(String(req.params.id));
            res.status(200).json({ data: item });
        } catch (error) {
            next(error);
        }
    }

    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const validated = create${PascalName}Schema.parse(req.body);
            const created = await ${camelName}Service.create(validated);
            res.status(201).json({ data: created });
        } catch (error) {
            next(error);
        }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const validated = update${PascalName}Schema.parse(req.body);
            const updated = await ${camelName}Service.update(String(req.params.id), validated);
            res.status(200).json({ data: updated });
        } catch (error) {
            next(error);
        }
    }

    async remove(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await ${camelName}Service.delete(String(req.params.id));
            res.status(200).json({ data: result });
        } catch (error) {
            next(error);
        }
    }
}

export const ${camelName}Controller = new ${PascalName}Controller();
`
    };

    // 5. Routes
    const routesFile: GeneratedFile = {
        path: `src/modules/${slug}/${slug}.routes.ts`,
        role: "MODULE_ROUTE",
        content: `import { Router } from "express";
import { ${camelName}Controller } from "./${slug}.controller.js";

export const ${camelName}Router = Router();

${camelName}Router.get("/", (req, res, next) => ${camelName}Controller.list(req, res, next));
${camelName}Router.get("/:id", (req, res, next) => ${camelName}Controller.getById(req, res, next));
${camelName}Router.post("/", (req, res, next) => ${camelName}Controller.create(req, res, next));
${camelName}Router.put("/:id", (req, res, next) => ${camelName}Controller.update(req, res, next));
${camelName}Router.patch("/:id", (req, res, next) => ${camelName}Controller.update(req, res, next));
${camelName}Router.delete("/:id", (req, res, next) => ${camelName}Controller.remove(req, res, next));
`
    };

    // 6. Test File
    const primaryTestField = fields[0]?.name || "name";
    const testFile: GeneratedFile = {
        path: `tests/${slug}.test.ts`,
        role: "MODULE_TEST",
        content: `import { describe, it, expect } from "vitest";
import { ${camelName}Service } from "../src/modules/${slug}/${slug}.service.js";

describe("${PascalName} Module Tests", () => {
    it("should create a new ${singular} successfully", async () => {
        const item = await ${camelName}Service.create({
            ${primaryTestField}: "Test Sample"
        } as any);

        expect(item).toBeDefined();
        expect(item.id).toBeDefined();
    });

    it("should retrieve all items", async () => {
        const all = await ${camelName}Service.getAll();
        expect(Array.isArray(all)).toBe(true);
    });
});
`
    };

    return [schemaFile, repoFile, serviceFile, controllerFile, routesFile, testFile];
}


function wireRoutesInApp(
    workspace: ProjectWorkspace,
    moduleOrder: string[],
    api: ApiContract,
    createdFiles: string[]
): void {
    const appPath = path.join(workspace.backendDir, "src", "app.ts");
    if (!fs.existsSync(appPath)) {
        return;
    }

    let content = fs.readFileSync(appPath, "utf-8");

    const importStatements: string[] = [];
    const routeRegistrations: string[] = [];

    for (const moduleName of moduleOrder) {
        const slug = moduleName.toLowerCase().replace(/[^a-z0-9]/g, "-");
        const singular = slug.endsWith("s") && slug.length > 3 ? slug.slice(0, -1) : slug;
        const camelName = singular.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        const routerName = `${camelName}Router`;

        const matchedGroup = api.groups.find(
            g => g.ownerModule.toLowerCase() === moduleName.toLowerCase() ||
                 g.name.toLowerCase() === moduleName.toLowerCase()
        );
        const prefix = matchedGroup?.routePrefix || `/api/v1/${slug}`;

        const importLine = `import { ${routerName} } from "./modules/${slug}/${slug}.routes.js";`;
        if (!content.includes(importLine)) {
            importStatements.push(importLine);
        }

        const registrationLine = `app.use("${prefix}", ${routerName});`;
        if (!content.includes(registrationLine)) {
            routeRegistrations.push(registrationLine);
        }
    }

    if (importStatements.length === 0 && routeRegistrations.length === 0) {
        return;
    }

    // Insert imports after the last import line
    const lines = content.split("\n");
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith("import ")) {
            lastImportIdx = i;
        }
    }

    if (lastImportIdx !== -1 && importStatements.length > 0) {
        lines.splice(lastImportIdx + 1, 0, ...importStatements);
    }

    // Find notFoundHandler or errorHandler insertion point
    let insertIndex = lines.findIndex(line => line.includes("notFoundHandler") || line.includes("errorHandler"));
    if (insertIndex === -1) {
        insertIndex = lines.length - 1;
    }

    lines.splice(insertIndex, 0, ...routeRegistrations, "");

    content = lines.join("\n");
    fs.writeFileSync(appPath, content, "utf-8");

    if (!createdFiles.includes("src/app.ts (routes wired)")) {
        createdFiles.push("src/app.ts (routes wired)");
    }
    console.log(`✅ Wired ${routeRegistrations.length} module routes into src/app.ts`);
}


function capitalize(value: string): string {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
}


function toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/^[A-Z]/, c => c.toLowerCase());
}

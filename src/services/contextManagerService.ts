import type { BackendContract } from "../schemas/backendContractSchema.js";
import type { ApiContract } from "../schemas/apiContractSchema.js";
import type { StorageContractSchema } from "../schemas/storageContractSchema.js";
import type { BackendGenerationTask } from "../schemas/backendGenerationPlanSchema.js";
import type { BackendExecutionProfile } from "../schemas/backendExecutionProfileSchema.js";
import type { RepositoryIndex } from "./repositoryIntelligenceService.js";


export interface TaskContext {
    taskId: string;
    taskDescription: string;
    moduleName: string | null;
    targetRoles: string[];
    relevantRequirements: Array<{ id: string; title: string; description: string }>;
    relevantApiGroups: ApiContract["groups"];
    relevantStorage: {
        model: string;
        engine: string;
        tables?: any[];
    };
    repositorySymbols: {
        databaseExports: string[];
        availableModules: string[];
    };
    conventions: string[];
    implementationGuidance: string[];
}


const DEFAULT_BUDGET_LIMIT_CHARS = 24000;


export function buildTaskContext(
    task: BackendGenerationTask,
    backend: BackendContract,
    api: ApiContract,
    storage: StorageContractSchema,
    profile: BackendExecutionProfile,
    repoIndex: RepositoryIndex,
    budgetLimitChars: number = DEFAULT_BUDGET_LIMIT_CHARS
): TaskContext {
    const moduleName = task.module;

    // Filter relevant requirements
    const reqSet = new Set(task.requirementIds || []);
    const relevantRequirements = (backend.functionalRequirements || [])
        .filter(r => reqSet.has(r.id) || (moduleName && r.description.toLowerCase().includes(moduleName.toLowerCase())))
        .slice(0, 10)
        .map(r => ({
            id: r.id,
            title: r.title,
            description: r.description
        }));

    // Filter relevant API groups and endpoints
    const apiGroupNames = new Set(task.apiGroups || []);
    const relevantApiGroups = api.groups.filter(g =>
        apiGroupNames.has(g.name) ||
        (moduleName && g.ownerModule.toLowerCase() === moduleName.toLowerCase()) ||
        (moduleName && g.name.toLowerCase() === moduleName.toLowerCase())
    );

    // Filter relevant storage resources
    let relevantTables: any[] = [];
    if (storage.model === "RELATIONAL" && "tables" in storage.design) {
        const storageResourceSet = new Set((task.storageResources || []).map(s => s.toLowerCase()));
        relevantTables = storage.design.tables.filter(t => {
            if (storageResourceSet.has(t.name.toLowerCase())) return true;
            if (moduleName && t.name.toLowerCase().includes(moduleName.toLowerCase())) return true;
            return false;
        });

        if (relevantTables.length === 0 && storage.design.tables.length <= 5) {
            relevantTables = storage.design.tables;
        }
    }

    // Repository symbols relevant to code generation
    const dbFiles = repoIndex.files.filter(f => f.role === "DATABASE");
    const databaseExports = Array.from(new Set(dbFiles.flatMap(f => f.exports)));

    const context: TaskContext = {
        taskId: task.id,
        taskDescription: task.description,
        moduleName,
        targetRoles: task.targetRoles,
        relevantRequirements,
        relevantApiGroups,
        relevantStorage: {
            model: storage.model,
            engine: storage.engine,
            tables: relevantTables
        },
        repositorySymbols: {
            databaseExports,
            availableModules: repoIndex.existingModules
        },
        conventions: profile.conventions || [],
        implementationGuidance: profile.implementationGuidance || []
    };

    return pruneContextBudget(context, budgetLimitChars);
}


function pruneContextBudget(context: TaskContext, budgetLimitChars: number): TaskContext {
    let serialized = JSON.stringify(context);
    if (serialized.length <= budgetLimitChars) {
        return context;
    }

    // Progressively prune less critical context if over budget
    const pruned = { ...context };
    pruned.implementationGuidance = pruned.implementationGuidance.slice(0, 3);
    pruned.conventions = pruned.conventions.slice(0, 3);

    serialized = JSON.stringify(pruned);
    if (serialized.length > budgetLimitChars && pruned.relevantRequirements.length > 5) {
        pruned.relevantRequirements = pruned.relevantRequirements.slice(0, 5);
    }

    return pruned;
}

import path from "path";
import { readJSON, writeJSON } from "../utils/fileManager.js";
import { architectureSchema } from "../schemas/architectureSchema.js";
import { apiContractSchema } from "../schemas/apiContractSchema.js";
import { frontendContractSchema } from "../schemas/frontendContractSchema.js";
import type { FrontendContract, FrontendModuleContract } from "../schemas/frontendContractSchema.js";
import type { ProjectWorkspace } from "../utils/projectWorkspace.js";


export function generateFrontendContract(
    workspace: ProjectWorkspace
): FrontendContract {
    const architecture = architectureSchema.parse(readJSON(workspace.architecture));
    const api = apiContractSchema.parse(readJSON(workspace.apiContract));

    const frontendModules: FrontendModuleContract[] = [];

    // Map each architecture frontend module or API group
    for (const fModule of architecture.frontend.modules) {
        const slug = fModule.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
        const matchedApiGroup = api.groups.find(
            g => g.name.toLowerCase().includes(slug) || slug.includes(g.name.toLowerCase())
        );

        const apiOperations = matchedApiGroup
            ? matchedApiGroup.endpoints.map(e => e.operationId)
            : [];

        frontendModules.push({
            name: fModule.name,
            routePath: `/${slug}`,
            responsibility: fModule.responsibility,
            apiGroups: matchedApiGroup ? [matchedApiGroup.name] : [],
            components: [
                {
                    name: `${capitalize(slug)}Page`,
                    role: "PAGE",
                    description: `Main view for ${fModule.name}`,
                    apiOperationsUsed: apiOperations
                },
                {
                    name: `${capitalize(slug)}FormModal`,
                    role: "MODAL",
                    description: `Create/edit dialog for ${fModule.name}`,
                    apiOperationsUsed: apiOperations.filter(op => op.toLowerCase().includes("create") || op.toLowerCase().includes("update"))
                },
                {
                    name: `${capitalize(slug)}Card`,
                    role: "DISPLAY",
                    description: `Display card representation for ${fModule.name}`,
                    apiOperationsUsed: []
                }
            ]
        });
    }

    // Fallback module if none defined
    if (frontendModules.length === 0) {
        const firstGroup = api.groups[0];
        const groupName = firstGroup ? firstGroup.name : "dashboard";
        const slug = groupName.toLowerCase().replace(/[^a-z0-9]/g, "-");
        frontendModules.push({
            name: groupName,
            routePath: "/",
            responsibility: "Main application workspace",
            apiGroups: firstGroup ? [firstGroup.name] : [],
            components: [
                {
                    name: `${capitalize(slug)}Page`,
                    role: "PAGE",
                    description: "Main workspace page",
                    apiOperationsUsed: firstGroup ? firstGroup.endpoints.map(e => e.operationId) : []
                }
            ]
        });
    }

    const contract: FrontendContract = frontendContractSchema.parse({
        projectName: architecture.projectName,
        framework: architecture.frontend.framework,
        language: architecture.frontend.language,
        styling: architecture.frontend.styling,
        baseUrlEnvVar: "VITE_API_URL",
        modules: frontendModules
    });

    const outputPath = path.join(workspace.outputDir, "frontend-contract.json");
    writeJSON(outputPath, contract);
    console.log(`✅ Frontend Contract Ready: ${contract.modules.length} modules (${outputPath})`);

    return contract;
}


function capitalize(val: string): string {
    if (!val) return "";
    return val.charAt(0).toUpperCase() + val.slice(1);
}

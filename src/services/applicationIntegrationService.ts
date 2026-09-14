import fs from "fs";
import path from "path";
import { readJSON } from "../utils/fileManager.js";
import { apiContractSchema } from "../schemas/apiContractSchema.js";
import { frontendContractSchema } from "../schemas/frontendContractSchema.js";
import type { ProjectWorkspace } from "../utils/projectWorkspace.js";


export interface IntegrationValidationResult {
    valid: boolean;
    checkedEndpoints: number;
    matchedEndpoints: number;
    mismatches: string[];
}


export function validateFullApplicationIntegration(
    workspace: ProjectWorkspace
): IntegrationValidationResult {
    console.log("\n25. Running Full-Stack Integration Validation...");

    const api = apiContractSchema.parse(readJSON(workspace.apiContract));
    const frontendContractPath = path.join(workspace.outputDir, "frontend-contract.json");
    const mismatches: string[] = [];

    const allApiOperations = new Set<string>();
    const allApiPaths = new Set<string>();

    for (const group of api.groups) {
        for (const ep of group.endpoints) {
            allApiOperations.add(ep.operationId);
            allApiPaths.add(`${ep.method.toUpperCase()} ${ep.path}`);
        }
    }

    let checkedEndpoints = allApiOperations.size;
    let matchedEndpoints = 0;

    if (fs.existsSync(frontendContractPath)) {
        const frontendContract = frontendContractSchema.parse(readJSON(frontendContractPath));

        for (const mod of frontendContract.modules) {
            for (const comp of mod.components) {
                for (const opId of comp.apiOperationsUsed) {
                    if (!allApiOperations.has(opId)) {
                        mismatches.push(
                            `Frontend component "${comp.name}" calls operation "${opId}" which is missing from backend API contract.`
                        );
                    } else {
                        matchedEndpoints++;
                    }
                }
            }
        }
    }

    // Verify backend route declarations in backend app.ts
    const backendAppPath = path.join(workspace.backendDir, "src", "app.ts");
    if (fs.existsSync(backendAppPath)) {
        const appContent = fs.readFileSync(backendAppPath, "utf-8");
        for (const group of api.groups) {
            if (!appContent.includes(group.routePrefix)) {
                mismatches.push(`Backend src/app.ts is missing route mounting for prefix "${group.routePrefix}"`);
            }
        }
    }

    const valid = mismatches.length === 0;

    if (valid) {
        console.log(`✅ Integration Validation PASSED: All frontend API expectations align with backend API contract (${allApiOperations.size} endpoints)`);
    } else {
        console.warn(`⚠️ Integration Validation found ${mismatches.length} mismatch(es):`);
        for (const m of mismatches) {
            console.warn(`  - ${m}`);
        }
    }

    return {
        valid,
        checkedEndpoints,
        matchedEndpoints,
        mismatches
    };
}

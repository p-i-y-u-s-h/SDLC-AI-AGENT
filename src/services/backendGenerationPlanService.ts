import {
    readJSON,
    writeJSON
} from "../utils/fileManager.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";

import {
    buildBackendGenerationPlan
} from "./backendGenerationPlannerService.js";

import type {
    BackendGenerationPlan
} from "../schemas/backendGenerationPlanSchema.js";


export function generateBackendGenerationPlan(
    workspace:
        ProjectWorkspace
): BackendGenerationPlan {

    console.log(
        "\n9. Building Backend Generation Plan..."
    );


    const backendContract =
        readJSON(
            workspace.backendContract
        );


    const apiContract =
        readJSON(
            workspace.apiContract
        );


    const storageContract =
        readJSON(
            workspace.storageContract
        );


    const executionProfile =
        readJSON(
            workspace.backendExecutionProfile
        );


    const plan =
        buildBackendGenerationPlan(
            backendContract,
            apiContract,
            storageContract,
            executionProfile
        );


    writeJSON(
        workspace.backendGenerationPlan,
        plan
    );


    const moduleTasks =
        plan.tasks.filter(
            task =>
                task.kind === "MODULE"
        );


    console.log(
        `✅ ${workspace.backendGenerationPlan} created`
    );


    console.log(
        `✅ Backend Plan: ${moduleTasks.length} modules | ${plan.tasks.length} tasks | ${plan.phaseCount} phases`
    );


    console.log(
        `✅ Module Order: ${plan.moduleOrder.join(" → ")}`
    );


    return plan;

}
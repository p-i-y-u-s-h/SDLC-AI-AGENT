import type {
    BackendContract
} from "../schemas/backendContractSchema.js";

import type {
    ApiContract
} from "../schemas/apiContractSchema.js";

import type {
    BackendExecutionProfile,
    CommandPurpose
} from "../schemas/backendExecutionProfileSchema.js";

import {
    backendGenerationPlanSchema
} from "../schemas/backendGenerationPlanSchema.js";

import type {
    BackendArtifactRole,
    BackendGenerationPlan,
    BackendGenerationTask
} from "../schemas/backendGenerationPlanSchema.js";


type StorageContractLike = {

    projectName:
        string;

    model:
        string;

    engine:
        string;

};


type BackendModule =
    BackendContract["modules"][number];


// ============================================================
// MAIN PLANNER
// ============================================================


export function buildBackendGenerationPlan(
    backend:
        BackendContract,
    api:
        ApiContract,
    storage:
        StorageContractLike,
    executionProfile:
        BackendExecutionProfile
): BackendGenerationPlan {

    validatePlannerInputs(
        backend,
        api,
        storage,
        executionProfile
    );


    const moduleOrder =
        calculateModuleOrder(
            backend.modules
        );


    const moduleDepths =
        calculateModuleDepths(
            backend.modules,
            moduleOrder
        );


    const moduleTaskIds =
        createModuleTaskIds(
            backend.modules
        );


    const foundationCommands =
        commandNamesByPurpose(
            executionProfile,
            [
                "BOOTSTRAP",
                "DEPENDENCY_INSTALL"
            ]
        );


    const storageCommands =
        commandNamesByPurpose(
            executionProfile,
            [
                "SCHEMA_VALIDATE",
                "CODEGEN",
                "TYPECHECK"
            ]
        );


    const moduleValidationCommands =
        commandNamesByPurpose(
            executionProfile,
            [
                "TYPECHECK"
            ]
        );


    const testCommands =
        commandNamesByPurpose(
            executionProfile,
            [
                "TEST"
            ]
        );


    const finalValidationCommands =
        commandNamesByPurpose(
            executionProfile,
            [
                "SCHEMA_VALIDATE",
                "CODEGEN",
                "TYPECHECK",
                "BUILD",
                "TEST"
            ]
        );


    const tasks:
        BackendGenerationTask[] =
        [];


    const foundationTaskId =
        "backend-foundation";


    const storageTaskId =
        "backend-storage";


    const foundationRoles:
        BackendArtifactRole[] = [

            "PROJECT_CONFIG",

            "APP_BOOTSTRAP"

        ];


    if (
        backend.authentication.required
    ) {

        foundationRoles.push(
            "AUTH_MIDDLEWARE"
        );

    }


    // ========================================================
    // PHASE 1 — FOUNDATION
    // ========================================================


    tasks.push({

        id:
            foundationTaskId,

        phase:
            1,

        module:
            null,

        kind:
            "SCAFFOLD",

        description:
            "Create the backend project foundation using the resolved execution profile without implementing business modules.",

        dependsOn:
            [],

        requirementIds:
            [],

        operationIds:
            [],

        apiGroups:
            [],

        storageResources:
            [],

        externalIntegrations:
            [],

        targetRoles:
            foundationRoles,

        validationCommandNames:
            foundationCommands

    });


    // ========================================================
    // PHASE 2 — STORAGE
    // ========================================================


    const storageResources =
        uniqueStrings(
            backend.storage.resources.map(
                resource =>
                    resource.name
            )
        );


    tasks.push({

        id:
            storageTaskId,

        phase:
            2,

        module:
            null,

        kind:
            "STORAGE",

        description:
            `Implement the ${backend.database.model} persistence foundation for ${backend.database.engine}.`,

        dependsOn: [
            foundationTaskId
        ],

        requirementIds:
            [],

        operationIds:
            [],

        apiGroups:
            [],

        storageResources,

        externalIntegrations:
            [],

        targetRoles: [

            "DATABASE_SCHEMA",

            "DATABASE_CLIENT"

        ],

        validationCommandNames:
            storageCommands

    });


    // ========================================================
    // REQUIRED EXTERNAL INTEGRATIONS
    // ========================================================


    const requiredIntegrations =
        uniqueStrings(
            backend.externalIntegrations
                .filter(
                    integration =>
                        integration.required
                )
                .map(
                    integration =>
                        integration.name
                )
        );


    let integrationTaskId:
        string
        |
        null =
        null;


    if (
        requiredIntegrations.length > 0
    ) {

        integrationTaskId =
            "backend-integrations";


        tasks.push({

            id:
                integrationTaskId,

            phase:
                2,

            module:
                null,

            kind:
                "INTEGRATION",

            description:
                "Prepare adapters and integration boundaries for required external services.",

            dependsOn: [
                foundationTaskId
            ],

            requirementIds:
                [],

            operationIds:
                [],

            apiGroups:
                [],

            storageResources:
                [],

            externalIntegrations:
                requiredIntegrations,

            targetRoles: [
                "INTEGRATION_ADAPTER"
            ],

            validationCommandNames:
                moduleValidationCommands

        });

    }


    // ========================================================
    // MODULE IMPLEMENTATION TASKS
    // ========================================================


    for (
        const moduleName
        of moduleOrder
    ) {

        const module =
            backend.modules.find(
                candidate =>
                    candidate.name
                    ===
                    moduleName
            );


        if (
            !module
        ) {

            throw new Error(
                `BACKEND_PLAN_MODULE_NOT_FOUND:${moduleName}`
            );

        }


        const taskId =
            moduleTaskIds.get(
                module.name
            );


        if (
            !taskId
        ) {

            throw new Error(
                `BACKEND_PLAN_TASK_ID_NOT_FOUND:${module.name}`
            );

        }


        const apiData =
            collectModuleApiData(
                module,
                api
            );


        const dependsOn = [

            storageTaskId,

            ...module.dependsOn.map(
                dependency => {

                    const dependencyTaskId =
                        moduleTaskIds.get(
                            dependency
                        );


                    if (
                        !dependencyTaskId
                    ) {

                        throw new Error(
                            `BACKEND_PLAN_DEPENDENCY_TASK_NOT_FOUND:${module.name}:${dependency}`
                        );

                    }


                    return dependencyTaskId;

                }
            )

        ];


        if (
            integrationTaskId
        ) {

            dependsOn.push(
                integrationTaskId
            );

        }


        const depth =
            moduleDepths.get(
                module.name
            )
            ??
            0;


        tasks.push({

            id:
                taskId,

            phase:
                3
                +
                depth,

            module:
                module.name,

            kind:
                "MODULE",

            description:
                `Implement backend module "${module.name}": ${module.responsibility}`,

            dependsOn:
                uniqueStrings(
                    dependsOn
                ),

            requirementIds:
                apiData.requirementIds,

            operationIds:
                apiData.operationIds,

            apiGroups:
                apiData.apiGroups,

            /*
             * Storage ownership is intentionally not guessed here.
             *
             * The current Backend Contract does not define
             * per-module storage ownership.
             *
             * The Context Manager will later select relevant
             * resources from the authoritative contracts.
             */
            storageResources:
                [],

            externalIntegrations:
                [],

            targetRoles: [

                "MODULE_ROUTE",

                "MODULE_CONTROLLER",

                "MODULE_SERVICE",

                "MODULE_DATA_ACCESS",

                "MODULE_VALIDATION"

            ],

            validationCommandNames:
                moduleValidationCommands

        });

    }


    // ========================================================
    // TEST TASK
    // ========================================================


    const moduleTasks =
        tasks.filter(
            task =>
                task.kind
                ===
                "MODULE"
        );


    const highestModulePhase =
        Math.max(
            2,
            ...moduleTasks.map(
                task =>
                    task.phase
            )
        );


    const testPhase =
        highestModulePhase
        +
        1;


    const testDependencies =
        moduleTasks.map(
            task =>
                task.id
        );


    if (
        integrationTaskId
    ) {

        testDependencies.push(
            integrationTaskId
        );

    }


    tasks.push({

        id:
            "backend-tests",

        phase:
            testPhase,

        module:
            null,

        kind:
            "TEST",

        description:
            "Generate and execute backend integration and contract-oriented tests after all backend modules are implemented.",

        dependsOn:
            uniqueStrings(
                testDependencies
            ),

        requirementIds:
            uniqueStrings(
                api.groups.flatMap(
                    group =>
                        group.endpoints.flatMap(
                            endpoint =>
                                endpoint.requirementIds
                        )
                )
            ),

        operationIds:
            uniqueStrings(
                api.groups.flatMap(
                    group =>
                        group.endpoints.map(
                            endpoint =>
                                endpoint.operationId
                        )
                )
            ),

        apiGroups:
            uniqueStrings(
                api.groups.map(
                    group =>
                        group.name
                )
            ),

        storageResources:
            [],

        externalIntegrations:
            requiredIntegrations,

        targetRoles: [
            "MODULE_TEST"
        ],

        validationCommandNames:
            testCommands

    });


    // ========================================================
    // FINAL VALIDATION
    // ========================================================


    const validationPhase =
        testPhase
        +
        1;


    tasks.push({

        id:
            "backend-final-validation",

        phase:
            validationPhase,

        module:
            null,

        kind:
            "VALIDATION",

        description:
            "Run the complete backend validation suite defined by the resolved backend execution profile.",

        dependsOn: [
            "backend-tests"
        ],

        requirementIds:
            [],

        operationIds:
            [],

        apiGroups:
            [],

        storageResources:
            [],

        externalIntegrations:
            [],

        targetRoles:
            [],

        validationCommandNames:
            finalValidationCommands

    });


    validateTaskGraph(
        tasks
    );


    return backendGenerationPlanSchema.parse({

        projectName:
            backend.projectName,

        profileId:
            executionProfile.id,

        moduleOrder,

        phaseCount:
            validationPhase,

        tasks

    });

}


// ============================================================
// INPUT VALIDATION
// ============================================================


function validatePlannerInputs(
    backend:
        BackendContract,
    api:
        ApiContract,
    storage:
        StorageContractLike,
    executionProfile:
        BackendExecutionProfile
): void {

    if (
        api.projectName
        !==
        backend.projectName
    ) {

        throw new Error(
            "BACKEND_PLAN_API_PROJECT_MISMATCH"
        );

    }


    if (
        storage.projectName
        !==
        backend.projectName
    ) {

        throw new Error(
            "BACKEND_PLAN_STORAGE_PROJECT_MISMATCH"
        );

    }


    if (
        normalizeTechnology(
            api.apiStyle
        )
        !==
        normalizeTechnology(
            backend.technology.apiStyle
        )
    ) {

        throw new Error(
            "BACKEND_PLAN_API_STYLE_MISMATCH"
        );

    }


    if (
        normalizeTechnology(
            storage.model
        )
        !==
        normalizeTechnology(
            backend.database.model
        )
    ) {

        throw new Error(
            "BACKEND_PLAN_STORAGE_MODEL_MISMATCH"
        );

    }


    if (
        normalizeTechnology(
            storage.engine
        )
        !==
        normalizeTechnology(
            backend.database.engine
        )
    ) {

        throw new Error(
            "BACKEND_PLAN_STORAGE_ENGINE_MISMATCH"
        );

    }


    if (
        executionProfile.id
        !==
        backend.execution.profileId
    ) {

        throw new Error(
            `BACKEND_PLAN_PROFILE_MISMATCH:${backend.execution.profileId}:${executionProfile.id}`
        );

    }


    assertTechnologySame(
        backend.technology.language,
        executionProfile.language,
        "LANGUAGE"
    );


    assertTechnologySame(
        backend.technology.framework,
        executionProfile.framework,
        "FRAMEWORK"
    );


    if (
        executionProfile.runtime
    ) {

        assertTechnologySame(
            backend.technology.runtime,
            executionProfile.runtime,
            "RUNTIME"
        );

    }


    if (
        executionProfile.packageManager
    ) {

        assertTechnologySame(
            backend.technology.packageManager,
            executionProfile.packageManager,
            "PACKAGE_MANAGER"
        );

    }


    if (
        executionProfile.orm
    ) {

        assertTechnologySame(
            backend.technology.dataAccessTechnology,
            executionProfile.orm,
            "DATA_ACCESS"
        );

    }


    if (
        executionProfile.databaseEngine
    ) {

        assertTechnologySame(
            backend.database.engine,
            executionProfile.databaseEngine,
            "DATABASE_ENGINE"
        );

    }


    validateModules(
        backend.modules
    );


    validateApiGroups(
        backend,
        api
    );

}


// ============================================================
// MODULE VALIDATION
// ============================================================


function validateModules(
    modules:
        BackendContract["modules"]
): void {

    const names =
        modules.map(
            module =>
                module.name
        );


    if (
        new Set(
            names
        ).size
        !==
        names.length
    ) {

        throw new Error(
            "BACKEND_PLAN_DUPLICATE_MODULE"
        );

    }


    const validModules =
        new Set(
            names
        );


    for (
        const module
        of modules
    ) {

        const dependencies =
            uniqueStrings(
                module.dependsOn
            );


        for (
            const dependency
            of dependencies
        ) {

            if (
                dependency
                ===
                module.name
            ) {

                throw new Error(
                    `BACKEND_PLAN_SELF_DEPENDENCY:${module.name}`
                );

            }


            if (
                !validModules.has(
                    dependency
                )
            ) {

                throw new Error(
                    `BACKEND_PLAN_UNKNOWN_MODULE_DEPENDENCY:${module.name}:${dependency}`
                );

            }

        }

    }

}


// ============================================================
// API GROUP VALIDATION
// ============================================================


function validateApiGroups(
    backend:
        BackendContract,
    api:
        ApiContract
): void {

    const expectedGroupNames =
        backend.modules.flatMap(
            module =>
                module.apiGroups.map(
                    group =>
                        group.name
                )
        );


    const actualGroupNames =
        api.groups.map(
            group =>
                group.name
        );


    if (
        new Set(
            expectedGroupNames
        ).size
        !==
        expectedGroupNames.length
    ) {

        throw new Error(
            "BACKEND_PLAN_DUPLICATE_BACKEND_API_GROUP"
        );

    }


    if (
        new Set(
            actualGroupNames
        ).size
        !==
        actualGroupNames.length
    ) {

        throw new Error(
            "BACKEND_PLAN_DUPLICATE_API_CONTRACT_GROUP"
        );

    }


    for (
        const expectedGroup
        of expectedGroupNames
    ) {

        if (
            !actualGroupNames.includes(
                expectedGroup
            )
        ) {

            throw new Error(
                `BACKEND_PLAN_API_GROUP_MISSING:${expectedGroup}`
            );

        }

    }


    for (
        const actualGroup
        of actualGroupNames
    ) {

        if (
            !expectedGroupNames.includes(
                actualGroup
            )
        ) {

            throw new Error(
                `BACKEND_PLAN_UNEXPECTED_API_GROUP:${actualGroup}`
            );

        }

    }

}


// ============================================================
// MODULE ORDER
// ============================================================


function calculateModuleOrder(
    modules:
        BackendContract["modules"]
): string[] {

    const moduleIndex =
        new Map<
            string,
            number
        >();


    modules.forEach(
        (
            module,
            index
        ) => {

            moduleIndex.set(
                module.name,
                index
            );

        }
    );


    const indegree =
        new Map<
            string,
            number
        >();


    const dependents =
        new Map<
            string,
            string[]
        >();


    for (
        const module
        of modules
    ) {

        const dependencies =
            uniqueStrings(
                module.dependsOn
            );


        indegree.set(
            module.name,
            dependencies.length
        );


        dependents.set(
            module.name,
            []
        );

    }


    for (
        const module
        of modules
    ) {

        for (
            const dependency
            of uniqueStrings(
                module.dependsOn
            )
        ) {

            const children =
                dependents.get(
                    dependency
                );


            if (
                !children
            ) {

                throw new Error(
                    `BACKEND_PLAN_UNKNOWN_MODULE_DEPENDENCY:${module.name}:${dependency}`
                );

            }


            children.push(
                module.name
            );

        }

    }


    const ready =
        modules
            .filter(
                module =>
                    (
                        indegree.get(
                            module.name
                        )
                        ??
                        0
                    )
                    ===
                    0
            )
            .map(
                module =>
                    module.name
            );


    sortModuleNames(
        ready,
        moduleIndex
    );


    const result:
        string[] =
        [];


    while (
        ready.length > 0
    ) {

        const current =
            ready.shift();


        if (
            !current
        ) {

            break;

        }


        result.push(
            current
        );


        const children =
            dependents.get(
                current
            )
            ??
            [];


        for (
            const child
            of children
        ) {

            const nextIndegree =
                (
                    indegree.get(
                        child
                    )
                    ??
                    0
                )
                -
                1;


            indegree.set(
                child,
                nextIndegree
            );


            if (
                nextIndegree
                ===
                0
            ) {

                ready.push(
                    child
                );

            }

        }


        sortModuleNames(
            ready,
            moduleIndex
        );

    }


    if (
        result.length
        !==
        modules.length
    ) {

        const unresolved =
            modules
                .map(
                    module =>
                        module.name
                )
                .filter(
                    name =>
                        !result.includes(
                            name
                        )
                );


        throw new Error(
            `BACKEND_PLAN_MODULE_DEPENDENCY_CYCLE:${unresolved.join(",")}`
        );

    }


    return result;

}


// ============================================================
// MODULE DEPTH
// ============================================================


function calculateModuleDepths(
    modules:
        BackendContract["modules"],
    moduleOrder:
        string[]
): Map<string, number> {

    const moduleMap =
        new Map(
            modules.map(
                module => [
                    module.name,
                    module
                ]
            )
        );


    const depths =
        new Map<
            string,
            number
        >();


    for (
        const moduleName
        of moduleOrder
    ) {

        const module =
            moduleMap.get(
                moduleName
            );


        if (
            !module
        ) {

            throw new Error(
                `BACKEND_PLAN_MODULE_NOT_FOUND:${moduleName}`
            );

        }


        if (
            module.dependsOn.length
            ===
            0
        ) {

            depths.set(
                module.name,
                0
            );


            continue;

        }


        const dependencyDepths =
            uniqueStrings(
                module.dependsOn
            )
                .map(
                    dependency => {

                        const depth =
                            depths.get(
                                dependency
                            );


                        if (
                            depth
                            ===
                            undefined
                        ) {

                            throw new Error(
                                `BACKEND_PLAN_DEPENDENCY_DEPTH_MISSING:${module.name}:${dependency}`
                            );

                        }


                        return depth;

                    }
                );


        depths.set(
            module.name,
            Math.max(
                ...dependencyDepths
            )
            +
            1
        );

    }


    return depths;

}


// ============================================================
// TASK IDS
// ============================================================


function createModuleTaskIds(
    modules:
        BackendContract["modules"]
): Map<string, string> {

    const result =
        new Map<
            string,
            string
        >();


    const usedTaskIds =
        new Set<string>();


    for (
        const module
        of modules
    ) {

        const taskId =
            `module-${slugify(module.name)}`;


        if (
            usedTaskIds.has(
                taskId
            )
        ) {

            throw new Error(
                `BACKEND_PLAN_TASK_ID_COLLISION:${taskId}`
            );

        }


        usedTaskIds.add(
            taskId
        );


        result.set(
            module.name,
            taskId
        );

    }


    return result;

}


// ============================================================
// API DATA
// ============================================================


function collectModuleApiData(
    module:
        BackendModule,
    api:
        ApiContract
): {

    apiGroups:
        string[];

    requirementIds:
        string[];

    operationIds:
        string[];

} {

    const groupNames =
        module.apiGroups.map(
            group =>
                group.name
        );


    const groups =
        groupNames.map(
            groupName => {

                const group =
                    api.groups.find(
                        candidate =>
                            candidate.name
                            ===
                            groupName
                    );


                if (
                    !group
                ) {

                    throw new Error(
                        `BACKEND_PLAN_API_GROUP_MISSING:${module.name}:${groupName}`
                    );

                }


                if (
                    group.ownerModule
                    !==
                    module.name
                ) {

                    throw new Error(
                        `BACKEND_PLAN_API_GROUP_OWNER_MISMATCH:${groupName}`
                    );

                }


                return group;

            }
        );


    return {

        apiGroups:
            uniqueStrings(
                groupNames
            ),

        requirementIds:
            uniqueStrings(
                groups.flatMap(
                    group =>
                        group.endpoints.flatMap(
                            endpoint =>
                                endpoint.requirementIds
                        )
                )
            ),

        operationIds:
            uniqueStrings(
                groups.flatMap(
                    group =>
                        group.endpoints.map(
                            endpoint =>
                                endpoint.operationId
                        )
                )
            )

    };

}


// ============================================================
// TASK GRAPH VALIDATION
// ============================================================


function validateTaskGraph(
    tasks:
        BackendGenerationTask[]
): void {

    const taskIds =
        tasks.map(
            task =>
                task.id
        );


    if (
        new Set(
            taskIds
        ).size
        !==
        taskIds.length
    ) {

        throw new Error(
            "BACKEND_PLAN_DUPLICATE_TASK_ID"
        );

    }


    const taskMap =
        new Map(
            tasks.map(
                task => [
                    task.id,
                    task
                ]
            )
        );


    for (
        const task
        of tasks
    ) {

        for (
            const dependencyId
            of task.dependsOn
        ) {

            const dependency =
                taskMap.get(
                    dependencyId
                );


            if (
                !dependency
            ) {

                throw new Error(
                    `BACKEND_PLAN_UNKNOWN_TASK_DEPENDENCY:${task.id}:${dependencyId}`
                );

            }


            if (
                dependency.id
                ===
                task.id
            ) {

                throw new Error(
                    `BACKEND_PLAN_TASK_SELF_DEPENDENCY:${task.id}`
                );

            }


            if (
                dependency.phase
                >=
                task.phase
            ) {

                throw new Error(
                    `BACKEND_PLAN_INVALID_TASK_PHASE:${task.id}:${dependencyId}`
                );

            }

        }

    }

}


// ============================================================
// COMMAND PURPOSE SELECTION
// ============================================================


function commandNamesByPurpose(
    profile:
        BackendExecutionProfile,
    purposes:
        CommandPurpose[]
): string[] {

    const commands = [

        ...(
            profile.commands.bootstrap
            ??
            []
        ),

        ...profile.commands.setup,

        ...profile.commands.focusedValidation,

        ...profile.commands.fullValidation,

        ...(
            profile.commands.preview
                ?
                [
                    profile.commands.preview
                ]
                :
                []
        )

    ];


    const result:
        string[] =
        [];


    const seen =
        new Set<string>();


    for (
        const purpose
        of purposes
    ) {

        for (
            const command
            of commands
        ) {

            if (
                command.purpose
                !==
                purpose
            ) {

                continue;

            }


            const key =
                command.name
                    .trim()
                    .toLowerCase();


            if (
                seen.has(
                    key
                )
            ) {

                continue;

            }


            seen.add(
                key
            );


            result.push(
                command.name
            );

        }

    }


    return result;

}


// ============================================================
// HELPERS
// ============================================================


function sortModuleNames(
    names:
        string[],
    moduleIndex:
        Map<string, number>
): void {

    names.sort(
        (
            left,
            right
        ) => {

            return (
                moduleIndex.get(
                    left
                )
                ??
                Number.MAX_SAFE_INTEGER
            )
            -
            (
                moduleIndex.get(
                    right
                )
                ??
                Number.MAX_SAFE_INTEGER
            );

        }
    );

}


function assertTechnologySame(
    expected:
        string,
    actual:
        string,
    field:
        string
): void {

    if (
        normalizeTechnology(
            expected
        )
        !==
        normalizeTechnology(
            actual
        )
    ) {

        throw new Error(
            `BACKEND_PLAN_${field}_MISMATCH:${expected}:${actual}`
        );

    }

}


function normalizeTechnology(
    value:
        string
): string {

    return value
        .toLowerCase()
        .replace(
            /[^a-z0-9#+]/g,
            ""
        );

}


function uniqueStrings(
    values:
        string[]
): string[] {

    return [
        ...new Set(
            values
                .map(
                    value =>
                        value.trim()
                )
                .filter(
                    Boolean
                )
        )
    ];

}


function slugify(
    value:
        string
): string {

    const result =
        value
            .trim()
            .replace(
                /([a-z0-9])([A-Z])/g,
                "$1-$2"
            )
            .replace(
                /[^A-Za-z0-9]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            )
            .toLowerCase();


    if (
        !result
    ) {

        throw new Error(
            `BACKEND_PLAN_INVALID_MODULE_NAME:${value}`
        );

    }


    return result;

}
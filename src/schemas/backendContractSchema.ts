import { z } from "zod";


const apiGroupSchema =
    z.object({

        name:
            z.string()
                .min(1),

        routePrefix:
            z.string()
                .min(1),

        responsibility:
            z.string(),

        methods:
            z.array(
                z.string()
            )

    });


const backendModuleSchema =
    z.object({

        name:
            z.string()
                .min(1),

        responsibility:
            z.string(),

        dependsOn:
            z.array(
                z.string()
            ),

        apiGroups:
            z.array(
                apiGroupSchema
            )

    });


const functionalRequirementSchema =
    z.object({

        id:
            z.string()
                .min(1),

        title:
            z.string()
                .min(1),

        description:
            z.string(),

        priority:
            z.enum([
                "High",
                "Medium",
                "Low"
            ])

    });


const nonFunctionalRequirementSchema =
    z.object({

        category:
            z.string()
                .min(1),

        description:
            z.string()

    });


const entitySchema =
    z.object({

        name:
            z.string()
                .min(1),

        description:
            z.string()

    });


const storageResourceSchema =
    z.object({

        name:
            z.string()
                .min(1),

        kind:
            z.enum([
                "TABLE",
                "COLLECTION",
                "NODE",
                "KEY_SPACE"
            ])

    });


const storageRelationshipSchema =
    z.object({

        from:
            z.string()
                .min(1),

        to:
            z.string()
                .min(1),

        type:
            z.string()
                .min(1),

        description:
            z.string()

    });


export const backendContractSchema =
    z.object({

        projectName:
            z.string()
                .min(1),

        architectureStyle:
            z.string()
                .min(1),

        technology:
            z.object({

                language:
                    z.string()
                        .min(1),

                runtime:
                    z.string()
                        .min(1),

                framework:
                    z.string()
                        .min(1),

                packageManager:
                    z.string()
                        .min(1),

                dataAccessTechnology:
                    z.string()
                        .min(1),

                apiStyle:
                    z.string()
                        .min(1),

                testFramework:
                    z.string()
                        .min(1),

                buildTool:
                    z.string()
                        .min(1)

            }),

        database:
            z.object({

                model:
                    z.enum([
                        "RELATIONAL",
                        "DOCUMENT",
                        "GRAPH",
                        "KEY_VALUE"
                    ]),

                engine:
                    z.string()
                        .min(1),

                databaseName:
                    z.string()
                        .min(1),

                dataAccessTechnology:
                    z.string()
                        .min(1)

            }),

        cache:
            z.object({

                required:
                    z.boolean(),

                technology:
                    z.string(),

                useCases:
                    z.array(
                        z.string()
                    )

            }),

        authentication:
            z.object({

                required:
                    z.boolean(),

                strategy:
                    z.string(),

                description:
                    z.string()

            }),

        actors:
            z.array(
                z.string()
            ),

        functionalRequirements:
            z.array(
                functionalRequirementSchema
            ),

        nonFunctionalRequirements:
            z.array(
                nonFunctionalRequirementSchema
            ),

        entities:
            z.array(
                entitySchema
            ),

        constraints:
            z.array(
                z.string()
            ),

        assumptions:
            z.array(
                z.string()
            ),

        modules:
            z.array(
                backendModuleSchema
            )
                .min(1),

        storage:
            z.object({

                resources:
                    z.array(
                        storageResourceSchema
                    ),

                relationships:
                    z.array(
                        storageRelationshipSchema
                    )

            }),

        externalIntegrations:
            z.array(
                z.object({

                    name:
                        z.string()
                            .min(1),

                    purpose:
                        z.string(),

                    required:
                        z.boolean()

                })
            ),

        execution:
            z.object({

                profileId:
                    z.string()
                        .min(1),

                resolvedBy:
                    z.enum([
                        "BUILT_IN",
                        "DISCOVERED"
                    ]),

                sourceRoots:
                    z.array(
                        z.string()
                    ),

                testRoots:
                    z.array(
                        z.string()
                    ),

                dependencyFiles:
                    z.array(
                        z.string()
                    ),

                writablePathPatterns:
                    z.array(
                        z.string()
                    ),

                sharedPathPatterns:
                    z.array(
                        z.string()
                    ),

                protectedPathPatterns:
                    z.array(
                        z.string()
                    ),

                allowedExecutables:
                    z.array(
                        z.string()
                    )

            }),

        implementationRules:
            z.array(
                z.string()
            )
                .min(1)

    });


export type BackendContract =
    z.infer<
        typeof backendContractSchema
    >;
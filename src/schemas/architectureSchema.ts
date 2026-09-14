import { z } from "zod";


const backendModuleSchema =
    z.object({

        name:
            z.string(),

        responsibility:
            z.string(),

        dependsOn:
            z.array(
                z.string()
            )
            .default([])

    });


const frontendModuleSchema =
    z.object({

        name:
            z.string(),

        responsibility:
            z.string()

    });


const apiModuleSchema =
    z.object({

        name:
            z.string(),

        ownerModule:
            z.string(),

        routePrefix:
            z.string(),

        responsibility:
            z.string(),

        methods:
            z.array(
                z.string()
            )

    });


export const architectureSchema =
    z.object({

        projectName:
            z.string(),

        architectureStyle:
            z.string(),

        architectureReasoning:
            z.string(),

        backend:
            z.object({

                language:
                    z.string(),

                runtime:
                    z.string(),

                framework:
                    z.string(),

                packageManager:
                    z.string(),

                orm:
                    z.string(),

                apiStyle:
                    z.string(),

                testFramework:
                    z.string(),

                buildTool:
                    z.string(),

                modules:
                    z.array(
                        backendModuleSchema
                    )

            }),

        frontend:
            z.object({

                language:
                    z.string(),

                framework:
                    z.string(),

                styling:
                    z.string(),

                modules:
                    z.array(
                        frontendModuleSchema
                    )

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

        apiModules:
            z.array(
                apiModuleSchema
            ),

        externalIntegrations:
            z.array(
                z.object({

                    name:
                        z.string(),

                    purpose:
                        z.string(),

                    required:
                        z.boolean()

                })
            ),

        projectStructure:
            z.object({

                backend:
                    z.array(
                        z.string()
                    ),

                frontend:
                    z.array(
                        z.string()
                    )

            }),

        developmentPlan:
            z.array(
                z.object({

                    step:
                        z.number(),

                    task:
                        z.string(),

                    description:
                        z.string(),

                    dependsOn:
                        z.array(
                            z.number()
                        )

                })
            )

    });


export type ArchitectureDesign =
    z.infer<
        typeof architectureSchema
    >;
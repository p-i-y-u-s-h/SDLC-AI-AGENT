import {
    z
} from "zod";


export const commandPurposeSchema =
    z.enum([
        "BOOTSTRAP",
        "DEPENDENCY_INSTALL",
        "CODEGEN",
        "TYPECHECK",
        "SCHEMA_VALIDATE",
        "BUILD",
        "TEST",
        "PREVIEW"
    ]);


export const commandSpecSchema =
    z.object({

        name:
            z.string()
                .min(1),

        purpose:
            commandPurposeSchema,

        executable:
            z.string()
                .min(1),

        args:
            z.array(
                z.string()
            ),

        cwd:
            z.string()
                .min(1)
                .optional(),

        timeoutMs:
            z.number()
                .int()
                .positive()
                .max(
                    600000
                )
                .optional(),

        optional:
            z.boolean()
                .default(
                    false
                )

    });


const cacheExecutionSchema =
    z.object({

        required:
            z.boolean(),

        technology:
            z.string()
                .min(1)

    })
    .superRefine(
        (
            cache,
            ctx
        ) => {

            const normalized =
                cache.technology
                    .trim()
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9]/g,
                        ""
                    );


            const noCache =
                normalized
                ===
                "none"
                ||
                normalized
                ===
                "nocache"
                ||
                normalized
                ===
                "disabled";


            if (
                cache.required
                &&
                noCache
            ) {

                ctx.addIssue({
                    code:
                        "custom",

                    path: [
                        "technology"
                    ],

                    message:
                        "Cache is required but no concrete cache technology is configured."
                });

            }


            if (
                !cache.required
                &&
                !noCache
            ) {

                ctx.addIssue({
                    code:
                        "custom",

                    path: [
                        "technology"
                    ],

                    message:
                        "Cache is disabled but a concrete cache technology is configured."
                });

            }

        }
    );


export const backendScaffoldFileSchema =
    z.object({

        path:
            z.string()
                .min(1),

        content:
            z.string()

    });


export const backendScaffoldSpecSchema =
    z.object({

        directories:
            z.array(
                z.string()
                    .min(1)
            ),

        files:
            z.array(
                backendScaffoldFileSchema
            )

    });


export const backendExecutionProfileSchema =
    z.object({

        id:
            z.string()
                .min(1),

        resolvedBy:
            z.enum([
                "BUILT_IN",
                "DISCOVERED"
            ]),

        language:
            z.string()
                .min(1),

        framework:
            z.string()
                .min(1),

        runtime:
            z.string()
                .min(1)
                .optional(),

        packageManager:
            z.string()
                .min(1)
                .optional(),

        orm:
            z.string()
                .min(1)
                .optional(),

        databaseEngine:
            z.string()
                .min(1)
                .optional(),

        cache:
            cacheExecutionSchema,

        testFramework:
            z.string()
                .min(1),

        buildTool:
            z.string()
                .min(1),

        sourceRoots:
            z.array(
                z.string()
                    .min(1)
            ),

        testRoots:
            z.array(
                z.string()
                    .min(1)
            ),

        dependencyFiles:
            z.array(
                z.string()
                    .min(1)
            ),

        writablePathPatterns:
            z.array(
                z.string()
                    .min(1)
            ),

        sharedPathPatterns:
            z.array(
                z.string()
                    .min(1)
            ),

        protectedPathPatterns:
            z.array(
                z.string()
                    .min(1)
            ),

        allowedExecutables:
            z.array(
                z.string()
                    .min(1)
            ),

        commands:
            z.object({

                bootstrap:
                    z.array(
                        commandSpecSchema
                    )
                    .optional(),

                setup:
                    z.array(
                        commandSpecSchema
                    ),

                focusedValidation:
                    z.array(
                        commandSpecSchema
                    ),

                fullValidation:
                    z.array(
                        commandSpecSchema
                    ),

                preview:
                    commandSpecSchema
                        .optional()

            }),

        conventions:
            z.array(
                z.string()
                    .min(1)
            ),

        implementationGuidance:
            z.array(
                z.string()
                    .min(1)
            ),

        repairGuidance:
            z.array(
                z.string()
                    .min(1)
            ),

        scaffold:
            backendScaffoldSpecSchema
                .optional(),

        discovery:
            z.object({

                missingComponents:
                    z.array(
                        z.enum([
                            "APPLICATION",
                            "PERSISTENCE",
                            "CACHE",
                            "TEST",
                            "BUILD"
                        ])
                    ),

                knowledgeMode:
                    z.enum([
                        "MODEL_KNOWLEDGE",
                        "SUPPLIED_DOCUMENTATION"
                    ]),

                documentationSources:
                    z.array(
                        z.string()
                            .min(1)
                    )

            })
            .optional()

    })
    .superRefine(
        (
            profile,
            ctx
        ) => {

            if (
                profile.resolvedBy
                ===
                "DISCOVERED"
            ) {

                if (
                    !profile.scaffold
                ) {

                    ctx.addIssue({
                        code:
                            "custom",

                        path: [
                            "scaffold"
                        ],

                        message:
                            "DISCOVERED backend profiles require a scaffold specification."
                    });

                }


                if (
                    !profile.discovery
                ) {

                    ctx.addIssue({
                        code:
                            "custom",

                        path: [
                            "discovery"
                        ],

                        message:
                            "DISCOVERED backend profiles require discovery metadata."
                    });

                }

            }


            if (
                profile.resolvedBy
                ===
                "BUILT_IN"
                &&
                profile.discovery
            ) {

                ctx.addIssue({
                    code:
                        "custom",

                    path: [
                        "discovery"
                    ],

                    message:
                        "BUILT_IN backend profiles must not contain discovery metadata."
                });

            }

        }
    );


export type CommandPurpose =
    z.infer<
        typeof commandPurposeSchema
    >;


export type CommandSpec =
    z.infer<
        typeof commandSpecSchema
    >;


export type CacheExecution =
    z.infer<
        typeof cacheExecutionSchema
    >;


export type BackendScaffoldSpec =
    z.infer<
        typeof backendScaffoldSpecSchema
    >;


export type BackendExecutionProfile =
    z.infer<
        typeof backendExecutionProfileSchema
    >;
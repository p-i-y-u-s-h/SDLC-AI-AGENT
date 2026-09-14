import {
    z
} from "zod";

import {
    commandSpecSchema,
    backendScaffoldSpecSchema
} from "./backendExecutionProfileSchema.js";


const supportedDiscoverySchema =
    z.object({

        status:
            z.literal(
                "SUPPORTED"
            ),

        reason:
            z.string()
                .min(1),

        knowledgeMode:
            z.enum([
                "MODEL_KNOWLEDGE",
                "SUPPLIED_DOCUMENTATION"
            ]),

        documentationSources:
            z.array(
                z.string()
                    .min(1)
            ),

        sourceRoots:
            z.array(
                z.string()
                    .min(1)
            )
            .min(1),

        testRoots:
            z.array(
                z.string()
                    .min(1)
            ),

        dependencyFiles:
            z.array(
                z.string()
                    .min(1)
            )
            .min(1),

        writablePathPatterns:
            z.array(
                z.string()
                    .min(1)
            )
            .min(1),

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

    });


const incompatibleDiscoverySchema =
    z.object({

        status:
            z.literal(
                "INCOMPATIBLE"
            ),

        reason:
            z.string()
                .min(1)

    });


export const stackDiscoveryResultSchema =
    z.discriminatedUnion(
        "status",
        [
            supportedDiscoverySchema,
            incompatibleDiscoverySchema
        ]
    );


export type StackDiscoveryResult =
    z.infer<
        typeof stackDiscoveryResultSchema
    >;
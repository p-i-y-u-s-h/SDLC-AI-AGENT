import { z } from "zod";


function validateLockState(
    choice: {
        source:
            "USER_EXPLICIT"
            |
            "ARCHITECTURE_AGENT";

        locked:
            boolean;
    },

    ctx:
        z.RefinementCtx
) {

    if (
        choice.source
        ===
        "USER_EXPLICIT"
        &&
        !choice.locked
    ) {

        ctx.addIssue({
            code:
                "custom",

            message:
                "USER_EXPLICIT technology must be locked."
        });

    }


    if (
        choice.source
        ===
        "ARCHITECTURE_AGENT"
        &&
        choice.locked
    ) {

        ctx.addIssue({
            code:
                "custom",

            message:
                "ARCHITECTURE_AGENT technology must not be locked."
        });

    }

}


const technologyChoiceSchema =
    z.object({

        value:
            z.string()
                .min(1),

        source:
            z.enum([
                "USER_EXPLICIT",
                "ARCHITECTURE_AGENT"
            ]),

        locked:
            z.boolean()

    })
    .superRefine(
        validateLockState
    );


const storageModelChoiceSchema =
    z.object({

        value:
            z.enum([
                "RELATIONAL",
                "DOCUMENT",
                "GRAPH",
                "KEY_VALUE"
            ]),

        source:
            z.enum([
                "USER_EXPLICIT",
                "ARCHITECTURE_AGENT"
            ]),

        locked:
            z.boolean()

    })
    .superRefine(
        validateLockState
    );


export const technologyManifestSchema =
    z.object({

        projectName:
            z.string()
                .min(1),

        backend:
            z.object({

                language:
                    technologyChoiceSchema,

                runtime:
                    technologyChoiceSchema,

                framework:
                    technologyChoiceSchema,

                packageManager:
                    technologyChoiceSchema,

                orm:
                    technologyChoiceSchema,

                apiStyle:
                    technologyChoiceSchema,

                testFramework:
                    technologyChoiceSchema,

                buildTool:
                    technologyChoiceSchema

            }),

        database:
            z.object({

                model:
                    storageModelChoiceSchema,

                engine:
                    technologyChoiceSchema

            }),

        cache:
            z.object({

                required:
                    z.boolean(),

                technology:
                    technologyChoiceSchema

            })
            .superRefine(
                (
                    cache,
                    ctx
                ) => {

                    const normalized =
                        cache.technology.value
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
                                "Cache is required but no concrete cache technology is selected."
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
                                "Cache is disabled but a concrete cache technology is selected."
                        });

                    }

                }
            ),

        frontend:
            z.object({

                language:
                    technologyChoiceSchema,

                framework:
                    technologyChoiceSchema,

                styling:
                    technologyChoiceSchema

            })

    });


export type TechnologyManifestSchema =
    z.infer<
        typeof technologyManifestSchema
    >;
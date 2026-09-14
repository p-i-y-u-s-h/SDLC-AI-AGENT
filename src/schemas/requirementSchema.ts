import { z } from "zod";


export const capabilityGroupSchema =
    z.object({
        id:
            z.string()
                .min(1),
        name:
            z.string()
                .min(1),
        description:
            z.string()
                .default(""),
        requirementIds:
            z.array(
                z.string().min(1)
            )
            .default([])
    });


export type CapabilityGroup =
    z.infer<
        typeof capabilityGroupSchema
    >;


export const requirementSchema =
    z.object({

        projectName:
            z.string(),

        projectDescription:
            z.string(),

        objective:
            z.string(),

        actors:
            z.array(
                z.string()
            ),

        capabilityGroups:
            z.array(
                capabilityGroupSchema
            )
            .default([]),

        functionalRequirements:
            z.array(
                z.object({

                    id:
                        z.string(),

                    title:
                        z.string(),

                    description:
                        z.string(),

                    priority:
                        z.enum([
                            "High",
                            "Medium",
                            "Low"
                        ])

                })
            ),

        nonFunctionalRequirements:
            z.array(
                z.object({

                    category:
                        z.string(),

                    description:
                        z.string()

                })
            ),

        modules:
            z.array(
                z.object({

                    name:
                        z.string(),

                    description:
                        z.string()

                })
            ),

        entities:
            z.array(
                z.object({

                    name:
                        z.string(),

                    description:
                        z.string()

                })
            ),

        assumptions:
            z.array(
                z.string()
            )
            .default([]),

        constraints:
            z.array(
                z.string()
            )
            .default([]),

        ambiguities:
            z.array(
                z.string()
            )
            .default([]),

        technologyConstraints:
            z.array(
                z.object({

                    key:
                        z.string(),

                    value:
                        z.string(),

                    locked:
                        z.boolean()

                })
            )
            .default([])

    });


export type RequirementAnalysis =
    z.infer<
        typeof requirementSchema
    >;
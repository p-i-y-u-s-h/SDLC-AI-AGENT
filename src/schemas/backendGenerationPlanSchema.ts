import {
    z
} from "zod";


export const backendGenerationTaskKindSchema =
    z.enum([
        "SCAFFOLD",
        "STORAGE",
        "CACHE",
        "MODULE",
        "INTEGRATION",
        "TEST",
        "VALIDATION"
    ]);


export const backendArtifactRoleSchema =
    z.enum([
        "PROJECT_CONFIG",
        "APP_BOOTSTRAP",

        "DATABASE_SCHEMA",
        "DATABASE_CLIENT",

        "CACHE_CONFIG",
        "CACHE_CLIENT",

        "AUTH_MIDDLEWARE",

        "MODULE_ROUTE",
        "MODULE_CONTROLLER",
        "MODULE_SERVICE",
        "MODULE_DATA_ACCESS",
        "MODULE_VALIDATION",
        "MODULE_TEST",

        "INTEGRATION_ADAPTER"
    ]);


export const backendGenerationTaskSchema =
    z.object({

        id:
            z.string()
                .min(1),

        phase:
            z.number()
                .int()
                .positive(),

        module:
            z.string()
                .min(1)
                .nullable(),

        kind:
            backendGenerationTaskKindSchema,

        description:
            z.string()
                .min(1),

        dependsOn:
            z.array(
                z.string()
                    .min(1)
            ),

        requirementIds:
            z.array(
                z.string()
                    .min(1)
            ),

        operationIds:
            z.array(
                z.string()
                    .min(1)
            ),

        apiGroups:
            z.array(
                z.string()
                    .min(1)
            ),

        storageResources:
            z.array(
                z.string()
                    .min(1)
            ),

        externalIntegrations:
            z.array(
                z.string()
                    .min(1)
            ),

        targetRoles:
            z.array(
                backendArtifactRoleSchema
            ),

        validationCommandNames:
            z.array(
                z.string()
                    .min(1)
            )

    });


export const backendGenerationPlanSchema =
    z.object({

        projectName:
            z.string()
                .min(1),

        profileId:
            z.string()
                .min(1),

        moduleOrder:
            z.array(
                z.string()
                    .min(1)
            ),

        phaseCount:
            z.number()
                .int()
                .positive(),

        tasks:
            z.array(
                backendGenerationTaskSchema
            )
                .min(1)

    });


export type BackendGenerationTaskKind =
    z.infer<
        typeof backendGenerationTaskKindSchema
    >;


export type BackendArtifactRole =
    z.infer<
        typeof backendArtifactRoleSchema
    >;


export type BackendGenerationTask =
    z.infer<
        typeof backendGenerationTaskSchema
    >;


export type BackendGenerationPlan =
    z.infer<
        typeof backendGenerationPlanSchema
    >;

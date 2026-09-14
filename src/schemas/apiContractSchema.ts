import { z } from "zod";


export const apiHttpMethodSchema =
    z.enum([
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE"
    ]);


const apiPrimitiveTypeSchema =
    z.enum([
        "STRING",
        "INTEGER",
        "NUMBER",
        "BOOLEAN"
    ]);


const apiFieldTypeSchema =
    z.enum([
        "STRING",
        "INTEGER",
        "NUMBER",
        "BOOLEAN",
        "OBJECT",
        "ARRAY",
        "BINARY"
    ]);


const apiArrayItemSchema =
    z.object({

        type:
            z.enum([
                "STRING",
                "INTEGER",
                "NUMBER",
                "BOOLEAN",
                "OBJECT"
            ]),

        format:
            z.string()
                .nullable()
                .default(null),

        schemaRef:
            z.string()
                .min(1)
                .nullable()
                .default(null)

    });


const apiFieldSchema =
    z.object({

        name:
            z.string()
                .min(1),

        type:
            apiFieldTypeSchema,

        required:
            z.boolean(),

        nullable:
            z.boolean(),

        description:
            z.string(),

        format:
            z.string()
                .nullable()
                .default(null),

        schemaRef:
            z.string()
                .min(1)
                .nullable()
                .default(null),

        items:
            apiArrayItemSchema
                .nullable()
                .default(null),

        enumValues:
            z.array(
                z.string()
            )
                .default([])

    });


const apiObjectSchema =
    z.object({

        name:
            z.string()
                .min(1),

        description:
            z.string(),

        fields:
            z.array(
                apiFieldSchema
            )

    });


const apiParameterSchema =
    z.object({

        name:
            z.string()
                .min(1),

        type:
            apiPrimitiveTypeSchema,

        required:
            z.boolean(),

        description:
            z.string(),

        format:
            z.string()
                .nullable()
                .default(null)

    });


const apiAuthSchema =
    z.object({

        required:
            z.boolean(),

        roles:
            z.array(
                z.string()
                    .min(1)
            )
                .default([])

    });


const apiRequestBodySchema =
    z.object({

        required:
            z.boolean(),

        contentType:
            z.enum([
                "application/json",
                "multipart/form-data"
            ]),

        schemaRef:
            z.string()
                .min(1)

    });


const apiResponseSchema =
    z.object({

        statusCode:
            z.number()
                .int()
                .min(100)
                .max(599),

        description:
            z.string(),

        schemaRef:
            z.string()
                .min(1)
                .nullable()
                .default(null)

    });


const apiPaginationSchema =
    z.object({

        strategy:
            z.enum([
                "OFFSET",
                "CURSOR"
            ]),

        defaultLimit:
            z.number()
                .int()
                .positive(),

        maxLimit:
            z.number()
                .int()
                .positive()

    });


const apiEndpointSchema =
    z.object({

        operationId:
            z.string()
                .min(1),

        requirementIds:
            z.array(
                z.string()
                    .min(1)
            )
                .default([]),

        method:
            apiHttpMethodSchema,

        path:
            z.string()
                .min(1),

        summary:
            z.string()
                .min(1),

        description:
            z.string(),

        auth:
            apiAuthSchema,

        pathParameters:
            z.array(
                apiParameterSchema
            )
                .default([]),

        queryParameters:
            z.array(
                apiParameterSchema
            )
                .default([]),

        requestBody:
            apiRequestBodySchema
                .nullable()
                .default(null),

        responses:
            z.array(
                apiResponseSchema
            )
                .min(1),

        pagination:
            apiPaginationSchema
                .nullable()
                .default(null),

        businessRules:
            z.array(
                z.string()
            )
                .default([])

    });


const apiGroupSchema =
    z.object({

        name:
            z.string()
                .min(1),

        ownerModule:
            z.string()
                .min(1),

        routePrefix:
            z.string()
                .min(1),

        endpoints:
            z.array(
                apiEndpointSchema
            )
                .min(1)

    });


const apiErrorCodeSchema =
    z.object({

        code:
            z.string()
                .min(1),

        httpStatus:
            z.number()
                .int()
                .min(400)
                .max(599),

        description:
            z.string()

    });


const apiErrorModelSchema =
    z.object({

        schemaRef:
            z.string()
                .min(1),

        codes:
            z.array(
                apiErrorCodeSchema
            )
                .min(1)

    });


export const apiContractSchema =
    z.object({

        projectName:
            z.string()
                .min(1),

        apiStyle:
            z.literal(
                "REST"
            ),

        authentication:
            z.object({

                required:
                    z.boolean(),

                strategy:
                    z.string()
                        .min(1),

                roles:
                    z.array(
                        z.string()
                            .min(1)
                    )

            }),

        schemas:
            z.array(
                apiObjectSchema
            ),

        groups:
            z.array(
                apiGroupSchema
            )
                .min(1),

        errorModel:
            apiErrorModelSchema

    });


export type ApiContract =
    z.infer<
        typeof apiContractSchema
    >;
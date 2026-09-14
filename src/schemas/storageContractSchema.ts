import { z } from "zod";

import type {
    StorageJsonValue
} from "../types/storage.js";


const defaultValueSchema =
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null()
    ]);


const jsonValueSchema:
    z.ZodType<StorageJsonValue> =
    z.lazy(
        () =>
            z.union([
                z.string(),
                z.number(),
                z.boolean(),
                z.null(),

                z.array(
                    jsonValueSchema
                ),

                z.record(
                    z.string(),
                    jsonValueSchema
                )
            ])
    );


const storageIndexSchema =
    z.object({

        name:
            z.string()
                .min(1),

        fields:
            z.array(
                z.string()
                    .min(1)
            )
                .min(1),

        unique:
            z.boolean(),

        purpose:
            z.string()

    });


const commonStorageFields = {

    projectName:
        z.string()
            .min(1),

    engine:
        z.string()
            .min(1),

    databaseName:
        z.string()
            .min(1),

    dataAccessTechnology:
        z.string()
            .min(1)

};


const relationalColumnSchema =
    z.object({

        name:
            z.string()
                .min(1),

        type:
            z.string()
                .min(1),

        nullable:
            z.boolean(),

        primaryKey:
            z.boolean(),

        unique:
            z.boolean(),

        defaultValue:
            defaultValueSchema

    });


const relationalTableSchema =
    z.object({

        name:
            z.string()
                .min(1),

        description:
            z.string(),

        columns:
            z.array(
                relationalColumnSchema
            )
                .min(1),

        indexes:
            z.array(
                storageIndexSchema
            )
                .default([])

    });


const relationalRelationshipSchema =
    z.object({

        fromTable:
            z.string()
                .min(1),

        fromColumn:
            z.string()
                .min(1),

        toTable:
            z.string()
                .min(1),

        toColumn:
            z.string()
                .min(1),

        type:
            z.enum([
                "one-to-one",
                "one-to-many",
                "many-to-one",
                "many-to-many"
            ]),

        onDelete:
            z.enum([
                "CASCADE",
                "RESTRICT",
                "SET_NULL",
                "NO_ACTION"
            ]),

        description:
            z.string()

    });


const relationalStorageSchema =
    z.object({

        ...commonStorageFields,

        model:
            z.literal(
                "RELATIONAL"
            ),

        design:
            z.object({

                tables:
                    z.array(
                        relationalTableSchema
                    )
                        .min(1),

                relationships:
                    z.array(
                        relationalRelationshipSchema
                    )
                        .default([]),

                normalization:
                    z.object({

                        normalForm:
                            z.string()
                                .min(1),

                        explanation:
                            z.string()

                    })

            })

    });


const documentFieldSchema =
    z.object({

        name:
            z.string()
                .min(1),

        type:
            z.string()
                .min(1),

        required:
            z.boolean(),

        unique:
            z.boolean(),

        defaultValue:
            jsonValueSchema

    });


const documentCollectionSchema =
    z.object({

        name:
            z.string()
                .min(1),

        description:
            z.string(),

        fields:
            z.array(
                documentFieldSchema
            )
                .min(1),

        indexes:
            z.array(
                storageIndexSchema
            )
                .default([])

    });


const documentRelationshipSchema =
    z.object({

        fromCollection:
            z.string()
                .min(1),

        toCollection:
            z.string()
                .min(1),

        strategy:
            z.enum([
                "REFERENCE",
                "EMBEDDED"
            ]),

        field:
            z.string()
                .min(1),

        description:
            z.string()

    });


const documentStorageSchema =
    z.object({

        ...commonStorageFields,

        model:
            z.literal(
                "DOCUMENT"
            ),

        design:
            z.object({

                collections:
                    z.array(
                        documentCollectionSchema
                    )
                        .min(1),

                relationships:
                    z.array(
                        documentRelationshipSchema
                    )
                        .default([])

            })

    });


const graphPropertySchema =
    z.object({

        name:
            z.string()
                .min(1),

        type:
            z.string()
                .min(1),

        required:
            z.boolean(),

        unique:
            z.boolean()

    });


const graphNodeSchema =
    z.object({

        label:
            z.string()
                .min(1),

        description:
            z.string(),

        properties:
            z.array(
                graphPropertySchema
            )
                .min(1),

        indexes:
            z.array(
                storageIndexSchema
            )
                .default([])

    });


const graphRelationshipSchema =
    z.object({

        type:
            z.string()
                .min(1),

        fromNode:
            z.string()
                .min(1),

        toNode:
            z.string()
                .min(1),

        description:
            z.string(),

        properties:
            z.array(
                graphPropertySchema
            )
                .default([])

    });


const graphStorageSchema =
    z.object({

        ...commonStorageFields,

        model:
            z.literal(
                "GRAPH"
            ),

        design:
            z.object({

                nodes:
                    z.array(
                        graphNodeSchema
                    )
                        .min(1),

                relationships:
                    z.array(
                        graphRelationshipSchema
                    )
                        .default([]),

                constraints:
                    z.array(
                        z.string()
                    )
                        .default([])

            })

    });


const keyValueFieldSchema =
    z.object({

        name:
            z.string()
                .min(1),

        type:
            z.string()
                .min(1),

        required:
            z.boolean()

    });


const keySpaceSchema =
    z.object({

        name:
            z.string()
                .min(1),

        keyPattern:
            z.string()
                .min(1),

        description:
            z.string(),

        valueType:
            z.string()
                .min(1),

        valueFields:
            z.array(
                keyValueFieldSchema
            ),

        ttlSeconds:
            z.number()
                .int()
                .positive()
                .nullable()

    });


const keyValueAccessPatternSchema =
    z.object({

        name:
            z.string()
                .min(1),

        keySpace:
            z.string()
                .min(1),

        operation:
            z.string()
                .min(1),

        description:
            z.string()

    });


const keyValueStorageSchema =
    z.object({

        ...commonStorageFields,

        model:
            z.literal(
                "KEY_VALUE"
            ),

        design:
            z.object({

                keySpaces:
                    z.array(
                        keySpaceSchema
                    )
                        .min(1),

                accessPatterns:
                    z.array(
                        keyValueAccessPatternSchema
                    )
                        .default([])

            })

    });


export const storageContractSchema =
    z.discriminatedUnion(
        "model",
        [

            relationalStorageSchema,

            documentStorageSchema,

            graphStorageSchema,

            keyValueStorageSchema

        ]
    );


export type StorageContractSchema =
    z.infer<
        typeof storageContractSchema
    >;
import type {
    StorageModel
} from "../types/technology.js";


interface StorageMetadata {

    projectName: string;

    model: StorageModel;

    engine: string;

    databaseName: string;

    dataAccessTechnology: string;

}


export function normalizeStorageOutput(
    input: any,
    metadata: StorageMetadata
) {

    const design =
        extractDesign(
            input,
            metadata.model
        );


    const normalizedDesign =
        normalizeDesign(
            design,
            metadata.model
        );


    return {

        projectName:
            metadata.projectName,

        model:
            metadata.model,

        engine:
            metadata.engine,

        databaseName:
            metadata.databaseName,

        dataAccessTechnology:
            metadata.dataAccessTechnology,

        design:
            normalizedDesign

    };

}


function extractDesign(
    input: any,
    model: StorageModel
) {

    if (
        input?.design
        &&
        typeof input.design === "object"
    ) {

        return structuredClone(
            input.design
        );

    }


    if (
        model === "RELATIONAL"
        &&
        input?.relational
    ) {

        return structuredClone(
            input.relational
        );

    }


    if (
        model === "DOCUMENT"
        &&
        input?.document
    ) {

        return structuredClone(
            input.document
        );

    }


    if (
        model === "GRAPH"
        &&
        input?.graph
    ) {

        return structuredClone(
            input.graph
        );

    }


    if (
        model === "KEY_VALUE"
    ) {

        return structuredClone(
            input?.keyValue
            ??
            input?.key_value
            ??
            input
        );

    }


    return structuredClone(
        input
    );

}


function normalizeDesign(
    design: any,
    model: StorageModel
) {

    switch (
        model
    ) {

        case "RELATIONAL":

            return normalizeRelationalDesign(
                design
            );


        case "DOCUMENT":

            return normalizeDocumentDesign(
                design
            );


        case "GRAPH":

            return normalizeGraphDesign(
                design
            );


        case "KEY_VALUE":

            return normalizeKeyValueDesign(
                design
            );


        default:

            return design;

    }

}


function normalizeRelationalDesign(
    design: any
) {

    if (
        !design
        ||
        typeof design !== "object"
    ) {

        return design;

    }


    if (
        Array.isArray(
            design.relationships
        )
    ) {

        design.relationships =
            design.relationships.map(
                (
                    relationship: any
                ) => ({

                    ...relationship,

                    type:
                        inferRelationalRelationshipType(
                            design,
                            relationship
                        ),

                    onDelete:
                        normalizeOnDelete(
                            relationship?.onDelete
                        )

                })
            );

    }


    return design;

}


function inferRelationalRelationshipType(
    design: any,
    relationship: any
) {

    if (
        !Array.isArray(
            design?.tables
        )
    ) {

        return normalizeRelationalRelationshipType(
            relationship?.type
        );

    }


    const fromTable =
        design.tables.find(
            (
                table: any
            ) =>
                table?.name ===
                relationship?.fromTable
        );


    if (
        !fromTable
        ||
        !Array.isArray(
            fromTable.columns
        )
    ) {

        return normalizeRelationalRelationshipType(
            relationship?.type
        );

    }


    const fromColumn =
        fromTable.columns.find(
            (
                column: any
            ) =>
                column?.name ===
                relationship?.fromColumn
        );


    if (
        !fromColumn
    ) {

        return normalizeRelationalRelationshipType(
            relationship?.type
        );

    }


    if (
        fromColumn.unique === true
    ) {

        return "one-to-one";

    }


    return "many-to-one";

}


function normalizeDocumentDesign(
    design: any
) {

    if (
        !design
        ||
        typeof design !== "object"
    ) {

        return design;

    }


    if (
        Array.isArray(
            design.relationships
        )
    ) {

        design.relationships =
            design.relationships.map(
                (
                    relationship: any
                ) => ({

                    ...relationship,

                    strategy:
                        normalizeDocumentStrategy(
                            relationship?.strategy
                        )

                })
            );

    }


    return design;

}


function normalizeGraphDesign(
    design: any
) {

    return design;

}


function normalizeKeyValueDesign(
    design: any
) {

    return design;

}


function normalizeOnDelete(
    value: unknown
) {

    if (
        typeof value !== "string"
    ) {

        return value;

    }


    const normalized =
        normalizeEnumValue(
            value
        );


    switch (
        normalized
    ) {

        case "CASCADE":

            return "CASCADE";


        case "RESTRICT":

            return "RESTRICT";


        case "SETNULL":

            return "SET_NULL";


        case "NOACTION":

            return "NO_ACTION";


        default:

            return value;

    }

}


function normalizeRelationalRelationshipType(
    value: unknown
) {

    if (
        typeof value !== "string"
    ) {

        return value;

    }


    const normalized =
        normalizeEnumValue(
            value
        );


    switch (
        normalized
    ) {

        case "ONETOONE":

            return "one-to-one";


        case "ONETOMANY":

            return "one-to-many";


        case "MANYTOONE":

            return "many-to-one";


        case "MANYTOMANY":

            return "many-to-many";


        default:

            return value;

    }

}


function normalizeDocumentStrategy(
    value: unknown
) {

    if (
        typeof value !== "string"
    ) {

        return value;

    }


    const normalized =
        normalizeEnumValue(
            value
        );


    switch (
        normalized
    ) {

        case "REFERENCE":
        case "REFERENCED":
        case "REF":

            return "REFERENCE";


        case "EMBED":
        case "EMBEDDED":

            return "EMBEDDED";


        default:

            return value;

    }

}


function normalizeEnumValue(
    value: string
) {

    return value
        .trim()
        .toUpperCase()
        .replace(
            /[^A-Z0-9]/g,
            ""
        );

}
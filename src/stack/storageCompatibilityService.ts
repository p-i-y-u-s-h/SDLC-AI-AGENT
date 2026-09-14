import type {
    StorageModel,
    TechnologyManifest
} from "../types/technology.js";


const knownStorageEngines:
    Record<
        string,
        StorageModel
    > = {

    // ========================================================
    // RELATIONAL
    // ========================================================

    postgresql:
        "RELATIONAL",

    postgres:
        "RELATIONAL",

    mysql:
        "RELATIONAL",

    mariadb:
        "RELATIONAL",

    sqlite:
        "RELATIONAL",

    sqlserver:
        "RELATIONAL",

    mssql:
        "RELATIONAL",

    oracle:
        "RELATIONAL",


    // ========================================================
    // DOCUMENT
    // ========================================================

    mongodb:
        "DOCUMENT",

    couchdb:
        "DOCUMENT",

    couchbase:
        "DOCUMENT",

    firestore:
        "DOCUMENT",


    // ========================================================
    // GRAPH
    // ========================================================

    neo4j:
        "GRAPH",

    memgraph:
        "GRAPH",


    // ========================================================
    // KEY VALUE
    // ========================================================

    redis:
        "KEY_VALUE",

    valkey:
        "KEY_VALUE"

};


const genericStorageNames =
    new Set([

        "relational",
        "relationaldatabase",

        "sql",
        "sqldatabase",

        "nosql",

        "document",
        "documentdatabase",

        "nosqldocument",
        "nosqldocumentdatabase",

        "graph",
        "graphdatabase",

        "keyvalue",
        "keyvaluedatabase"

    ]);


export function validateStorageCompatibility(
    manifest: TechnologyManifest
) {

    const model =
        manifest.database.model.value;


    const engine =
        manifest.database.engine.value;


    const normalizedEngine =
        normalizeTechnology(
            engine
        );


    // ========================================================
    // ENGINE MUST BE CONCRETE
    // ========================================================

    if (
        genericStorageNames.has(
            normalizedEngine
        )
    ) {

        throw new Error(
            `STORAGE_ENGINE_NOT_CONCRETE: "${engine}" is a storage category, not a concrete database engine.`
        );

    }


    // ========================================================
    // KNOWN ENGINE MODEL VALIDATION
    // ========================================================

    const expectedModel =
        knownStorageEngines[
            normalizedEngine
        ];


    // Unknown engines are allowed.
    //
    // Later the Stack Execution Resolver can discover
    // execution/setup information for technologies that
    // are not hard-coded here.

    if (
        !expectedModel
    ) {

        return;

    }


    if (
        expectedModel === model
    ) {

        return;

    }


    throw new Error(
        `STORAGE_MODEL_ENGINE_MISMATCH: "${engine}" requires storage model "${expectedModel}" but Architecture selected "${model}".`
    );

}


function normalizeTechnology(
    value: string
): string {

    return String(
        value
    )
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9]/g,
            ""
        );
}
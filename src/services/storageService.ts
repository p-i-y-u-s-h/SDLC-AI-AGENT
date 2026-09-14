import path from "path";

import {
    storageAgent
} from "../agent/storageAgent.js";

import {
    requirementSchema
} from "../schemas/requirementSchema.js";

import {
    architectureSchema
} from "../schemas/architectureSchema.js";

import {
    technologyManifestSchema
} from "../schemas/technologyManifestSchema.js";

import {
    storageContractSchema
} from "../schemas/storageContractSchema.js";

import {
    readJSON,
    writeJSON,
    extractJSON,
    getMessageText
} from "../utils/fileManager.js";

import {
    normalizeStorageOutput
} from "./storageNormalizationService.js";

import {
    recordTokenUsage
} from "../utils/tokenTracker.js";

import {
    withProviderRetry
} from "../utils/providerRetry.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";


export async function generateStorageContract(
    workspace: ProjectWorkspace
) {

    const requirements =
        requirementSchema.parse(
            readJSON(
                workspace.requirements
            )
        );


    const architecture =
        architectureSchema.parse(
            readJSON(
                workspace.architecture
            )
        );


    const manifest =
        technologyManifestSchema.parse(
            readJSON(
                workspace.technologyManifest
            )
        );


    const result =
        await withProviderRetry(
            () =>
                storageAgent.invoke({
                    messages: [
                        {
                            role: "user",
                            content: `
Design the physical storage model for this project.

PROJECT REQUIREMENTS:

${JSON.stringify(
    requirements,
    null,
    2
)}

SELECTED STORAGE:

${JSON.stringify(
    {
        model: manifest.database.model.value,
        engine: manifest.database.engine.value,
        databaseName: architecture.database.databaseName,
        dataAccessTechnology: manifest.backend.orm.value
    },
    null,
    2
)}

The selected storage model, database engine and data-access
technology are authoritative.

Return only valid JSON.
`
                        }
                    ]
                }),
            { operationName: "Storage Design Agent", maxAttempts: 5 }
        );


    recordTokenUsage(
        workspace,
        "Storage Design Agent",
        result,
        process.env.GEMINI_MODEL || "gemini-flash-latest"
    );


    const response =
        result.messages[
            result.messages.length - 1
        ];


    const rawStorage =
        extractJSON(
            getMessageText(
                response.content
            )
        );


    const rawPath =
        path.join(
            workspace.outputDir,
            "storage-contract.raw.json"
        );


    writeJSON(
        rawPath,
        rawStorage
    );


    const normalized =
        normalizeStorageOutput(
            rawStorage,
            {
                projectName:
                    requirements.projectName,

                model:
                    manifest.database.model.value,

                engine:
                    manifest.database.engine.value,

                databaseName:
                    architecture.database.databaseName,

                dataAccessTechnology:
                    manifest.backend.orm.value
            }
        );


    const storageContract =
        storageContractSchema.parse(
            normalized
        );


    writeJSON(
        workspace.storageContract,
        storageContract
    );


    console.log(
        `✅ ${workspace.storageContract} created`
    );


    return storageContract;
}
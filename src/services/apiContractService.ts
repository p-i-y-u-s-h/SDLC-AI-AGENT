import {
    apiContractAgent
} from "../agent/apiContractAgent.js";

import {
    apiContractSchema
} from "../schemas/apiContractSchema.js";

import {
    backendContractSchema
} from "../schemas/backendContractSchema.js";

import {
    storageContractSchema
} from "../schemas/storageContractSchema.js";

import {
    extractJSON,
    readJSON,
    writeJSON
} from "../utils/fileManager.js";

import {
    recordTokenUsage
} from "../utils/tokenTracker.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";

import {
    buildApiContractContext
} from "./apiContractContextService.js";

import {
    normalizeApiContractOutput
} from "./apiContractNormalizationService.js";

import {
    validateApiContract
} from "./apiContractValidationService.js";

import {
    withProviderRetry
} from "../utils/providerRetry.js";


export async function generateApiContract(
    workspace:
        ProjectWorkspace
) {

    const backend =
        backendContractSchema.parse(
            readJSON(
                workspace.backendContract
            )
        );


    const storage =
        storageContractSchema.parse(
            readJSON(
                workspace.storageContract
            )
        );


    if (
        backend.projectName
        !==
        storage.projectName
    ) {

        throw new Error(
            "API_INPUT_PROJECT_MISMATCH"
        );

    }


    const context =
        buildApiContractContext(
            backend,
            storage
        );


    const apiGroupCount =
        backend.modules.reduce(
            (
                total,
                module
            ) =>
                total
                +
                module.apiGroups.length,
            0
        );


    console.log(
        `API Context: ${backend.modules.length} modules | ${apiGroupCount} API groups | ${backend.functionalRequirements.length} requirements`
    );


    const result =
        await withProviderRetry(
            () =>
                apiContractAgent.invoke({
                    messages: [
                        {
                            role: "user",
                            content: JSON.stringify(context)
                        }
                    ]
                }),
            { operationName: "API Contract Agent", maxAttempts: 5 }
        );


    recordTokenUsage(
        workspace,
        "API Contract Agent",
        result,
        process.env.GEMINI_MODEL || "gemini-flash-latest"
    );


    if (
        !Array.isArray(
            result.messages
        )
        ||
        result.messages.length === 0
    ) {

        throw new Error(
            "API_CONTRACT_AGENT_NO_MESSAGES"
        );

    }


    const response =
        result.messages[
            result.messages.length - 1
        ];


    const content =
        getMessageText(
            response.content
        );


    if (
        !content.trim()
    ) {

        logEmptyResponseDiagnostics(
            response
        );


        throw new Error(
            buildEmptyOutputError(
                response
            )
        );

    }


    console.log(
        `✅ API Agent Output: ${content.length.toLocaleString()} characters`
    );


    const raw =
        extractJSON(
            content
        );


    writeJSON(
        workspace.apiContractRaw,
        raw
    );


    const normalized =
        normalizeApiContractOutput(
            raw,
            backend
        );


    const apiContract =
        apiContractSchema.parse(
            normalized
        );


    validateApiContract(
        apiContract,
        backend
    );


    writeJSON(
        workspace.apiContract,
        apiContract
    );


    const endpointCount =
        apiContract.groups.reduce(
            (
                total,
                group
            ) =>
                total
                +
                group.endpoints.length,
            0
        );


    console.log(
        `✅ ${workspace.apiContract} created`
    );


    console.log(
        `✅ API Validation: ${apiContract.groups.length} groups | ${endpointCount} endpoints | ${apiContract.schemas.length} schemas`
    );


    return apiContract;

}


function getMessageText(
    content:
        unknown
): string {

    if (
        typeof content
        ===
        "string"
    ) {

        return content;

    }


    if (
        Array.isArray(
            content
        )
    ) {

        return content
            .map(
                (
                    block:
                        any
                ) => {

                    if (
                        typeof block
                        ===
                        "string"
                    ) {

                        return block;

                    }


                    if (
                        typeof block?.text
                        ===
                        "string"
                    ) {

                        return block.text;

                    }


                    if (
                        typeof block?.content
                        ===
                        "string"
                    ) {

                        return block.content;

                    }


                    return "";

                }
            )
            .filter(
                Boolean
            )
            .join(
                "\n"
            );

    }


    return "";

}


function logEmptyResponseDiagnostics(
    response:
        any
): void {

    console.error(
        "\nAPI CONTRACT MODEL DIAGNOSTICS"
    );


    console.error(
        "----------------------------------------"
    );


    console.error(
        "Response content:"
    );


    console.error(
        JSON.stringify(
            response?.content
            ??
            null,
            null,
            2
        )
    );


    console.error(
        "\nResponse metadata:"
    );


    console.error(
        JSON.stringify(
            response?.response_metadata
            ??
            response?.responseMetadata
            ??
            {},
            null,
            2
        )
    );


    console.error(
        "\nUsage metadata:"
    );


    console.error(
        JSON.stringify(
            response?.usage_metadata
            ??
            response?.usageMetadata
            ??
            {},
            null,
            2
        )
    );


    console.error(
        "\nAdditional kwargs:"
    );


    console.error(
        JSON.stringify(
            response?.additional_kwargs
            ??
            {},
            null,
            2
        )
    );


    console.error(
        "----------------------------------------"
    );

}


function buildEmptyOutputError(
    response:
        any
): string {

    const metadata =
        response?.response_metadata
        ??
        response?.responseMetadata
        ??
        {};


    const finishReason =
        metadata?.finishReason
        ??
        metadata?.finish_reason
        ??
        metadata?.candidate?.finishReason
        ??
        metadata?.candidate?.finish_reason
        ??
        "UNKNOWN";


    return (
        "API_CONTRACT_AGENT_EMPTY_OUTPUT"
        +
        ` | finishReason=${finishReason}`
    );

}
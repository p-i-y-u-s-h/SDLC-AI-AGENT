import fs from "fs";

import type {
    ProjectWorkspace
} from "./projectWorkspace.js";

import {
    writeJSON
} from "./fileManager.js";


// ============================================================
// TYPES
// ============================================================

export interface TokenUsage {

    inputTokens: number;

    outputTokens: number;

    totalTokens: number;

    llmCalls: number;

}


interface TokenCallRecord {

    stage: string;

    model: string;

    inputTokens: number;

    outputTokens: number;

    totalTokens: number;

    llmCalls: number;

    timestamp: string;

}


interface TokenUsageFile {

    projectName: string;

    calls: TokenCallRecord[];

    totals: {

        inputTokens: number;

        outputTokens: number;

        totalTokens: number;

        llmCalls: number;

    };

}


// ============================================================
// EXTRACT TOKEN USAGE FROM LANGCHAIN / GEMINI RESULT
// ============================================================

export function extractTokenUsage(
    result: any
): TokenUsage {

    const usage: TokenUsage = {

        inputTokens: 0,

        outputTokens: 0,

        totalTokens: 0,

        llmCalls: 0

    };


    const messages =
        Array.isArray(
            result?.messages
        )
            ? result.messages
            : [];


    // ========================================================
    // CHECK EVERY AI MESSAGE
    //
    // Deep Agents may produce more than one AI message.
    // ========================================================

    for (
        const message
        of messages
    ) {

        const messageUsage =
            extractMessageUsage(
                message
            );


        if (!messageUsage) {

            continue;

        }


        usage.inputTokens +=
            messageUsage.inputTokens;


        usage.outputTokens +=
            messageUsage.outputTokens;


        usage.totalTokens +=
            messageUsage.totalTokens;


        usage.llmCalls++;

    }


    // ========================================================
    // SAFETY
    //
    // Some providers may omit totalTokens but give
    // input/output separately.
    // ========================================================

    if (
        usage.totalTokens === 0
        &&
        (
            usage.inputTokens > 0
            ||
            usage.outputTokens > 0
        )
    ) {

        usage.totalTokens =

            usage.inputTokens
            +
            usage.outputTokens;

    }


    return usage;
}


// ============================================================
// EXTRACT FROM SINGLE MESSAGE
// ============================================================

function extractMessageUsage(
    message: any
): TokenUsage | null {

    // ========================================================
    // LANGCHAIN STANDARD FORMAT
    //
    // message.usage_metadata
    //
    // {
    //    input_tokens: ...
    //    output_tokens: ...
    //    total_tokens: ...
    // }
    // ========================================================

    const langchainUsage =
        message?.usage_metadata;


    if (langchainUsage) {

        const inputTokens =
            numberValue(

                langchainUsage.input_tokens
                ??
                langchainUsage.inputTokens

            );


        const outputTokens =
            numberValue(

                langchainUsage.output_tokens
                ??
                langchainUsage.outputTokens

            );


        let totalTokens =
            numberValue(

                langchainUsage.total_tokens
                ??
                langchainUsage.totalTokens

            );


        if (
            totalTokens === 0
        ) {

            totalTokens =
                inputTokens
                +
                outputTokens;

        }


        return {

            inputTokens,

            outputTokens,

            totalTokens,

            llmCalls: 1

        };

    }


    // ========================================================
    // PROVIDER / GEMINI FALLBACK
    // ========================================================

    const providerUsage =

        message
            ?.response_metadata
            ?.usage_metadata

        ??

        message
            ?.response_metadata
            ?.usageMetadata;


    if (!providerUsage) {

        return null;

    }


    const inputTokens =
        numberValue(

            providerUsage.input_tokens

            ??

            providerUsage.inputTokens

            ??

            providerUsage.prompt_token_count

            ??

            providerUsage.promptTokenCount

            ??

            providerUsage.inputTokenCount

        );


    const outputTokens =
        numberValue(

            providerUsage.output_tokens

            ??

            providerUsage.outputTokens

            ??

            providerUsage.candidates_token_count

            ??

            providerUsage.candidatesTokenCount

            ??

            providerUsage.outputTokenCount

        );


    let totalTokens =
        numberValue(

            providerUsage.total_tokens

            ??

            providerUsage.totalTokens

            ??

            providerUsage.total_token_count

            ??

            providerUsage.totalTokenCount

        );


    if (
        totalTokens === 0
    ) {

        totalTokens =
            inputTokens
            +
            outputTokens;

    }


    return {

        inputTokens,

        outputTokens,

        totalTokens,

        llmCalls: 1

    };
}


// ============================================================
// RECORD USAGE
// ============================================================

export function recordTokenUsage(

    workspace: ProjectWorkspace,

    stage: string,

    result: any,

    model:
        string = "gemini-2.5-flash"

) {

    const usage =
        extractTokenUsage(
            result
        );


    // ========================================================
    // NO USAGE FOUND
    // ========================================================

    if (
        usage.llmCalls === 0
        &&
        usage.totalTokens === 0
    ) {

        console.warn(
            `⚠️ No token metadata found for ${stage}`
        );


        return usage;

    }


    // ========================================================
    // LOAD EXISTING TOKEN FILE
    // ========================================================

    let tokenFile:
        TokenUsageFile;


    if (
        fs.existsSync(
            workspace.tokenUsage
        )
    ) {

        try {

            tokenFile =
                JSON.parse(

                    fs.readFileSync(
                        workspace.tokenUsage,
                        "utf-8"
                    )

                );

        }

        catch {

            tokenFile =
                createEmptyTokenFile(
                    workspace.projectName
                );

        }

    }

    else {

        tokenFile =
            createEmptyTokenFile(
                workspace.projectName
            );

    }


    // ========================================================
    // ADD CURRENT CALL
    // ========================================================

    tokenFile.calls.push({

        stage,

        model,

        inputTokens:
            usage.inputTokens,

        outputTokens:
            usage.outputTokens,

        totalTokens:
            usage.totalTokens,

        llmCalls:
            usage.llmCalls,

        timestamp:
            new Date().toISOString()

    });


    // ========================================================
    // RECALCULATE TOTALS
    //
    // Recalculating prevents accumulation bugs.
    // ========================================================

    tokenFile.totals = {

        inputTokens:
            tokenFile.calls.reduce(

                (total, call) =>
                    total
                    +
                    call.inputTokens,

                0

            ),


        outputTokens:
            tokenFile.calls.reduce(

                (total, call) =>
                    total
                    +
                    call.outputTokens,

                0

            ),


        totalTokens:
            tokenFile.calls.reduce(

                (total, call) =>
                    total
                    +
                    call.totalTokens,

                0

            ),


        llmCalls:
            tokenFile.calls.reduce(

                (total, call) =>
                    total
                    +
                    call.llmCalls,

                0

            )

    };


    // ========================================================
    // SAVE
    // ========================================================

    writeJSON(

        workspace.tokenUsage,

        tokenFile

    );


    // ========================================================
    // CONSOLE
    // ========================================================

    console.log(
        "\n----------------------------------------"
    );


    console.log(
        `TOKEN USAGE — ${stage}`
    );


    console.log(
        `Input:  ${formatNumber(usage.inputTokens)}`
    );


    console.log(
        `Output: ${formatNumber(usage.outputTokens)}`
    );


    console.log(
        `Total:  ${formatNumber(usage.totalTokens)}`
    );


    console.log(
        `LLM Calls: ${usage.llmCalls}`
    );


    console.log(
        "----------------------------------------"
    );


    return usage;
}


// ============================================================
// PRINT FINAL PROJECT SUMMARY
// ============================================================

export function printTokenUsageSummary(
    workspace: ProjectWorkspace
) {

    if (
        !fs.existsSync(
            workspace.tokenUsage
        )
    ) {

        console.log(
            "\nNo token usage recorded."
        );


        return;

    }


    const data:
        TokenUsageFile =
        JSON.parse(

            fs.readFileSync(
                workspace.tokenUsage,
                "utf-8"
            )

        );


    console.log(
        "\n========================================"
    );


    console.log(
        "📊 PROJECT TOKEN USAGE"
    );


    console.log(
        "========================================"
    );


    for (
        const call
        of data.calls
    ) {

        console.log(
            `${call.stage}`
        );


        console.log(
            `  Input : ${formatNumber(call.inputTokens)}`
        );


        console.log(
            `  Output: ${formatNumber(call.outputTokens)}`
        );


        console.log(
            `  Total : ${formatNumber(call.totalTokens)}`
        );

    }


    console.log(
        "----------------------------------------"
    );


    console.log(
        `Total Input : ${formatNumber(data.totals.inputTokens)}`
    );


    console.log(
        `Total Output: ${formatNumber(data.totals.outputTokens)}`
    );


    console.log(
        `TOTAL TOKENS: ${formatNumber(data.totals.totalTokens)}`
    );


    console.log(
        `LLM Calls   : ${data.totals.llmCalls}`
    );


    console.log(
        "========================================\n"
    );

}


// ============================================================
// EMPTY FILE
// ============================================================

function createEmptyTokenFile(
    projectName: string
): TokenUsageFile {

    return {

        projectName,

        calls: [],

        totals: {

            inputTokens: 0,

            outputTokens: 0,

            totalTokens: 0,

            llmCalls: 0

        }

    };
}


// ============================================================
// NUMBER
// ============================================================

function numberValue(
    value: any
): number {

    const number =
        Number(value);


    if (
        Number.isFinite(
            number
        )
    ) {

        return number;

    }


    return 0;
}


// ============================================================
// FORMAT
// ============================================================

function formatNumber(
    value: number
) {

    return value.toLocaleString(
        "en-US"
    );

}
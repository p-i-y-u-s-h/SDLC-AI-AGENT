import fs from "fs";
import path from "path";

import {
    jsonrepair
} from "jsonrepair";


// ============================================================
// READ JSON
// ============================================================

export function readJSON(
    filePath: string
) {

    if (
        !fs.existsSync(
            filePath
        )
    ) {

        throw new Error(
            `JSON file not found: ${filePath}`
        );

    }


    const data =
        fs.readFileSync(
            filePath,
            "utf-8"
        );


    try {

        return JSON.parse(
            data
        );

    }
    catch {

        throw new Error(
            `Invalid JSON file: ${filePath}`
        );

    }

}


// ============================================================
// WRITE JSON
// ============================================================

export function writeJSON(
    filePath: string,
    data: any
) {

    const directory =
        path.dirname(
            filePath
        );


    fs.mkdirSync(
        directory,
        {
            recursive: true
        }
    );


    fs.writeFileSync(
        filePath,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf-8"
    );

}


export function getMessageText(
    content: unknown
): string {

    if (
        typeof content === "string"
    ) {
        return content;
    }

    if (
        Array.isArray(content)
    ) {
        return content
            .map((block: any) => {
                if (typeof block === "string") {
                    return block;
                }
                if (typeof block?.text === "string") {
                    return block.text;
                }
                if (typeof block?.content === "string") {
                    return block.content;
                }
                return "";
            })
            .filter(Boolean)
            .join("\n");
    }

    if (
        content && typeof (content as any).text === "string"
    ) {
        return (content as any).text;
    }

    return "";
}


// ============================================================
// EXTRACT JSON FROM AI RESPONSE
// ============================================================

export function extractJSON(
    text: unknown
) {

    let cleaned =
        getMessageText(text)
        .trim();


    // ========================================================
    // REMOVE MARKDOWN CODE BLOCKS
    // ========================================================

    cleaned =
        cleaned.replace(
            /^```json\s*/i,
            ""
        );


    cleaned =
        cleaned.replace(
            /^```\s*/i,
            ""
        );


    cleaned =
        cleaned.replace(
            /\s*```$/i,
            ""
        );


    cleaned =
        cleaned.trim();


    // ========================================================
    // FIND JSON OBJECT
    // ========================================================

    const startIndex =
        cleaned.indexOf(
            "{"
        );


    const endIndex =
        cleaned.lastIndexOf(
            "}"
        );


    if (
        startIndex === -1
        ||
        endIndex === -1
        ||
        endIndex < startIndex
    ) {

        throw new Error(
            "Agent did not return a JSON object."
        );

    }


    const jsonCandidate =
        cleaned.substring(
            startIndex,
            endIndex + 1
        );

    // Pre-normalize Python-style triple quotes ('''...''' or """...""") into JSON-safe strings
    let normalized = jsonCandidate;
    normalized = normalized.replace(/'''([\s\S]*?)'''/g, (_, inner) => JSON.stringify(inner));
    normalized = normalized.replace(/"""([\s\S]*?)"""/g, (_, inner) => JSON.stringify(inner));

    // ========================================================
    // FIRST ATTEMPT — STRICT JSON
    // ========================================================

    try {
        return JSON.parse(normalized);
    }
    catch {
        // Continue with deterministic repair.
    }

    // ========================================================
    // SECOND ATTEMPT — JSON REPAIR
    // ========================================================

    try {
        const repairedJSON = jsonrepair(normalized);
        const parsedJSON = JSON.parse(repairedJSON);

        console.warn("\n⚠️ Agent response contained malformed JSON.");
        console.warn("✅ JSON repaired deterministically without another LLM call.\n");

        return parsedJSON;
    } catch {
        // Try repairing original candidate before giving up
        try {
            const repairedOriginal = jsonrepair(jsonCandidate);
            return JSON.parse(repairedOriginal);
        } catch (repairError) {
            console.error("\n========================================");
            console.error("AGENT RETURNED INVALID JSON");
            console.error("========================================\n");
            console.error(jsonCandidate);
            console.error("\n========================================");
            console.error("JSON REPAIR FAILED");
            console.error("========================================\n");

            if (repairError instanceof Error) {
                console.error(repairError.message);
            }

            throw new Error("Invalid JSON returned by Agent.");
        }
    }
}
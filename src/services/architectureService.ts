import fs from "fs";
import path from "path";

import {
    architectureAgent
} from "../agent/architectureAgent.js";

import {
    architectureSchema
} from "../schemas/architectureSchema.js";

import {
    requirementSchema
} from "../schemas/requirementSchema.js";

import {
    readJSON,
    writeJSON,
    extractJSON,
    getMessageText
} from "../utils/fileManager.js";

import {
    recordTokenUsage
} from "../utils/tokenTracker.js";

import {
    withProviderRetry
} from "../utils/providerRetry.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";

import {
    normalizeArchitectureOutput
} from "./architectureNormalizationService.js";


export async function generateArchitecture(
    workspace: ProjectWorkspace
) {

    console.log(
        "Reading project requirements..."
    );


    // ========================================================
    // LOAD + VALIDATE REQUIREMENTS
    // ========================================================

    const requirements =
        requirementSchema.parse(
            readJSON(
                workspace.requirements
            )
        );


    // ========================================================
    // RUN ARCHITECTURE AGENT
    // ========================================================

    const result =
        await withProviderRetry(
            () =>
                architectureAgent.invoke({
                    messages: [
                        {
                            role: "user",

                    content:
`
Design the complete software architecture for this project.

PROJECT REQUIREMENTS:

${JSON.stringify(
    requirements,
    null,
    2
)}

Important:

- Respect all explicit user technology constraints.
- Never replace a technology explicitly selected by the user.
- Select all missing technologies.

- Select both:
  1. the storage model
  2. the concrete database engine

- database.model must be one of:
  RELATIONAL
  DOCUMENT
  GRAPH
  KEY_VALUE

- database.engine must be a concrete database product.

Examples:

RELATIONAL + PostgreSQL
DOCUMENT + MongoDB
GRAPH + Neo4j
KEY_VALUE + Redis

- If the user explicitly selected a database engine,
  preserve it exactly.

- If the user explicitly selected a storage model,
  preserve it exactly.

- If the user did not specify storage,
  select the most appropriate model and engine.

- Select backend language, runtime, framework,
  package manager, ORM/data-access technology,
  API style, testing framework and build tool.

- Select frontend technologies when they are not
  explicitly specified.

- Ensure backend.orm is compatible with the selected
  database engine.

- Define backend modules and module dependencies.

- Do not design database tables.
- Do not design collections.
- Do not design graph nodes.
- Do not design key spaces.
- Do not generate physical storage schemas.
- Do not generate SQL.
- Do not generate source code.

Return only valid JSON matching the required
architecture schema.
`
                }

                    ]
                }),
            { operationName: "Architecture & Planning Agent", maxAttempts: 5 }
        );


    // ========================================================
    // TOKEN USAGE
    // ========================================================

    recordTokenUsage(
        workspace,
        "Architecture & Planning Agent",
        result,
        process.env.GEMINI_MODEL || "gemini-flash-latest"
    );


    // ========================================================
    // GET FINAL AGENT RESPONSE
    // ========================================================

    const response =
        result.messages[
            result.messages.length - 1
        ];


    const rawArchitectureContent =
        getMessageText(
            response.content
        );


    // ========================================================
    // SAVE RAW LLM OUTPUT
    //
    // Debugging only.
    // Downstream stages must never consume this file.
    // ========================================================

    const rawArchitecturePath =
        path.join(
            workspace.outputDir,
            "architecture.raw.txt"
        );


    fs.writeFileSync(
        rawArchitecturePath,
        rawArchitectureContent,
        "utf-8"
    );


    // ========================================================
    // EXTRACT / REPAIR JSON
    // ========================================================

    const rawArchitecture =
        extractJSON(
            rawArchitectureContent
        );


    // ========================================================
    // NORMALIZE HARMLESS OUTPUT VARIATIONS
    // ========================================================

    const normalizedArchitecture =
        normalizeArchitectureOutput(
            rawArchitecture,
            requirements.projectName
        );


    // ========================================================
    // STRICT SCHEMA VALIDATION
    // ========================================================

    const architecture =
        architectureSchema.parse(
            normalizedArchitecture
        );


    // ========================================================
    // SAVE AUTHORITATIVE ARCHITECTURE
    // ========================================================

    writeJSON(
        workspace.architecture,
        architecture
    );


    console.log(
        `✅ ${workspace.architecture}`
    );


    return architecture;
}
import fs from "fs";
import path from "path";

import {
    readJSON
} from "../utils/fileManager.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";

import {
    backendContractSchema
} from "../schemas/backendContractSchema.js";

import {
    backendExecutionProfileSchema
} from "../schemas/backendExecutionProfileSchema.js";

import {
    backendGenerationPlanSchema
} from "../schemas/backendGenerationPlanSchema.js";

import {
    resolveBackendScaffoldRecipe
} from "../stack/backendScaffoldRecipes.js";


export interface BackendScaffoldResult {

    profileId:
        string;

    createdFiles:
        string[];

    unchangedFiles:
        string[];

    createdDirectories:
        string[];

}


// ============================================================
// MAIN SERVICE
// ============================================================


export function generateBackendScaffold(
    workspace:
        ProjectWorkspace
): BackendScaffoldResult {

    const backend =
        backendContractSchema.parse(
            readJSON(
                workspace.backendContract
            )
        );


    const profile =
        backendExecutionProfileSchema.parse(
            readJSON(
                workspace.backendExecutionProfile
            )
        );


    const plan =
        backendGenerationPlanSchema.parse(
            readJSON(
                workspace.backendGenerationPlan
            )
        );


    validateScaffoldInputs(
        backend.projectName,
        backend.execution.profileId,
        profile.id,
        plan.projectName,
        plan.profileId,
        plan.tasks
    );


    const recipe =
        resolveBackendScaffoldRecipe({

            projectName:
                backend.projectName,

            projectSlug:
                workspace.projectSlug,

            profile

        });


    if (
        recipe.profileId
        !==
        profile.id
    ) {

        throw new Error(
            `BACKEND_SCAFFOLD_RECIPE_PROFILE_MISMATCH:${recipe.profileId}:${profile.id}`
        );

    }


    const createdDirectories:
        string[] =
        [];


    const createdFiles:
        string[] =
        [];


    const unchangedFiles:
        string[] =
        [];


    // ========================================================
    // DIRECTORIES
    // ========================================================

    for (
        const relativeDirectory
        of recipe.directories
    ) {

        validateRelativePath(
            relativeDirectory
        );


        validateScaffoldOwnedPath(
            relativeDirectory
        );


        const absoluteDirectory =
            resolveInsideBackend(
                workspace.backendDir,
                relativeDirectory
            );


        if (
            !fs.existsSync(
                absoluteDirectory
            )
        ) {

            fs.mkdirSync(
                absoluteDirectory,
                {
                    recursive:
                        true
                }
            );


            createdDirectories.push(
                relativeDirectory
            );

        }

    }


    // ========================================================
    // FILES
    // ========================================================

    for (
        const file
        of recipe.files
    ) {

        /*
         * The resolved scaffold recipe is authoritative for
         * Stage 10 file ownership.
         *
         * Therefore files such as:
         *
         * package.json
         * tsconfig.json
         * tsconfig.build.json
         * Cargo.toml
         * pyproject.toml
         * go.mod
         * drizzle.config.ts
         * framework bootstrap files
         *
         * may be created here even if later stages are not
         * permitted to modify them.
         */

        validateRelativePath(
            file.path
        );


        validateScaffoldOwnedPath(
            file.path
        );


        const absolutePath =
            resolveInsideBackend(
                workspace.backendDir,
                file.path
            );


        fs.mkdirSync(
            path.dirname(
                absolutePath
            ),
            {
                recursive:
                    true
            }
        );


        const normalizedContent =
            normalizeFileContent(
                file.content
            );


        // ====================================================
        // IDEMPOTENT EXISTING FILE HANDLING
        // ====================================================

        if (
            fs.existsSync(
                absolutePath
            )
        ) {

            const existingContent =
                normalizeFileContent(
                    fs.readFileSync(
                        absolutePath,
                        "utf-8"
                    )
                );


            if (
                existingContent
                !==
                normalizedContent
            ) {

                /*
                 * Never silently overwrite a different file.
                 *
                 * If a previous scaffold, developer edit or
                 * other stage owns different content, stop.
                 */
                throw new Error(
                    `BACKEND_SCAFFOLD_FILE_CONFLICT:${file.path}`
                );

            }


            unchangedFiles.push(
                file.path
            );


            continue;

        }


        fs.writeFileSync(
            absolutePath,
            normalizedContent,
            "utf-8"
        );


        createdFiles.push(
            file.path
        );

    }


    console.log(
        `✅ Backend Scaffold: ${createdFiles.length} files created | ${unchangedFiles.length} unchanged`
    );


    console.log(
        `✅ Backend Root: ${workspace.backendDir}`
    );


    return {

        profileId:
            profile.id,

        createdFiles,

        unchangedFiles,

        createdDirectories

    };

}


// ============================================================
// INPUT CONSISTENCY
// ============================================================


function validateScaffoldInputs(
    backendProjectName:
        string,

    backendProfileId:
        string,

    executionProfileId:
        string,

    planProjectName:
        string,

    planProfileId:
        string,

    tasks:
        Array<{
            id: string;
            phase: number;
            kind: string;
        }>
): void {

    if (
        backendProjectName
        !==
        planProjectName
    ) {

        throw new Error(
            "BACKEND_SCAFFOLD_PROJECT_MISMATCH"
        );

    }


    if (
        backendProfileId
        !==
        executionProfileId
    ) {

        throw new Error(
            `BACKEND_SCAFFOLD_EXECUTION_PROFILE_MISMATCH:${backendProfileId}:${executionProfileId}`
        );

    }


    if (
        planProfileId
        !==
        executionProfileId
    ) {

        throw new Error(
            `BACKEND_SCAFFOLD_PLAN_PROFILE_MISMATCH:${planProfileId}:${executionProfileId}`
        );

    }


    const scaffoldTasks =
        tasks.filter(
            task =>
                task.kind
                ===
                "SCAFFOLD"
        );


    if (
        scaffoldTasks.length
        ===
        0
    ) {

        throw new Error(
            "BACKEND_SCAFFOLD_TASK_MISSING"
        );

    }


    if (
        scaffoldTasks.length
        >
        1
    ) {

        throw new Error(
            "BACKEND_SCAFFOLD_MULTIPLE_FOUNDATION_TASKS"
        );

    }


    const scaffoldTask =
        scaffoldTasks[
            0
        ];


    if (
        scaffoldTask.id
        !==
        "backend-foundation"
    ) {

        throw new Error(
            `BACKEND_SCAFFOLD_UNEXPECTED_TASK:${scaffoldTask.id}`
        );

    }


    if (
        scaffoldTask.phase
        !==
        1
    ) {

        throw new Error(
            `BACKEND_SCAFFOLD_INVALID_PHASE:${scaffoldTask.phase}`
        );

    }

}


// ============================================================
// STAGE 10 OWNERSHIP SAFETY
// ============================================================


function validateScaffoldOwnedPath(
    relativePath:
        string
): void {

    const normalized =
        normalizeRelativePath(
            relativePath
        );


    if (
        !normalized
    ) {

        throw new Error(
            "BACKEND_SCAFFOLD_EMPTY_PATH"
        );

    }


    /*
     * These paths are never scaffold-owned.
     */

    const forbiddenRoots = [

        ".git",

        "node_modules",

        "dist"

    ];


    for (
        const forbiddenRoot
        of forbiddenRoots
    ) {

        if (
            isInsideRoot(
                normalized,
                forbiddenRoot
            )
        ) {

            throw new Error(
                `BACKEND_SCAFFOLD_FORBIDDEN_PATH:${relativePath}`
            );

        }

    }


    /*
     * Never create actual secret environment files.
     *
     * .env.example is allowed.
     */
    if (
        normalized
        ===
        ".env"
    ) {

        throw new Error(
            `BACKEND_SCAFFOLD_FORBIDDEN_PATH:${relativePath}`
        );

    }

}


// ============================================================
// RELATIVE PATH VALIDATION
// ============================================================


function validateRelativePath(
    value:
        string
): void {

    const trimmed =
        value.trim();


    if (
        !trimmed
    ) {

        throw new Error(
            "BACKEND_SCAFFOLD_EMPTY_PATH"
        );

    }


    if (
        path.isAbsolute(
            trimmed
        )
    ) {

        throw new Error(
            `BACKEND_SCAFFOLD_ABSOLUTE_PATH:${value}`
        );

    }


    const normalized =
        trimmed.replace(
            /\\/g,
            "/"
        );


    if (
        /^[a-zA-Z]:\//.test(
            normalized
        )
    ) {

        throw new Error(
            `BACKEND_SCAFFOLD_ABSOLUTE_PATH:${value}`
        );

    }


    const segments =
        normalized.split(
            "/"
        );


    if (
        segments.includes(
            ".."
        )
    ) {

        throw new Error(
            `BACKEND_SCAFFOLD_PARENT_TRAVERSAL:${value}`
        );

    }


    if (
        normalized.includes(
            "\0"
        )
    ) {

        throw new Error(
            `BACKEND_SCAFFOLD_INVALID_PATH:${value}`
        );

    }

}


// ============================================================
// BACKEND ROOT CONTAINMENT
// ============================================================


function resolveInsideBackend(
    backendRoot:
        string,

    relativePath:
        string
): string {

    const root =
        path.resolve(
            backendRoot
        );


    const result =
        path.resolve(
            backendRoot,
            relativePath
        );


    const relative =
        path.relative(
            root,
            result
        );


    if (
        relative
        ===
        ".."
        ||
        relative.startsWith(
            `..${path.sep}`
        )
        ||
        path.isAbsolute(
            relative
        )
    ) {

        throw new Error(
            `BACKEND_SCAFFOLD_PATH_ESCAPE:${relativePath}`
        );

    }


    return result;

}


// ============================================================
// ROOT HELPER
// ============================================================


function isInsideRoot(
    candidate:
        string,

    root:
        string
): boolean {

    const normalizedCandidate =
        normalizeRelativePath(
            candidate
        );


    const normalizedRoot =
        normalizeRelativePath(
            root
        );


    return (
        normalizedCandidate
        ===
        normalizedRoot
        ||
        normalizedCandidate.startsWith(
            `${normalizedRoot}/`
        )
    );

}


// ============================================================
// PATH NORMALIZATION
// ============================================================


function normalizeRelativePath(
    value:
        string
): string {

    return value
        .trim()
        .replace(
            /\\/g,
            "/"
        )
        .replace(
            /^\.\/+/,
            ""
        )
        .replace(
            /\/+/g,
            "/"
        )
        .replace(
            /\/$/,
            ""
        )
        .toLowerCase();

}


// ============================================================
// FILE CONTENT NORMALIZATION
// ============================================================


function normalizeFileContent(
    content:
        string
): string {

    return (
        content
            .replace(
                /\r\n/g,
                "\n"
            )
            .replace(
                /\r/g,
                "\n"
            )
            .trimEnd()
        +
        "\n"
    );

}
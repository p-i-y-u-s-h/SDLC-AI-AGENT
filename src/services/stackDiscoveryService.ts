import fs from "node:fs";

import path from "node:path";

import {
    stackDiscoveryAgent
} from "../agent/stackDiscoveryAgent.js";

import {
    stackDiscoveryResultSchema
} from "../schemas/stackDiscoverySchema.js";

import {
    backendExecutionProfileSchema
} from "../schemas/backendExecutionProfileSchema.js";

import type {
    BackendExecutionProfile,
    CommandSpec
} from "../schemas/backendExecutionProfileSchema.js";

import type {
    BackendExecutionSelection
} from "../stack/backendExecutionProfiles.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";

import {
    extractJSON
} from "../utils/fileManager.js";

import {
    recordTokenUsage
} from "../utils/tokenTracker.js";

import {
    retrieveStackDiscoveryKnowledge
} from "./stackDiscoveryKnowledgeService.js";

import {
    withProviderRetry
} from "../utils/providerRetry.js";


export type MissingBackendComponent =
    | "APPLICATION"
    | "PERSISTENCE"
    | "CACHE"
    | "TEST"
    | "BUILD";


export async function discoverBackendExecutionProfile(
    workspace:
        ProjectWorkspace,

    selection:
        BackendExecutionSelection,

    missingComponents:
        MissingBackendComponent[]
): Promise<
    BackendExecutionProfile
> {

    const profileId =
        createDiscoveredProfileId(
            selection
        );


    const cached =
        loadCachedProfile(
            profileId,
            selection
        );


    if (
        cached
    ) {

        console.log(
            `♻️ Reusing discovered stack profile: ${cached.id}`
        );


        return cached;

    }


    console.log(
        `🔎 Discovering backend stack profile: ${missingComponents.join(", ")}`
    );


    const documentation =
        await retrieveStackDiscoveryKnowledge(
            selection
        );


    const result =
        await withProviderRetry(
            () =>
                stackDiscoveryAgent.invoke({
                    messages: [
                        {
                            role: "user",
                            content: `
Discover execution mechanics for this already-selected backend stack.

IMPORTANT:
The technology selection below is immutable.
Do not choose or replace technologies.

SELECTED STACK:

${JSON.stringify(
    {
        language: selection.language,
        runtime: selection.runtime,
        framework: selection.framework,
        packageManager: selection.packageManager,
        dataAccessTechnology: selection.dataAccessTechnology,
        databaseEngine: selection.databaseEngine,
        cacheRequired: selection.cacheRequired,
        cacheTechnology: selection.cacheTechnology,
        testFramework: selection.testFramework,
        buildTool: selection.buildTool
    },
    null,
    2
)}

BUILT-IN COMPONENTS THAT WERE MISSING:

${JSON.stringify(missingComponents, null, 2)}

AUTHORITATIVE DOCUMENTATION:

${JSON.stringify(documentation, null, 2)}

If documentation is empty, do not fabricate documentation sources.

Return only the required JSON.
`
                        }
                    ]
                }),
            { operationName: "Backend Stack Discovery Agent", maxAttempts: 5 }
        );


    recordTokenUsage(
        workspace,
        "Backend Stack Discovery Agent",
        result,
        "gemini-2.5-flash"
    );


    const response =
        result.messages[
            result.messages.length - 1
        ];


    const raw =
        extractJSON(
            response.content as string
        );


    const discovered =
        stackDiscoveryResultSchema.parse(
            raw
        );


    if (
        discovered.status
        ===
        "INCOMPATIBLE"
    ) {

        throw new Error(
            `BACKEND_STACK_INCOMPATIBLE:${discovered.reason}`
        );

    }


    const commands =
        collectCommands(
            discovered.commands
        );


    validateDiscoveredCommands(
        commands
    );


    validateDiscoveredPaths([
        ...discovered.sourceRoots,
        ...discovered.testRoots,
        ...discovered.dependencyFiles,
        ...discovered.writablePathPatterns,
        ...discovered.sharedPathPatterns,
        ...discovered.protectedPathPatterns
    ]);


    validateDiscoveredScaffold(
        discovered.scaffold
    );


    const allowedExecutables =
        uniqueStrings(
            commands.map(
                command =>
                    command.executable
            )
        );


    const profile =
        backendExecutionProfileSchema.parse({

            id:
                profileId,

            resolvedBy:
                "DISCOVERED",

            language:
                selection.language,

            framework:
                selection.framework,

            runtime:
                selection.runtime,

            packageManager:
                selection.packageManager,

            orm:
                selection.dataAccessTechnology,

            databaseEngine:
                selection.databaseEngine,

            cache: {

                required:
                    selection.cacheRequired,

                technology:
                    selection.cacheTechnology

            },

            testFramework:
                selection.testFramework,

            buildTool:
                selection.buildTool,

            sourceRoots:
                uniqueStrings(
                    discovered.sourceRoots
                ),

            testRoots:
                uniqueStrings(
                    discovered.testRoots
                ),

            dependencyFiles:
                uniqueStrings(
                    discovered.dependencyFiles
                ),

            writablePathPatterns:
                uniqueStrings(
                    discovered.writablePathPatterns
                ),

            sharedPathPatterns:
                uniqueStrings(
                    discovered.sharedPathPatterns
                ),

            protectedPathPatterns:
                uniqueStrings(
                    discovered.protectedPathPatterns
                ),

            allowedExecutables,

            commands:
                discovered.commands,

            conventions:
                uniqueStrings(
                    discovered.conventions
                ),

            implementationGuidance:
                uniqueStrings(
                    discovered.implementationGuidance
                ),

            repairGuidance:
                uniqueStrings(
                    discovered.repairGuidance
                ),

            scaffold:
                discovered.scaffold,

            discovery: {

                missingComponents,

                knowledgeMode:
                    documentation.length > 0
                        ?
                        "SUPPLIED_DOCUMENTATION"
                        :
                        discovered.knowledgeMode,

                documentationSources:
                    documentation.length > 0
                        ?
                        uniqueStrings(
                            documentation.map(
                                chunk =>
                                    chunk.source
                            )
                        )
                        :
                        uniqueStrings(
                            discovered.documentationSources
                        )

            }

        });


    validateTechnologyPreservation(
        selection,
        profile
    );


    saveCachedProfile(
        profile
    );


    return profile;

}


// ============================================================
// CACHE
// ============================================================


function createDiscoveredProfileId(
    selection:
        BackendExecutionSelection
): string {

    const parts = [

        selection.language,

        selection.runtime,

        selection.framework,

        selection.packageManager,

        selection.dataAccessTechnology,

        selection.databaseEngine,

        selection.cacheRequired
            ?
            selection.cacheTechnology
            :
            "no-cache",

        selection.testFramework,

        selection.buildTool

    ];


    return (
        "discovered-"
        +
        parts
            .map(
                slug
            )
            .join("-")
    );

}


function getCacheDirectory():
    string {

    return path.join(
        process.cwd(),
        ".sdlc-cache",
        "stack-profiles"
    );

}


function loadCachedProfile(
    profileId:
        string,

    selection:
        BackendExecutionSelection
): BackendExecutionProfile | null {

    const filePath =
        path.join(
            getCacheDirectory(),
            `${profileId}.json`
        );


    if (
        !fs.existsSync(
            filePath
        )
    ) {

        return null;

    }


    try {

        const parsed =
            backendExecutionProfileSchema.parse(
                JSON.parse(
                    fs.readFileSync(
                        filePath,
                        "utf8"
                    )
                )
            );


        if (
            parsed.resolvedBy
            !==
            "DISCOVERED"
        ) {

            return null;

        }


        validateTechnologyPreservation(
            selection,
            parsed
        );


        validateDiscoveredCommands(
            collectCommands(
                parsed.commands
            )
        );


        if (
            !parsed.scaffold
        ) {

            return null;

        }


        validateDiscoveredScaffold(
            parsed.scaffold
        );


        return parsed;

    }
    catch {

        return null;

    }

}


function saveCachedProfile(
    profile:
        BackendExecutionProfile
): void {

    const directory =
        getCacheDirectory();


    fs.mkdirSync(
        directory,
        {
            recursive:
                true
        }
    );


    fs.writeFileSync(
        path.join(
            directory,
            `${profile.id}.json`
        ),
        JSON.stringify(
            profile,
            null,
            2
        )
        +
        "\n",
        "utf8"
    );

}


// ============================================================
// COMMAND VALIDATION
// ============================================================


function collectCommands(
    commands:
        BackendExecutionProfile["commands"]
): CommandSpec[] {

    return [

        ...(
            commands.bootstrap
            ??
            []
        ),

        ...commands.setup,

        ...commands.focusedValidation,

        ...commands.fullValidation,

        ...(
            commands.preview
                ?
                [
                    commands.preview
                ]
                :
                []
        )

    ];

}


function validateDiscoveredCommands(
    commands:
        CommandSpec[]
): void {

    const forbiddenExecutables =
        new Set([
            "sh",
            "bash",
            "zsh",
            "fish",
            "cmd",
            "cmd.exe",
            "powershell",
            "powershell.exe",
            "pwsh",
            "wsl",
            "curl",
            "wget"
        ]);


    const commandsByName =
        new Map<
            string,
            CommandSpec
        >();


    for (
        const command
        of commands
    ) {

        const executable =
            command.executable
                .trim();


        const normalizedExecutable =
            executable
                .toLowerCase();


        // ------------------------------------------------------------
        // EXECUTABLE FORMAT
        // ------------------------------------------------------------

        if (
            !/^[a-zA-Z0-9._+-]+$/.test(
                executable
            )
        ) {

            throw new Error(
                `STACK_DISCOVERY_INVALID_EXECUTABLE:${executable}`
            );

        }


        // ------------------------------------------------------------
        // FORBIDDEN SHELLS / DOWNLOADERS
        // ------------------------------------------------------------

        if (
            forbiddenExecutables.has(
                normalizedExecutable
            )
        ) {

            throw new Error(
                `STACK_DISCOVERY_FORBIDDEN_EXECUTABLE:${executable}`
            );

        }


        // ------------------------------------------------------------
        // COMMAND CWD
        // ------------------------------------------------------------

        if (
            command.cwd
        ) {

            assertSafeRelativePath(
                command.cwd,
                "COMMAND_CWD"
            );

        }


        // ------------------------------------------------------------
        // ARGUMENT SECURITY
        // ------------------------------------------------------------

        for (
            const argument
            of command.args
        ) {

            if (
                containsUnsafeShellSyntax(
                    argument
                )
            ) {

                throw new Error(
                    `STACK_DISCOVERY_UNSAFE_COMMAND_ARGUMENT:${command.name}:${argument}`
                );

            }

        }


        // ------------------------------------------------------------
        // DUPLICATE COMMAND NAME HANDLING
        // ------------------------------------------------------------

        const normalizedName =
            normalizeCommandName(
                command.name
            );


        const existing =
            commandsByName.get(
                normalizedName
            );


        if (
            !existing
        ) {

            commandsByName.set(
                normalizedName,
                command
            );


            continue;

        }


        /*
         * The same command may legitimately appear in both:
         *
         * focusedValidation
         * fullValidation
         *
         * Example:
         *
         * TypeScript Type Check
         * npx tsc --noEmit
         *
         * That is safe.
         *
         * What is rejected is the same name being used for a
         * different command definition.
         */

        if (
            !sameCommandDefinition(
                existing,
                command
            )
        ) {

            throw new Error(
                `STACK_DISCOVERY_COMMAND_NAME_CONFLICT:${command.name}`
            );

        }

    }

}


function sameCommandDefinition(
    left:
        CommandSpec,

    right:
        CommandSpec
): boolean {

    if (
        left.purpose
        !==
        right.purpose
    ) {

        return false;

    }


    if (
        normalizeExecutable(
            left.executable
        )
        !==
        normalizeExecutable(
            right.executable
        )
    ) {

        return false;

    }


    if (
        normalizeOptionalPath(
            left.cwd
        )
        !==
        normalizeOptionalPath(
            right.cwd
        )
    ) {

        return false;

    }


    if (
        left.args.length
        !==
        right.args.length
    ) {

        return false;

    }


    for (
        let index =
            0;

        index
        <
        left.args.length;

        index++
    ) {

        if (
            left.args[
                index
            ]
            !==
            right.args[
                index
            ]
        ) {

            return false;

        }

    }


    return true;

}


function normalizeCommandName(
    value:
        string
): string {

    return value
        .trim()
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        );

}


function normalizeExecutable(
    value:
        string
): string {

    return value
        .trim()
        .toLowerCase();

}


function normalizeOptionalPath(
    value:
        string | undefined
): string {

    return (
        value
        ??
        "."
    )
        .trim()
        .replace(
            /\\/g,
            "/"
        )
        .replace(
            /^\.\/+/,
            ""
        )
        .toLowerCase();

}


function containsUnsafeShellSyntax(
    value:
        string
): boolean {

    return (
        value.includes(
            "&&"
        )
        ||
        value.includes(
            "||"
        )
        ||
        value.includes(
            "|"
        )
        ||
        value.includes(
            ">"
        )
        ||
        value.includes(
            "<"
        )
        ||
        value.includes(
            ";"
        )
        ||
        value.includes(
            "`"
        )
        ||
        value.includes(
            "$("
        )
    );

}


// ============================================================
// PATH VALIDATION
// ============================================================


function validateDiscoveredPaths(
    values:
        string[]
): void {

    for (
        const value
        of values
    ) {

        assertSafeRelativePath(
            value,
            "PROFILE_PATH"
        );

    }

}


function validateDiscoveredScaffold(
    scaffold:
        BackendExecutionProfile["scaffold"]
): void {

    if (
        !scaffold
    ) {

        throw new Error(
            "STACK_DISCOVERY_SCAFFOLD_MISSING"
        );

    }


    if (
        scaffold.files.length
        >
        50
    ) {

        throw new Error(
            "STACK_DISCOVERY_TOO_MANY_SCAFFOLD_FILES"
        );

    }


    for (
        const directory
        of scaffold.directories
    ) {

        assertSafeRelativePath(
            directory,
            "SCAFFOLD_DIRECTORY"
        );

    }


    const paths =
        new Set<string>();


    for (
        const file
        of scaffold.files
    ) {

        assertSafeRelativePath(
            file.path,
            "SCAFFOLD_FILE"
        );


        const normalized =
            normalizePath(
                file.path
            );


        if (
            normalized
            ===
            ".env"
            ||
            normalized
            ===
            ".git"
            ||
            normalized.startsWith(
                ".git/"
            )
            ||
            normalized
            ===
            "node_modules"
            ||
            normalized.startsWith(
                "node_modules/"
            )
            ||
            normalized
            ===
            "dist"
            ||
            normalized.startsWith(
                "dist/"
            )
        ) {

            throw new Error(
                `STACK_DISCOVERY_FORBIDDEN_SCAFFOLD_FILE:${file.path}`
            );

        }


        if (
            paths.has(
                normalized
            )
        ) {

            throw new Error(
                `STACK_DISCOVERY_DUPLICATE_SCAFFOLD_FILE:${file.path}`
            );

        }


        paths.add(
            normalized
        );


        if (
            file.content.length
            >
            100000
        ) {

            throw new Error(
                `STACK_DISCOVERY_SCAFFOLD_FILE_TOO_LARGE:${file.path}`
            );

        }

    }

}


// ============================================================
// SAFE PATH VALIDATION
// ============================================================


function assertSafeRelativePath(
    value:
        string,

    field:
        string
): void {

    const normalized =
        normalizePath(
            value
        );


    if (
        !normalized
    ) {

        throw new Error(
            `STACK_DISCOVERY_EMPTY_${field}`
        );

    }


    if (
        normalized.startsWith(
            "/"
        )
        ||
        /^[a-zA-Z]:\//.test(
            normalized
        )
        ||
        normalized
            .split(
                "/"
            )
            .includes(
                ".."
            )
    ) {

        throw new Error(
            `STACK_DISCOVERY_UNSAFE_${field}:${value}`
        );

    }

}


function normalizePath(
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
            /^(\.\/|\/)+/,
            ""
        )
        .toLowerCase();

}


// ============================================================
// TECHNOLOGY PRESERVATION
// ============================================================


function validateTechnologyPreservation(
    selection:
        BackendExecutionSelection,

    profile:
        BackendExecutionProfile
): void {

    assertTechnologySame(
        selection.language,
        profile.language,
        "LANGUAGE"
    );


    assertTechnologySame(
        selection.runtime,
        profile.runtime
        ??
        "",
        "RUNTIME"
    );


    assertTechnologySame(
        selection.framework,
        profile.framework,
        "FRAMEWORK"
    );


    assertTechnologySame(
        selection.packageManager,
        profile.packageManager
        ??
        "",
        "PACKAGE_MANAGER"
    );


    assertTechnologySame(
        selection.dataAccessTechnology,
        profile.orm
        ??
        "",
        "DATA_ACCESS"
    );


    assertTechnologySame(
        selection.databaseEngine,
        profile.databaseEngine
        ??
        "",
        "DATABASE_ENGINE"
    );


    assertTechnologySame(
        selection.cacheTechnology,
        profile.cache.technology,
        "CACHE_TECHNOLOGY"
    );


    if (
        selection.cacheRequired
        !==
        profile.cache.required
    ) {

        throw new Error(
            [
                "STACK_DISCOVERY_CACHE_REQUIRED_MISMATCH",
                `expected=${selection.cacheRequired}`,
                `actual=${profile.cache.required}`
            ].join(":")
        );

    }


    assertTechnologySame(
        selection.testFramework,
        profile.testFramework,
        "TEST_FRAMEWORK"
    );


    assertTechnologySame(
        selection.buildTool,
        profile.buildTool,
        "BUILD_TOOL"
    );

}


// ============================================================
// TECHNOLOGY ASSERTION
// ============================================================


function assertTechnologySame(
    expected:
        string,

    actual:
        string,

    field:
        string
): void {

    if (
        normalizeTechnology(
            expected
        )
        !==
        normalizeTechnology(
            actual
        )
    ) {

        throw new Error(
            [
                `STACK_DISCOVERY_${field}_MISMATCH`,
                `expected=${expected}`,
                `actual=${actual}`
            ].join(":")
        );

    }

}


// ============================================================
// HELPERS
// ============================================================


function normalizeTechnology(
    value:
        string
): string {

    return value
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9+#]/g,
            ""
        );

}


function slug(
    value:
        string
): string {

    return value
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9]+/g,
            "-"
        )
        .replace(
            /^-+|-+$/g,
            ""
        )
        ||
        "unknown";

}


function uniqueStrings(
    values:
        string[]
): string[] {

    const result:
        string[] =
        [];


    const seen =
        new Set<string>();


    for (
        const value
        of values
    ) {

        const trimmed =
            value.trim();


        if (
            !trimmed
        ) {

            continue;

        }


        const key =
            trimmed.toLowerCase();


        if (
            seen.has(
                key
            )
        ) {

            continue;

        }


        seen.add(
            key
        );


        result.push(
            trimmed
        );

    }


    return result;

}
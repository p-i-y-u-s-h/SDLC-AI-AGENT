import {
    readJSON,
    writeJSON
} from "../utils/fileManager.js";

import {
    technologyManifestSchema
} from "../schemas/technologyManifestSchema.js";

import {
    storageContractSchema
} from "../schemas/storageContractSchema.js";

import {
    backendExecutionProfileSchema
} from "../schemas/backendExecutionProfileSchema.js";

import type {
    BackendExecutionProfile
} from "../schemas/backendExecutionProfileSchema.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";

import {
    composeBackendExecutionProfile,
    findBackendApplicationProfile,
    findPersistenceExecutionProfile,
    findCacheExecutionProfile,
    findTestExecutionProfile,
    findBuildExecutionProfile
} from "../stack/backendExecutionProfiles.js";

import type {
    BackendExecutionSelection
} from "../stack/backendExecutionProfiles.js";

import {
    discoverBackendExecutionProfile
} from "./stackDiscoveryService.js";

import type {
    MissingBackendComponent
} from "./stackDiscoveryService.js";


export async function resolveBackendExecutionProfile(
    workspace:
        ProjectWorkspace
): Promise<
    BackendExecutionProfile
> {

    const technologyManifest =
        technologyManifestSchema.parse(
            readJSON(
                workspace.technologyManifest
            )
        );


    const storage =
        storageContractSchema.parse(
            readJSON(
                workspace.storageContract
            )
        );


    if (
        technologyManifest.projectName
        !==
        storage.projectName
    ) {

        throw new Error(
            "BACKEND_EXECUTION_PROJECT_MISMATCH"
        );

    }


    assertTechnologySame(
        technologyManifest.backend.orm.value,
        storage.dataAccessTechnology,
        "DATA_ACCESS"
    );


    assertTechnologySame(
        technologyManifest.database.engine.value,
        storage.engine,
        "DATABASE_ENGINE"
    );


    const selection:
        BackendExecutionSelection = {

        language:
            technologyManifest.backend.language.value,

        runtime:
            technologyManifest.backend.runtime.value,

        framework:
            technologyManifest.backend.framework.value,

        packageManager:
            technologyManifest.backend.packageManager.value,

        dataAccessTechnology:
            storage.dataAccessTechnology,

        databaseEngine:
            storage.engine,

        cacheRequired:
            technologyManifest.cache.required,

        cacheTechnology:
            technologyManifest.cache.technology.value,

        testFramework:
            technologyManifest.backend.testFramework.value,

        buildTool:
            technologyManifest.backend.buildTool.value

    };


    const application =
        findBackendApplicationProfile(
            selection
        );


    const persistence =
        findPersistenceExecutionProfile(
            selection
        );


    const cache =
        selection.cacheRequired
            ?
            findCacheExecutionProfile(
                selection
            )
            :
            null;


    const testing =
        findTestExecutionProfile(
            selection
        );


    const build =
        findBuildExecutionProfile(
            selection
        );


    const missingComponents:
        MissingBackendComponent[] =
        [];


    if (
        !application
    ) {

        missingComponents.push(
            "APPLICATION"
        );

    }


    if (
        !persistence
    ) {

        missingComponents.push(
            "PERSISTENCE"
        );

    }


    if (
        selection.cacheRequired
        &&
        !cache
    ) {

        missingComponents.push(
            "CACHE"
        );

    }


    if (
        !testing
    ) {

        missingComponents.push(
            "TEST"
        );

    }


    if (
        !build
    ) {

        missingComponents.push(
            "BUILD"
        );

    }


    let profile:
        BackendExecutionProfile;


    if (
        missingComponents.length
        >
        0
    ) {

        profile =
            await discoverBackendExecutionProfile(
                workspace,
                selection,
                missingComponents
            );

    }
    else {

        profile =
            backendExecutionProfileSchema.parse(
                composeBackendExecutionProfile(
                    selection,
                    application!,
                    persistence!,
                    cache,
                    testing!,
                    build!
                )
            );

    }


    validateTechnologyPreservation(
        selection,
        profile
    );


    validateCommandSecurity(
        profile
    );


    writeJSON(
        workspace.backendExecutionProfile,
        profile
    );


    return profile;

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


    if (
        selection.cacheRequired
        !==
        profile.cache.required
    ) {

        throw new Error(
            "BACKEND_EXECUTION_CACHE_REQUIRED_MISMATCH"
        );

    }


    assertTechnologySame(
        selection.cacheTechnology,
        profile.cache.technology,
        "CACHE_TECHNOLOGY"
    );


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
// COMMAND SECURITY
// ============================================================


function validateCommandSecurity(
    profile:
        BackendExecutionProfile
): void {

    const commands = [

        ...(
            profile.commands.bootstrap
            ??
            []
        ),

        ...profile.commands.setup,

        ...profile.commands.focusedValidation,

        ...profile.commands.fullValidation,

        ...(
            profile.commands.preview
                ?
                [
                    profile.commands.preview
                ]
                :
                []
        )

    ];


    const allowed =
        new Set(
            profile.allowedExecutables.map(
                executable =>
                    executable
                        .trim()
                        .toLowerCase()
            )
        );


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
            "wsl"
        ]);


    for (
        const command
        of commands
    ) {

        const executable =
            command.executable
                .trim()
                .toLowerCase();


        if (
            forbiddenExecutables.has(
                executable
            )
        ) {

            throw new Error(
                `BACKEND_EXECUTION_FORBIDDEN_EXECUTABLE:${command.name}:${command.executable}`
            );

        }


        if (
            !allowed.has(
                executable
            )
        ) {

            throw new Error(
                `BACKEND_EXECUTION_EXECUTABLE_NOT_ALLOWED:${command.name}:${command.executable}`
            );

        }


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
                    `BACKEND_EXECUTION_UNSAFE_ARGUMENT:${command.name}:${argument}`
                );

            }

        }

    }

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
// HELPERS
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
            `BACKEND_EXECUTION_${field}_MISMATCH:${expected}:${actual}`
        );

    }

}


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
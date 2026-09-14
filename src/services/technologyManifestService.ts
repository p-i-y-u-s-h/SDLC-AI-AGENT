import {
    readJSON,
    writeJSON
} from "../utils/fileManager.js";

import {
    requirementSchema
} from "../schemas/requirementSchema.js";

import {
    architectureSchema
} from "../schemas/architectureSchema.js";

import {
    technologyManifestSchema
} from "../schemas/technologyManifestSchema.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";

import type {
    StorageModel,
    TechnologyChoice,
    TechnologyManifest
} from "../types/technology.js";


export function generateTechnologyManifest(
    workspace:
        ProjectWorkspace
): TechnologyManifest {

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


    validateProjectIdentity(
        requirements.projectName,
        architecture.projectName
    );


    // ============================================================
    // USER-EXPLICIT TECHNOLOGY CONSTRAINTS
    // ============================================================


    const explicitConstraints =
        new Map<
            string,
            string
        >();


    for (
        const constraint
        of requirements.technologyConstraints
    ) {

        if (
            constraint.locked
            !==
            true
        ) {

            continue;

        }


        explicitConstraints.set(
            normalizeKey(
                constraint.key
            ),
            constraint.value
        );

    }


    // ============================================================
    // DATABASE MODEL
    // ============================================================


    const databaseModel =
        resolveTechnology(
            explicitConstraints,
            "database.model",
            architecture.database.model
        ) as TechnologyChoice<StorageModel>;


    // ============================================================
    // TECHNOLOGY MANIFEST
    // ============================================================


    const manifest:
        TechnologyManifest = {

        projectName:
            requirements.projectName,


        // ========================================================
        // BACKEND
        // ========================================================

        backend: {

            language:
                resolveTechnology(
                    explicitConstraints,
                    "backend.language",
                    architecture.backend.language
                ),

            runtime:
                resolveTechnology(
                    explicitConstraints,
                    "backend.runtime",
                    architecture.backend.runtime
                ),

            framework:
                resolveTechnology(
                    explicitConstraints,
                    "backend.framework",
                    architecture.backend.framework
                ),

            packageManager:
                resolveTechnology(
                    explicitConstraints,
                    "backend.packageManager",
                    architecture.backend.packageManager
                ),

            orm:
                resolveTechnology(
                    explicitConstraints,
                    "backend.orm",
                    architecture.backend.orm
                ),

            apiStyle:
                resolveTechnology(
                    explicitConstraints,
                    "backend.apiStyle",
                    architecture.backend.apiStyle
                ),

            testFramework:
                resolveTechnology(
                    explicitConstraints,
                    "backend.testFramework",
                    architecture.backend.testFramework
                ),

            buildTool:
                resolveTechnology(
                    explicitConstraints,
                    "backend.buildTool",
                    architecture.backend.buildTool
                )

        },


        // ========================================================
        // PRIMARY DATABASE
        // ========================================================

        database: {

            model:
                databaseModel,

            engine:
                resolveTechnology(
                    explicitConstraints,
                    "database.engine",
                    architecture.database.engine
                )

        },


        // ========================================================
        // CACHE
        // ========================================================

        cache: {

            required:
                architecture.cache.required,

            technology:
                resolveTechnology(
                    explicitConstraints,
                    "cache.technology",
                    architecture.cache.technology
                )

        },


        // ========================================================
        // FRONTEND
        // ========================================================

        frontend: {

            language:
                resolveTechnology(
                    explicitConstraints,
                    "frontend.language",
                    architecture.frontend.language
                ),

            framework:
                resolveTechnology(
                    explicitConstraints,
                    "frontend.framework",
                    architecture.frontend.framework
                ),

            styling:
                resolveTechnology(
                    explicitConstraints,
                    "frontend.styling",
                    architecture.frontend.styling
                )

        }

    };


    // ============================================================
    // CROSS-FIELD CACHE VALIDATION
    // ============================================================


    validateCacheSelection(
        manifest.cache.required,
        manifest.cache.technology.value
    );


    // ============================================================
    // SCHEMA VALIDATION
    // ============================================================


    const validatedManifest =
        technologyManifestSchema.parse(
            manifest
        );


    // ============================================================
    // WRITE ARTIFACT
    // ============================================================


    writeJSON(
        workspace.technologyManifest,
        validatedManifest
    );


    console.log(
        `✅ ${workspace.technologyManifest} created`
    );


    return validatedManifest;

}


// ============================================================
// TECHNOLOGY RESOLUTION
// ============================================================


function resolveTechnology<
    T extends string
>(
    explicitConstraints:
        Map<
            string,
            string
        >,

    key:
        string,

    architectureValue:
        T
): TechnologyChoice<T> {

    if (
        !architectureValue
        ||
        !architectureValue.trim()
    ) {

        throw new Error(
            `ARCHITECTURE_TECHNOLOGY_MISSING:${key}`
        );

    }


    const explicitValue =
        explicitConstraints.get(
            normalizeKey(
                key
            )
        );


    // ========================================================
    // USER EXPLICIT
    // ========================================================


    if (
        explicitValue
    ) {

        if (
            normalizeValue(
                explicitValue
            )
            !==
            normalizeValue(
                architectureValue
            )
        ) {

            throw new Error(
                [
                    "ARCHITECTURE_VIOLATED_USER_TECH_CONSTRAINT",
                    `${key}`,
                    `expected="${explicitValue}"`,
                    `actual="${architectureValue}"`
                ].join(":")
            );

        }


        return {

            value:
                architectureValue,

            source:
                "USER_EXPLICIT",

            locked:
                true

        };

    }


    // ========================================================
    // ARCHITECTURE SELECTED
    // ========================================================


    return {

        value:
            architectureValue,

        source:
            "ARCHITECTURE_AGENT",

        locked:
            false

    };

}


// ============================================================
// CACHE VALIDATION
// ============================================================


function validateCacheSelection(
    required:
        boolean,
    technology:
        string
): void {

    const normalized =
        normalizeValue(
            technology
        );


    const representsNoCache =
        normalized
        ===
        "none"
        ||
        normalized
        ===
        "nocache"
        ||
        normalized
        ===
        "disabled";


    if (
        required
        &&
        representsNoCache
    ) {

        throw new Error(
            "TECHNOLOGY_MANIFEST_CACHE_REQUIRED_WITHOUT_TECHNOLOGY"
        );

    }


    if (
        !required
        &&
        !representsNoCache
    ) {

        throw new Error(
            `TECHNOLOGY_MANIFEST_CACHE_DISABLED_WITH_TECHNOLOGY:${technology}`
        );

    }

}


// ============================================================
// PROJECT CONSISTENCY
// ============================================================


function validateProjectIdentity(
    requirementProjectName:
        string,
    architectureProjectName:
        string
): void {

    if (
        normalizeValue(
            requirementProjectName
        )
        !==
        normalizeValue(
            architectureProjectName
        )
    ) {

        throw new Error(
            [
                "ARCHITECTURE_PROJECT_MISMATCH",
                `expected="${requirementProjectName}"`,
                `actual="${architectureProjectName}"`
            ].join(":")
        );

    }

}


// ============================================================
// NORMALIZATION
// ============================================================


function normalizeKey(
    value:
        string
): string {

    return value
        .trim()
        .toLowerCase()
        .replace(
            /\s+/g,
            ""
        );

}


function normalizeValue(
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
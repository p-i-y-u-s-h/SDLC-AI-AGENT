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

import {
    storageContractSchema
} from "../schemas/storageContractSchema.js";

import {
    backendExecutionProfileSchema
} from "../schemas/backendExecutionProfileSchema.js";

import {
    backendContractSchema
} from "../schemas/backendContractSchema.js";

import type {
    StorageContractSchema
} from "../schemas/storageContractSchema.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";


export function generateBackendContract(
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


    const storage =
        storageContractSchema.parse(
            readJSON(
                workspace.storageContract
            )
        );


    const executionProfile =
        backendExecutionProfileSchema.parse(
            readJSON(
                workspace.backendExecutionProfile
            )
        );


    validateProjectConsistency(
        requirements.projectName,
        architecture.projectName,
        storage.projectName
    );


    validateTechnologyConsistency(
        manifest,
        storage,
        executionProfile
    );


    validateArchitectureModules(
        architecture.backend.modules,
        architecture.apiModules
    );


    const modules =
        architecture.backend.modules.map(
            module => ({

                name:
                    module.name,

                responsibility:
                    module.responsibility,

                dependsOn:
                    module.dependsOn,

                apiGroups:
                    architecture.apiModules
                        .filter(
                            api =>
                                api.ownerModule ===
                                module.name
                        )
                        .map(
                            api => ({

                                name:
                                    api.name,

                                routePrefix:
                                    api.routePrefix,

                                responsibility:
                                    api.responsibility,

                                methods:
                                    api.methods

                            })
                        )

            })
        );


    const storageSummary =
        buildStorageSummary(
            storage
        );


    const backendContract =
        backendContractSchema.parse({

            projectName:
                requirements.projectName,

            architectureStyle:
                architecture.architectureStyle,

            technology: {

                language:
                    manifest.backend.language.value,

                runtime:
                    manifest.backend.runtime.value,

                framework:
                    manifest.backend.framework.value,

                packageManager:
                    manifest.backend.packageManager.value,

                dataAccessTechnology:
                    manifest.backend.orm.value,

                apiStyle:
                    manifest.backend.apiStyle.value,

                testFramework:
                    manifest.backend.testFramework.value,

                buildTool:
                    manifest.backend.buildTool.value

            },

            database: {

                model:
                    manifest.database.model.value,

                engine:
                    manifest.database.engine.value,

                databaseName:
                    storage.databaseName,

                dataAccessTechnology:
                    storage.dataAccessTechnology

            },

            cache: {

                required:
                    architecture.cache.required,

                technology:
                    architecture.cache.technology,

                useCases:
                    architecture.cache.useCases

            },

            authentication: {

                required:
                    architecture.authentication.required,

                strategy:
                    architecture.authentication.strategy,

                description:
                    architecture.authentication.description

            },

            actors:
                requirements.actors,

            functionalRequirements:
                requirements.functionalRequirements,

            nonFunctionalRequirements:
                requirements.nonFunctionalRequirements,

            entities:
                requirements.entities,

            constraints:
                requirements.constraints,

            assumptions:
                requirements.assumptions,

            modules,

            storage:
                storageSummary,

            externalIntegrations:
                architecture.externalIntegrations,

            execution: {

                profileId:
                    executionProfile.id,

                resolvedBy:
                    executionProfile.resolvedBy,

                sourceRoots:
                    executionProfile.sourceRoots,

                testRoots:
                    executionProfile.testRoots,

                dependencyFiles:
                    executionProfile.dependencyFiles,

                writablePathPatterns:
                    executionProfile.writablePathPatterns,

                sharedPathPatterns:
                    executionProfile.sharedPathPatterns,

                protectedPathPatterns:
                    executionProfile.protectedPathPatterns,

                allowedExecutables:
                    executionProfile.allowedExecutables

            },

            implementationRules: [

                "Use the technology stack defined by the technology manifest.",

                "Do not replace the selected runtime, framework, package manager, database engine, or data access technology.",

                "Use storage-contract.json as the authoritative physical storage design.",

                "Use backend-execution-profile.json as the authoritative source for executable commands and repository path restrictions.",

                "Respect backend module boundaries and declared module dependencies.",

                "Keep transport and HTTP concerns separate from business logic.",

                "Keep persistence logic isolated from controllers and route handlers.",

                "Validate all externally supplied input.",

                "Implement authentication and authorization according to the architecture contract.",

                "Keep external integrations behind dedicated services or adapters.",

                "Do not modify files matching protected path patterns.",

                "Do not invent API endpoint paths outside the API contract once api-contract.json exists."

            ]

        });


    writeJSON(
        workspace.backendContract,
        backendContract
    );


    const apiGroupCount =
        backendContract.modules.reduce(
            (
                total,
                module
            ) =>
                total +
                module.apiGroups.length,
            0
        );


    console.log(
        `✅ Backend Contract: ${backendContract.modules.length} modules | ${apiGroupCount} API groups`
    );


    return backendContract;

}


function buildStorageSummary(
    storage: StorageContractSchema
) {

    switch (
        storage.model
    ) {

        case "RELATIONAL":

            return {

                resources:
                    storage.design.tables.map(
                        table => ({

                            name:
                                table.name,

                            kind:
                                "TABLE" as const

                        })
                    ),

                relationships:
                    storage.design.relationships.map(
                        relationship => ({

                            from:
                                relationship.fromTable,

                            to:
                                relationship.toTable,

                            type:
                                relationship.type,

                            description:
                                relationship.description

                        })
                    )

            };


        case "DOCUMENT":

            return {

                resources:
                    storage.design.collections.map(
                        collection => ({

                            name:
                                collection.name,

                            kind:
                                "COLLECTION" as const

                        })
                    ),

                relationships:
                    storage.design.relationships.map(
                        relationship => ({

                            from:
                                relationship.fromCollection,

                            to:
                                relationship.toCollection,

                            type:
                                relationship.strategy,

                            description:
                                relationship.description

                        })
                    )

            };


        case "GRAPH":

            return {

                resources:
                    storage.design.nodes.map(
                        node => ({

                            name:
                                node.label,

                            kind:
                                "NODE" as const

                        })
                    ),

                relationships:
                    storage.design.relationships.map(
                        relationship => ({

                            from:
                                relationship.fromNode,

                            to:
                                relationship.toNode,

                            type:
                                relationship.type,

                            description:
                                relationship.description

                        })
                    )

            };


        case "KEY_VALUE":

            return {

                resources:
                    storage.design.keySpaces.map(
                        keySpace => ({

                            name:
                                keySpace.name,

                            kind:
                                "KEY_SPACE" as const

                        })
                    ),

                relationships:
                    []

            };

    }

}


function validateProjectConsistency(
    requirementProjectName: string,
    architectureProjectName: string,
    storageProjectName: string
) {

    const requirement =
        normalize(
            requirementProjectName
        );


    const architecture =
        normalize(
            architectureProjectName
        );


    const storage =
        normalize(
            storageProjectName
        );


    if (
        requirement !== architecture
        ||
        requirement !== storage
    ) {

        throw new Error(
            [
                "BACKEND_CONTRACT_PROJECT_MISMATCH",
                `Requirements: ${requirementProjectName}`,
                `Architecture: ${architectureProjectName}`,
                `Storage: ${storageProjectName}`
            ].join(
                "\n"
            )
        );

    }

}


function validateTechnologyConsistency(
    manifest: any,
    storage: StorageContractSchema,
    executionProfile: any
) {

    if (
        storage.model !==
        manifest.database.model.value
    ) {

        throw new Error(
            [
                "BACKEND_CONTRACT_STORAGE_MODEL_MISMATCH",
                `Manifest: ${manifest.database.model.value}`,
                `Storage: ${storage.model}`
            ].join(
                "\n"
            )
        );

    }


    if (
        normalize(
            storage.engine
        )
        !==
        normalize(
            manifest.database.engine.value
        )
    ) {

        throw new Error(
            [
                "BACKEND_CONTRACT_DATABASE_ENGINE_MISMATCH",
                `Manifest: ${manifest.database.engine.value}`,
                `Storage: ${storage.engine}`
            ].join(
                "\n"
            )
        );

    }


    if (
        normalize(
            storage.dataAccessTechnology
        )
        !==
        normalize(
            manifest.backend.orm.value
        )
    ) {

        throw new Error(
            [
                "BACKEND_CONTRACT_DATA_ACCESS_MISMATCH",
                `Manifest: ${manifest.backend.orm.value}`,
                `Storage: ${storage.dataAccessTechnology}`
            ].join(
                "\n"
            )
        );

    }


    validateOptionalTechnology(
        "language",
        executionProfile.language,
        manifest.backend.language.value
    );


    validateOptionalTechnology(
        "runtime",
        executionProfile.runtime,
        manifest.backend.runtime.value
    );


    validateOptionalTechnology(
        "framework",
        executionProfile.framework,
        manifest.backend.framework.value
    );


    validateOptionalTechnology(
        "package manager",
        executionProfile.packageManager,
        manifest.backend.packageManager.value
    );


    validateOptionalTechnology(
        "data access technology",
        executionProfile.orm,
        manifest.backend.orm.value
    );


    validateOptionalTechnology(
        "database engine",
        executionProfile.databaseEngine,
        manifest.database.engine.value
    );

}


function validateOptionalTechnology(
    name: string,
    executionValue: string | undefined,
    manifestValue: string
) {

    if (
        !executionValue
    ) {

        return;

    }


    if (
        normalize(
            executionValue
        )
        !==
        normalize(
            manifestValue
        )
    ) {

        throw new Error(
            [
                "BACKEND_CONTRACT_EXECUTION_PROFILE_MISMATCH",
                `Technology: ${name}`,
                `Execution Profile: ${executionValue}`,
                `Technology Manifest: ${manifestValue}`
            ].join(
                "\n"
            )
        );

    }

}


function validateArchitectureModules(
    modules: Array<{
        name: string;
        dependsOn: string[];
    }>,
    apiModules: Array<{
        ownerModule: string;
    }>
) {

    const moduleNames =
        new Set(
            modules.map(
                module =>
                    module.name
            )
        );


    for (
        const module of modules
    ) {

        for (
            const dependency of module.dependsOn
        ) {

            if (
                !moduleNames.has(
                    dependency
                )
            ) {

                throw new Error(
                    [
                        "BACKEND_CONTRACT_UNKNOWN_MODULE_DEPENDENCY",
                        `Module: ${module.name}`,
                        `Dependency: ${dependency}`
                    ].join(
                        "\n"
                    )
                );

            }

        }

    }


    for (
        const api of apiModules
    ) {

        if (
            !moduleNames.has(
                api.ownerModule
            )
        ) {

            throw new Error(
                [
                    "BACKEND_CONTRACT_UNKNOWN_API_OWNER",
                    `Owner Module: ${api.ownerModule}`
                ].join(
                    "\n"
                )
            );

        }

    }

}


function normalize(
    value: string
) {

    return value
        .trim()
        .toLowerCase()
        .replace(
            /[^a-z0-9]/g,
            ""
        );

}
import type {
    BackendContract
} from "../schemas/backendContractSchema.js";

import type {
    StorageContractSchema
} from "../schemas/storageContractSchema.js";


export function buildApiContractContext(
    backend:
        BackendContract,
    storage:
        StorageContractSchema
) {

    return {

        projectName:
            backend.projectName,

        apiStyle:
            backend.technology.apiStyle,

        authentication:
            backend.authentication,

        actors:
            backend.actors,

        functionalRequirements:
            backend.functionalRequirements,

        nonFunctionalRequirements:
            backend.nonFunctionalRequirements,

        constraints:
            backend.constraints,

        modules:
            backend.modules.map(
                module => ({

                    name:
                        module.name,

                    responsibility:
                        module.responsibility,

                    dependsOn:
                        module.dependsOn,

                    apiGroups:
                        module.apiGroups

                })
            ),

        externalIntegrations:
            backend.externalIntegrations,

        storage:
            compactStorage(
                storage
            )

    };

}


function compactStorage(
    storage:
        StorageContractSchema
) {

    switch (
        storage.model
    ) {

        case "RELATIONAL":

            return {

                model:
                    storage.model,

                engine:
                    storage.engine,

                tables:
                    storage.design.tables.map(
                        table => ({

                            name:
                                table.name,

                            columns:
                                table.columns.map(
                                    column => ({

                                        name:
                                            column.name,

                                        type:
                                            column.type,

                                        nullable:
                                            column.nullable,

                                        primaryKey:
                                            column.primaryKey,

                                        unique:
                                            column.unique

                                    })
                                )

                        })
                    ),

                relationships:
                    storage.design.relationships.map(
                        relationship => ({

                            fromTable:
                                relationship.fromTable,

                            fromColumn:
                                relationship.fromColumn,

                            toTable:
                                relationship.toTable,

                            toColumn:
                                relationship.toColumn,

                            type:
                                relationship.type

                        })
                    )

            };


        case "DOCUMENT":

            return {

                model:
                    storage.model,

                engine:
                    storage.engine,

                collections:
                    storage.design.collections.map(
                        collection => ({

                            name:
                                collection.name,

                            fields:
                                collection.fields.map(
                                    field => ({

                                        name:
                                            field.name,

                                        type:
                                            field.type,

                                        required:
                                            field.required,

                                        unique:
                                            field.unique

                                    })
                                )

                        })
                    ),

                relationships:
                    storage.design.relationships

            };


        case "GRAPH":

            return {

                model:
                    storage.model,

                engine:
                    storage.engine,

                nodes:
                    storage.design.nodes,

                relationships:
                    storage.design.relationships

            };


        case "KEY_VALUE":

            return {

                model:
                    storage.model,

                engine:
                    storage.engine,

                keySpaces:
                    storage.design.keySpaces,

                accessPatterns:
                    storage.design.accessPatterns

            };

    }

}
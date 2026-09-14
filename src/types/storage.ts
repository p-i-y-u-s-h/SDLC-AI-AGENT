import type {
    StorageModel
} from "./technology.js";


export type StorageDefaultValue =
    string
    | number
    | boolean
    | null;


export type StorageJsonValue =
    string
    | number
    | boolean
    | null
    | StorageJsonValue[]
    | {
        [key: string]:
            StorageJsonValue;
    };


export interface StorageIndex {

    name: string;

    fields: string[];

    unique: boolean;

    purpose: string;

}


interface StorageContractBase {

    projectName: string;

    model: StorageModel;

    engine: string;

    databaseName: string;

    dataAccessTechnology: string;

}


export interface RelationalColumn {

    name: string;

    type: string;

    nullable: boolean;

    primaryKey: boolean;

    unique: boolean;

    defaultValue: StorageDefaultValue;

}


export interface RelationalTable {

    name: string;

    description: string;

    columns: RelationalColumn[];

    indexes: StorageIndex[];

}


export interface RelationalRelationship {

    fromTable: string;

    fromColumn: string;

    toTable: string;

    toColumn: string;

    type:
        | "one-to-one"
        | "one-to-many"
        | "many-to-one"
        | "many-to-many";

    onDelete:
        | "CASCADE"
        | "RESTRICT"
        | "SET_NULL"
        | "NO_ACTION";

    description: string;

}


export interface RelationalStorageContract
    extends StorageContractBase {

    model: "RELATIONAL";

    design: {

        tables:
            RelationalTable[];

        relationships:
            RelationalRelationship[];

        normalization: {

            normalForm: string;

            explanation: string;

        };

    };

}


export interface DocumentField {

    name: string;

    type: string;

    required: boolean;

    unique: boolean;

    defaultValue: StorageJsonValue;

}


export interface DocumentCollection {

    name: string;

    description: string;

    fields:
        DocumentField[];

    indexes:
        StorageIndex[];

}


export interface DocumentRelationship {

    fromCollection: string;

    toCollection: string;

    strategy:
        | "REFERENCE"
        | "EMBEDDED";

    field: string;

    description: string;

}


export interface DocumentStorageContract
    extends StorageContractBase {

    model: "DOCUMENT";

    design: {

        collections:
            DocumentCollection[];

        relationships:
            DocumentRelationship[];

    };

}


export interface GraphProperty {

    name: string;

    type: string;

    required: boolean;

    unique: boolean;

}


export interface GraphNode {

    label: string;

    description: string;

    properties:
        GraphProperty[];

    indexes:
        StorageIndex[];

}


export interface GraphRelationship {

    type: string;

    fromNode: string;

    toNode: string;

    description: string;

    properties:
        GraphProperty[];

}


export interface GraphStorageContract
    extends StorageContractBase {

    model: "GRAPH";

    design: {

        nodes:
            GraphNode[];

        relationships:
            GraphRelationship[];

        constraints:
            string[];

    };

}


export interface KeyValueField {

    name: string;

    type: string;

    required: boolean;

}


export interface KeySpace {

    name: string;

    keyPattern: string;

    description: string;

    valueType: string;

    valueFields:
        KeyValueField[];

    ttlSeconds:
        number | null;

}


export interface KeyValueAccessPattern {

    name: string;

    keySpace: string;

    operation: string;

    description: string;

}


export interface KeyValueStorageContract
    extends StorageContractBase {

    model: "KEY_VALUE";

    design: {

        keySpaces:
            KeySpace[];

        accessPatterns:
            KeyValueAccessPattern[];

    };

}


export type StorageContract =
    | RelationalStorageContract
    | DocumentStorageContract
    | GraphStorageContract
    | KeyValueStorageContract;
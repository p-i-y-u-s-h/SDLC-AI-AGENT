export type TechnologySource =
    | "USER_EXPLICIT"
    | "ARCHITECTURE_AGENT";


export type StorageModel =
    | "RELATIONAL"
    | "DOCUMENT"
    | "GRAPH"
    | "KEY_VALUE";


export interface TechnologyChoice<
    T extends string = string
> {

    value:
        T;

    source:
        TechnologySource;

    locked:
        boolean;

}


export interface TechnologyManifest {

    projectName:
        string;

    backend: {

        language:
            TechnologyChoice;

        runtime:
            TechnologyChoice;

        framework:
            TechnologyChoice;

        packageManager:
            TechnologyChoice;

        orm:
            TechnologyChoice;

        apiStyle:
            TechnologyChoice;

        testFramework:
            TechnologyChoice;

        buildTool:
            TechnologyChoice;

    };

    database: {

        model:
            TechnologyChoice<
                StorageModel
            >;

        engine:
            TechnologyChoice;

    };

    cache: {

        required:
            boolean;

        technology:
            TechnologyChoice;

    };

    frontend: {

        language:
            TechnologyChoice;

        framework:
            TechnologyChoice;

        styling:
            TechnologyChoice;

    };

}
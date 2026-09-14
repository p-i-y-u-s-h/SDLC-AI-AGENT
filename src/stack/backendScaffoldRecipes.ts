export interface BackendScaffoldFile {
    path: string;
    content: string;
}


export interface BackendScaffoldRecipe {
    profileId: string;
    directories: string[];
    files: BackendScaffoldFile[];
}


interface ScaffoldRecipeInput {

    projectName: string;

    projectSlug: string;

    profile: {

        id: string;

        resolvedBy:
            "BUILT_IN"
            |
            "DISCOVERED";

        language: string;

        framework: string;

        runtime?: string;

        packageManager?: string;

        orm?: string;

        databaseEngine?: string;

        cache?: {
            required: boolean;
            technology: string;
        };

        testFramework?: string;

        buildTool?: string;

        scaffold?: {

            directories:
                string[];

            files:
                BackendScaffoldFile[];

        };

    };

}


interface PackageContribution {

    scripts:
        Record<string, string>;

    dependencies:
        Record<string, string>;

    devDependencies:
        Record<string, string>;

    packageFields?:
        Record<string, unknown>;

}


interface ScaffoldFragment {

    directories:
        string[];

    files:
        BackendScaffoldFile[];

    packageContribution:
        PackageContribution;

    compilerTypes?:
        string[];

}


// ============================================================
// MAIN RESOLVER
// ============================================================


export function resolveBackendScaffoldRecipe(
    input:
        ScaffoldRecipeInput
): BackendScaffoldRecipe {

    if (
        input.profile.resolvedBy
        ===
        "DISCOVERED"
    ) {

        return resolveDiscoveredBackendScaffold(
            input
        );

    }


    const testing =
        resolveTestScaffold(
            input
        );


    const build =
        resolveBuildScaffold(
            input
        );


    const compilerTypes =
        uniqueStrings([
            "node",
            ...(
                testing.compilerTypes
                ??
                []
            )
        ]);


    const application =
        resolveApplicationScaffold(
            input,
            compilerTypes
        );


    const persistence =
        resolvePersistenceScaffold(
            input
        );


    const cache =
        resolveCacheScaffold(
            input
        );


    const packageJson =
        createPackageJson(
            input.projectName,
            input.projectSlug,
            [
                application.packageContribution,
                persistence.packageContribution,
                cache.packageContribution,
                testing.packageContribution,
                build.packageContribution
            ]
        );


    return {

        profileId:
            input.profile.id,

        directories:
            uniqueStrings([
                ...application.directories,
                ...persistence.directories,
                ...cache.directories,
                ...testing.directories,
                ...build.directories
            ]),

        files:
            mergeFiles([
                {
                    path:
                        "package.json",

                    content:
                        packageJson
                },

                ...application.files,
                ...persistence.files,
                ...cache.files,
                ...testing.files,
                ...build.files
            ])

    };

}


// ============================================================
// DISCOVERED STACK SCAFFOLD
// ============================================================


function resolveDiscoveredBackendScaffold(
    input:
        ScaffoldRecipeInput
): BackendScaffoldRecipe {

    const scaffold =
        input.profile.scaffold;


    if (
        !scaffold
    ) {

        throw new Error(
            `BACKEND_DISCOVERED_SCAFFOLD_MISSING:${input.profile.id}`
        );

    }


    if (
        scaffold.files.length
        >
        50
    ) {

        throw new Error(
            `BACKEND_DISCOVERED_SCAFFOLD_TOO_MANY_FILES:${scaffold.files.length}`
        );

    }


    const directories =
        uniqueStrings(
            scaffold.directories.map(
                directory => {

                    validateDiscoveredPath(
                        directory,
                        "DIRECTORY"
                    );


                    return directory;

                }
            )
        );


    const files =
        mergeFiles(
            scaffold.files.map(
                file => {

                    validateDiscoveredPath(
                        file.path,
                        "FILE"
                    );


                    if (
                        file.content.length
                        >
                        100000
                    ) {

                        throw new Error(
                            `BACKEND_DISCOVERED_SCAFFOLD_FILE_TOO_LARGE:${file.path}`
                        );

                    }


                    return {

                        path:
                            file.path,

                        content:
                            renderDiscoveredTemplate(
                                file.content,
                                input
                            )

                    };

                }
            )
        );


    return {

        profileId:
            input.profile.id,

        directories,

        files

    };

}


function renderDiscoveredTemplate(
    content:
        string,

    input:
        ScaffoldRecipeInput
): string {

    return content
        .replaceAll(
            "{{PROJECT_NAME}}",
            input.projectName
        )
        .replaceAll(
            "{{PROJECT_SLUG}}",
            input.projectSlug
        );

}


function validateDiscoveredPath(
    value:
        string,

    category:
        string
): void {

    const trimmed =
        value.trim();


    if (
        !trimmed
    ) {

        throw new Error(
            `BACKEND_DISCOVERED_SCAFFOLD_EMPTY_${category}_PATH`
        );

    }


    const normalized =
        trimmed
            .replace(
                /\\/g,
                "/"
            )
            .replace(
                /^\.\/+/,
                ""
            );


    const lower =
        normalized
            .toLowerCase();


    if (
        normalized.startsWith(
            "/"
        )
        ||
        /^[a-zA-Z]:\//.test(
            normalized
        )
    ) {

        throw new Error(
            `BACKEND_DISCOVERED_SCAFFOLD_ABSOLUTE_PATH_NOT_ALLOWED:${value}`
        );

    }


    const pathParts =
        normalized
            .split(
                "/"
            );


    if (
        pathParts.includes(
            ".."
        )
    ) {

        throw new Error(
            `BACKEND_DISCOVERED_SCAFFOLD_PARENT_PATH_NOT_ALLOWED:${value}`
        );

    }


    if (
        lower
        ===
        ".env"
    ) {

        throw new Error(
            "BACKEND_DISCOVERED_SCAFFOLD_ENV_FILE_NOT_ALLOWED"
        );

    }


    if (
        lower
        ===
        ".git"
        ||
        lower.startsWith(
            ".git/"
        )
    ) {

        throw new Error(
            `BACKEND_DISCOVERED_SCAFFOLD_GIT_PATH_NOT_ALLOWED:${value}`
        );

    }


    if (
        lower
        ===
        "node_modules"
        ||
        lower.startsWith(
            "node_modules/"
        )
    ) {

        throw new Error(
            `BACKEND_DISCOVERED_SCAFFOLD_NODE_MODULES_NOT_ALLOWED:${value}`
        );

    }


    if (
        lower
        ===
        "dist"
        ||
        lower.startsWith(
            "dist/"
        )
    ) {

        throw new Error(
            `BACKEND_DISCOVERED_SCAFFOLD_DIST_PATH_NOT_ALLOWED:${value}`
        );

    }

}


// ============================================================
// APPLICATION RESOLVER
// ============================================================


function resolveApplicationScaffold(
    input:
        ScaffoldRecipeInput,
    compilerTypes:
        string[]
): ScaffoldFragment {

    if (
        technologyEquals(
            input.profile.language,
            "TypeScript"
        )
        &&
        technologyEquals(
            input.profile.runtime,
            "Node.js"
        )
        &&
        technologyEquals(
            input.profile.framework,
            "Express.js"
        )
        &&
        technologyEquals(
            input.profile.packageManager,
            "npm"
        )
    ) {

        return createTypeScriptExpressFragment(
            compilerTypes
        );

    }


    if (
        technologyEquals(
            input.profile.language,
            "TypeScript"
        )
        &&
        technologyEquals(
            input.profile.runtime,
            "Node.js"
        )
        &&
        technologyEquals(
            input.profile.framework,
            "NestJS"
        )
        &&
        technologyEquals(
            input.profile.packageManager,
            "npm"
        )
    ) {

        return createTypeScriptNestFragment(
            compilerTypes
        );

    }


    throw new Error(
        [
            "BACKEND_APPLICATION_SCAFFOLD_NOT_FOUND",
            input.profile.language,
            input.profile.runtime
            ??
            "MISSING",
            input.profile.framework,
            input.profile.packageManager
            ??
            "MISSING"
        ].join(":")
    );

}


// ============================================================
// PERSISTENCE RESOLVER
// ============================================================


function resolvePersistenceScaffold(
    input:
        ScaffoldRecipeInput
): ScaffoldFragment {

    if (
        technologyEquals(
            input.profile.orm,
            "Prisma"
        )
        &&
        technologyEquals(
            input.profile.databaseEngine,
            "PostgreSQL"
        )
    ) {

        return createPrismaPostgreSQLFragment();

    }


    if (
        technologyEquals(
            input.profile.orm,
            "Drizzle ORM"
        )
        &&
        technologyEquals(
            input.profile.databaseEngine,
            "PostgreSQL"
        )
    ) {

        return createDrizzlePostgreSQLFragment();

    }


    throw new Error(
        [
            "BACKEND_PERSISTENCE_SCAFFOLD_NOT_FOUND",
            input.profile.orm
            ??
            "MISSING",
            input.profile.databaseEngine
            ??
            "MISSING"
        ].join(":")
    );

}


// ============================================================
// CACHE RESOLVER
// ============================================================


function resolveCacheScaffold(
    input:
        ScaffoldRecipeInput
): ScaffoldFragment {

    const cache =
        input.profile.cache;


    if (
        !cache
    ) {

        throw new Error(
            "BACKEND_CACHE_SCAFFOLD_CONFIGURATION_MISSING"
        );

    }


    if (
        !cache.required
    ) {

        if (
            !technologyEquals(
                cache.technology,
                "None"
            )
        ) {

            throw new Error(
                `BACKEND_CACHE_SCAFFOLD_DISABLED_WITH_TECHNOLOGY:${cache.technology}`
            );

        }


        return emptyScaffoldFragment();

    }


    if (
        technologyEquals(
            cache.technology,
            "Redis"
        )
    ) {

        return createRedisCacheFragment();

    }


    throw new Error(
        `BACKEND_CACHE_SCAFFOLD_NOT_FOUND:${cache.technology}`
    );

}


// ============================================================
// TEST RESOLVER
// ============================================================


function resolveTestScaffold(
    input:
        ScaffoldRecipeInput
): ScaffoldFragment {

    if (
        technologyEquals(
            input.profile.testFramework,
            "Jest"
        )
    ) {

        return createJestFragment();

    }


    throw new Error(
        `BACKEND_TEST_SCAFFOLD_NOT_FOUND:${input.profile.testFramework ?? "MISSING"}`
    );

}


// ============================================================
// BUILD RESOLVER
// ============================================================


function resolveBuildScaffold(
    input:
        ScaffoldRecipeInput
): ScaffoldFragment {

    if (
        technologyEquals(
            input.profile.buildTool,
            "tsc"
        )
    ) {

        return createTscBuildFragment();

    }


    throw new Error(
        `BACKEND_BUILD_SCAFFOLD_NOT_FOUND:${input.profile.buildTool ?? "MISSING"}`
    );

}


// ============================================================
// EXPRESS APPLICATION
// ============================================================


function createTypeScriptExpressFragment(
    compilerTypes:
        string[]
): ScaffoldFragment {

    return {

        directories: [
            "src",
            "src/config",
            "src/common",
            "src/middleware",
            "src/modules"
        ],

        files: [

            {
                path:
                    "tsconfig.json",

                content:
                    createBaseTsConfig(
                        compilerTypes
                    )
            },

            {
                path:
                    "src/app.ts",

                content:
                    createExpressAppFile()
            },

            {
                path:
                    "src/server.ts",

                content:
                    createExpressServerFile()
            },

            {
                path:
                    "src/config/env.ts",

                content:
                    createEnvironmentFile()
            },

            {
                path:
                    "src/middleware/errorHandler.ts",

                content:
                    createExpressErrorHandlerFile()
            }

        ],

        packageContribution: {

            scripts: {

                dev:
                    "tsx watch src/server.ts",

                start:
                    "node dist/server.js",

                typecheck:
                    "tsc --noEmit"

            },

            dependencies: {

                cors:
                    "^2.8.5",

                dotenv:
                    "^16.4.0",

                express:
                    "^5.0.0",

                zod:
                    "^3.23.0"

            },

            devDependencies: {

                "@types/cors":
                    "^2.8.17",

                "@types/express":
                    "^5.0.0",

                "@types/node":
                    "^22.0.0",

                tsx:
                    "^4.19.0",

                typescript:
                    "^5.7.0"

            }

        }

    };

}


// ============================================================
// NESTJS APPLICATION
// ============================================================


function createTypeScriptNestFragment(
    compilerTypes:
        string[]
): ScaffoldFragment {

    return {

        directories: [
            "src",
            "src/config",
            "src/common",
            "src/modules"
        ],

        files: [

            {
                path:
                    "tsconfig.json",

                content:
                    createBaseTsConfig(
                        compilerTypes,
                        true
                    )
            },

            {
                path:
                    "nest-cli.json",

                content:
                    createNestCliConfig()
            },

            {
                path:
                    "src/main.ts",

                content:
                    createNestMainFile()
            },

            {
                path:
                    "src/app.module.ts",

                content:
                    createNestAppModuleFile()
            },

            {
                path:
                    "src/app.controller.ts",

                content:
                    createNestAppControllerFile()
            },

            {
                path:
                    "src/config/env.ts",

                content:
                    createEnvironmentFile()
            }

        ],

        packageContribution: {

            scripts: {

                start:
                    "node dist/main.js",

                "start:dev":
                    "nest start --watch",

                typecheck:
                    "tsc --noEmit"

            },

            dependencies: {

                "@nestjs/common":
                    "^11.0.0",

                "@nestjs/core":
                    "^11.0.0",

                "@nestjs/platform-express":
                    "^11.0.0",

                dotenv:
                    "^16.4.0",

                "reflect-metadata":
                    "^0.2.2",

                rxjs:
                    "^7.8.0"

            },

            devDependencies: {

                "@nestjs/cli":
                    "^11.0.0",

                "@nestjs/testing":
                    "^11.0.0",

                "@types/node":
                    "^22.0.0",

                "ts-node":
                    "^10.9.0",

                typescript:
                    "^5.7.0"

            }

        }

    };

}


// ============================================================
// PRISMA + POSTGRESQL
// ============================================================


function createPrismaPostgreSQLFragment():
    ScaffoldFragment {

    return {

        directories: [
            "prisma",
            "src/database"
        ],

        files:
            [],

        packageContribution: {

            scripts: {

                "prisma:generate":
                    "prisma generate",

                "prisma:validate":
                    "prisma validate"

            },

            dependencies: {

                "@prisma/client":
                    "^6.0.0"

            },

            devDependencies: {

                prisma:
                    "^6.0.0"

            }

        }

    };

}


// ============================================================
// DRIZZLE + POSTGRESQL
// ============================================================


function createDrizzlePostgreSQLFragment():
    ScaffoldFragment {

    return {

        directories: [
            "src/database",
            "drizzle"
        ],

        files: [

            {
                path:
                    "drizzle.config.ts",

                content:
                    createDrizzleConfig()
            }

        ],

        packageContribution: {

            scripts: {

                "drizzle:generate":
                    "drizzle-kit generate",

                "drizzle:migrate":
                    "drizzle-kit migrate"

            },

            dependencies: {

                "drizzle-orm":
                    "^0.44.0",

                pg:
                    "^8.16.0"

            },

            devDependencies: {

                "@types/pg":
                    "^8.15.0",

                "drizzle-kit":
                    "^0.31.0"

            }

        }

    };

}


// ============================================================
// REDIS CACHE
// ============================================================


function createRedisCacheFragment():
    ScaffoldFragment {

    return {

        directories: [
            "src/cache"
        ],

        files:
            [],

        packageContribution: {

            scripts:
                {},

            dependencies: {

                redis:
                    "^5.0.0"

            },

            devDependencies:
                {}

        }

    };

}


// ============================================================
// JEST
// ============================================================


function createJestFragment():
    ScaffoldFragment {

    return {

        directories: [
            "tests"
        ],

        files:
            [],

        compilerTypes: [
            "jest"
        ],

        packageContribution: {

            scripts: {

                test:
                    "jest --runInBand"

            },

            dependencies:
                {},

            devDependencies: {

                "@types/jest":
                    "^29.5.0",

                jest:
                    "^29.7.0",

                "ts-jest":
                    "^29.2.0"

            },

            packageFields: {

                jest: {

                    preset:
                        "ts-jest/presets/default-esm",

                    testEnvironment:
                        "node",

                    roots: [
                        "<rootDir>/tests",
                        "<rootDir>/src"
                    ],

                    extensionsToTreatAsEsm: [
                        ".ts"
                    ],

                    moduleNameMapper: {

                        "^(\\.{1,2}/.*)\\.js$":
                            "$1"

                    }

                }

            }

        }

    };

}


// ============================================================
// TSC BUILD
// ============================================================


function createTscBuildFragment():
    ScaffoldFragment {

    return {

        directories:
            [],

        files: [

            {
                path:
                    "tsconfig.build.json",

                content:
                    createBuildTsConfig()
            }

        ],

        packageContribution: {

            scripts: {

                build:
                    "tsc -p tsconfig.build.json"

            },

            dependencies:
                {},

            devDependencies:
                {}

        }

    };

}


// ============================================================
// EMPTY FRAGMENT
// ============================================================


function emptyScaffoldFragment():
    ScaffoldFragment {

    return {

        directories:
            [],

        files:
            [],

        packageContribution: {

            scripts:
                {},

            dependencies:
                {},

            devDependencies:
                {}

        }

    };

}


// ============================================================
// DRIZZLE CONFIG
// ============================================================


function createDrizzleConfig():
    string {

    return `import "dotenv/config";

import {
    defineConfig
} from "drizzle-kit";


const databaseUrl =
    process.env.DATABASE_URL;


if (
    !databaseUrl
) {

    throw new Error(
        "DATABASE_URL_REQUIRED"
    );

}


export default defineConfig({

    dialect:
        "postgresql",

    schema:
        "./src/database/schema.ts",

    out:
        "./drizzle",

    dbCredentials: {

        url:
            databaseUrl

    }

});
`;

}


// ============================================================
// TYPESCRIPT CONFIG
// ============================================================


function createBaseTsConfig(
    compilerTypes:
        string[],
    decorators:
        boolean =
        false
): string {

    const compilerOptions:
        Record<string, unknown> = {

        target:
            "ES2022",

        module:
            "NodeNext",

        moduleResolution:
            "NodeNext",

        outDir:
            "dist",

        strict:
            true,

        esModuleInterop:
            true,

        forceConsistentCasingInFileNames:
            true,

        skipLibCheck:
            true,

        resolveJsonModule:
            true,

        types:
            compilerTypes

    };


    if (
        decorators
    ) {

        compilerOptions.experimentalDecorators =
            true;

        compilerOptions.emitDecoratorMetadata =
            true;

    }


    return (
        JSON.stringify(
            {

                compilerOptions,

                include: [
                    "src/**/*.ts",
                    "tests/**/*.ts",
                    "test/**/*.ts"
                ],

                exclude: [
                    "node_modules",
                    "dist"
                ]

            },
            null,
            2
        )
        +
        "\n"
    );

}


function createBuildTsConfig():
    string {

    return (
        JSON.stringify(
            {

                extends:
                    "./tsconfig.json",

                compilerOptions: {

                    rootDir:
                        "src",

                    outDir:
                        "dist",

                    noEmit:
                        false

                },

                include: [
                    "src/**/*.ts"
                ],

                exclude: [
                    "node_modules",
                    "dist",
                    "tests",
                    "test",
                    "**/*.spec.ts",
                    "**/*.test.ts"
                ]

            },
            null,
            2
        )
        +
        "\n"
    );

}


// ============================================================
// EXPRESS FILES
// ============================================================


function createExpressAppFile():
    string {

    return `import express from "express";
import cors from "cors";

import {
    errorHandler,
    notFoundHandler
} from "./middleware/errorHandler.js";


export const app =
    express();


app.disable(
    "x-powered-by"
);


app.use(
    cors()
);


app.use(
    express.json()
);


app.get(
    "/health",
    (
        _request,
        response
    ) => {

        response.status(
            200
        )
            .json({
                status:
                    "ok"
            });

    }
);


app.use(
    notFoundHandler
);


app.use(
    errorHandler
);
`;

}


function createExpressServerFile():
    string {

    return `import {
    app
} from "./app.js";

import {
    env
} from "./config/env.js";


const server =
    app.listen(
        env.port,
        () => {

            console.log(
                \`Backend listening on port \${env.port}\`
            );

        }
    );


function shutdown(
    signal:
        string
): void {

    console.log(
        \`Received \${signal}. Shutting down backend.\`
    );


    server.close(
        error => {

            if (
                error
            ) {

                console.error(
                    error
                );

                process.exit(
                    1
                );

            }


            process.exit(
                0
            );

        }
    );

}


process.on(
    "SIGINT",
    () =>
        shutdown(
            "SIGINT"
        )
);


process.on(
    "SIGTERM",
    () =>
        shutdown(
            "SIGTERM"
        )
);
`;

}


function createExpressErrorHandlerFile():
    string {

    return `import type {
    ErrorRequestHandler,
    RequestHandler
} from "express";


export const notFoundHandler:
    RequestHandler =
    (
        request,
        response
    ) => {

        response.status(
            404
        )
            .json({

                code:
                    "NOT_FOUND",

                message:
                    \`Route not found: \${request.method} \${request.originalUrl}\`

            });

    };


export const errorHandler:
    ErrorRequestHandler =
    (
        error,
        _request,
        response,
        _next
    ) => {

        console.error(
            error
        );


        response.status(
            500
        )
            .json({

                code:
                    "INTERNAL_ERROR",

                message:
                    "Unexpected server failure."

            });

    };
`;

}


// ============================================================
// NESTJS FILES
// ============================================================


function createNestCliConfig():
    string {

    return (
        JSON.stringify(
            {

                "$schema":
                    "https://json.schemastore.org/nest-cli",

                collection:
                    "@nestjs/schematics",

                sourceRoot:
                    "src"

            },
            null,
            2
        )
        +
        "\n"
    );

}


function createNestMainFile():
    string {

    return `import "reflect-metadata";

import {
    NestFactory
} from "@nestjs/core";

import {
    AppModule
} from "./app.module.js";

import {
    env
} from "./config/env.js";


async function bootstrap(): Promise<void> {

    const app =
        await NestFactory.create(
            AppModule
        );


    app.enableCors();


    await app.listen(
        env.port
    );

}


bootstrap()
    .catch(
        error => {

            console.error(
                error
            );

            process.exit(
                1
            );

        }
    );
`;

}


function createNestAppModuleFile():
    string {

    return `import {
    Module
} from "@nestjs/common";

import {
    AppController
} from "./app.controller.js";


@Module({

    imports:
        [],

    controllers: [
        AppController
    ],

    providers:
        []

})
export class AppModule {}
`;

}


function createNestAppControllerFile():
    string {

    return `import {
    Controller,
    Get
} from "@nestjs/common";


@Controller()
export class AppController {

    @Get(
        "health"
    )
    health(): {
        status: string;
    } {

        return {

            status:
                "ok"

        };

    }

}
`;

}


// ============================================================
// ENVIRONMENT FILE
// ============================================================


function createEnvironmentFile():
    string {

    return `import "dotenv/config";


function readPort(): number {

    const value =
        Number(
            process.env.PORT
            ??
            3000
        );


    if (
        !Number.isInteger(
            value
        )
        ||
        value <= 0
        ||
        value > 65535
    ) {

        throw new Error(
            "INVALID_PORT"
        );

    }


    return value;

}


export const env = {

    port:
        readPort()

};
`;

}


// ============================================================
// PACKAGE.JSON
// ============================================================


function createPackageJson(
    projectName:
        string,
    projectSlug:
        string,
    contributions:
        PackageContribution[]
): string {

    const scripts =
        mergeStringRecords(
            "SCRIPT",
            ...contributions.map(
                contribution =>
                    contribution.scripts
            )
        );


    const dependencies =
        mergeStringRecords(
            "DEPENDENCY",
            ...contributions.map(
                contribution =>
                    contribution.dependencies
            )
        );


    const devDependencies =
        mergeStringRecords(
            "DEV_DEPENDENCY",
            ...contributions.map(
                contribution =>
                    contribution.devDependencies
            )
        );


    const packageFields =
        mergeUnknownRecords(
            "PACKAGE_FIELD",
            ...contributions.map(
                contribution =>
                    contribution.packageFields
                    ??
                    {}
            )
        );


    return (
        JSON.stringify(
            {

                name:
                    `${projectSlug}-backend`,

                version:
                    "1.0.0",

                private:
                    true,

                type:
                    "module",

                description:
                    `Generated backend for ${projectName}`,

                scripts,

                dependencies,

                devDependencies,

                ...packageFields

            },
            null,
            2
        )
        +
        "\n"
    );

}


// ============================================================
// MERGE HELPERS
// ============================================================


function mergeFiles(
    files:
        BackendScaffoldFile[]
): BackendScaffoldFile[] {

    const result:
        BackendScaffoldFile[] =
        [];


    const byPath =
        new Map<
            string,
            BackendScaffoldFile
        >();


    for (
        const file
        of files
    ) {

        const key =
            normalizePathKey(
                file.path
            );


        const existing =
            byPath.get(
                key
            );


        if (
            existing
        ) {

            if (
                existing.content
                !==
                file.content
            ) {

                throw new Error(
                    `BACKEND_SCAFFOLD_FILE_DEFINITION_CONFLICT:${file.path}`
                );

            }


            continue;

        }


        byPath.set(
            key,
            file
        );


        result.push(
            file
        );

    }


    return result;

}


function mergeStringRecords(
    category:
        string,
    ...records:
        Record<string, string>[]
): Record<string, string> {

    const result:
        Record<string, string> =
        {};


    for (
        const record
        of records
    ) {

        for (
            const [
                key,
                value
            ]
            of Object.entries(
                record
            )
        ) {

            const existing =
                result[
                    key
                ];


            if (
                existing
                !==
                undefined
                &&
                existing
                !==
                value
            ) {

                throw new Error(
                    `BACKEND_SCAFFOLD_${category}_CONFLICT:${key}`
                );

            }


            result[
                key
            ] =
                value;

        }

    }


    return result;

}


function mergeUnknownRecords(
    category:
        string,
    ...records:
        Record<string, unknown>[]
): Record<string, unknown> {

    const result:
        Record<string, unknown> =
        {};


    for (
        const record
        of records
    ) {

        for (
            const [
                key,
                value
            ]
            of Object.entries(
                record
            )
        ) {

            if (
                Object.prototype.hasOwnProperty.call(
                    result,
                    key
                )
            ) {

                if (
                    JSON.stringify(
                        result[
                            key
                        ]
                    )
                    !==
                    JSON.stringify(
                        value
                    )
                ) {

                    throw new Error(
                        `BACKEND_SCAFFOLD_${category}_CONFLICT:${key}`
                    );

                }


                continue;

            }


            result[
                key
            ] =
                value;

        }

    }


    return result;

}


// ============================================================
// TECHNOLOGY HELPERS
// ============================================================


function technologyEquals(
    actual:
        string | undefined,
    expected:
        string
): boolean {

    if (
        !actual
    ) {

        return false;

    }


    return (
        normalizeTechnology(
            actual
        )
        ===
        normalizeTechnology(
            expected
        )
    );

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


function normalizePathKey(
    value:
        string
): string {

    return value
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
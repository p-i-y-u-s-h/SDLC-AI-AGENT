import type {
    BackendExecutionProfile,
    CommandSpec
} from "../schemas/backendExecutionProfileSchema.js";


interface ProfileCommands {

    bootstrap?:
        CommandSpec[];

    setup:
        CommandSpec[];

    focusedValidation:
        CommandSpec[];

    fullValidation:
        CommandSpec[];

    preview?:
        CommandSpec;

}


export interface BackendExecutionSelection {

    language:
        string;

    runtime:
        string;

    framework:
        string;

    packageManager:
        string;

    dataAccessTechnology:
        string;

    databaseEngine:
        string;

    cacheRequired:
        boolean;

    cacheTechnology:
        string;

    testFramework:
        string;

    buildTool:
        string;

}


export interface BackendApplicationProfile {

    id:
        string;

    languageAliases:
        string[];

    runtimeAliases:
        string[];

    frameworkAliases:
        string[];

    packageManagerAliases:
        string[];

    sourceRoots:
        string[];

    testRoots:
        string[];

    dependencyFiles:
        string[];

    writablePathPatterns:
        string[];

    sharedPathPatterns:
        string[];

    protectedPathPatterns:
        string[];

    allowedExecutables:
        string[];

    commands:
        ProfileCommands;

    conventions:
        string[];

    implementationGuidance:
        string[];

    repairGuidance:
        string[];

}


export interface PersistenceExecutionProfile {

    id:
        string;

    profileSuffix:
        string;

    dataAccessAliases:
        string[];

    databaseEngineAliases:
        string[];

    dependencyFiles:
        string[];

    writablePathPatterns:
        string[];

    sharedPathPatterns:
        string[];

    protectedPathPatterns:
        string[];

    allowedExecutables:
        string[];

    commands:
        ProfileCommands;

    conventions:
        string[];

    implementationGuidance:
        string[];

    repairGuidance:
        string[];

}


export interface CacheExecutionProfile {

    id:
        string;

    profileSuffix:
        string;

    aliases:
        string[];

    dependencyFiles:
        string[];

    writablePathPatterns:
        string[];

    sharedPathPatterns:
        string[];

    protectedPathPatterns:
        string[];

    allowedExecutables:
        string[];

    commands:
        ProfileCommands;

    conventions:
        string[];

    implementationGuidance:
        string[];

    repairGuidance:
        string[];

}


export interface TestExecutionProfile {

    id:
        string;

    profileSuffix:
        string;

    aliases:
        string[];

    testRoots:
        string[];

    dependencyFiles:
        string[];

    writablePathPatterns:
        string[];

    allowedExecutables:
        string[];

    commands:
        ProfileCommands;

    conventions:
        string[];

    implementationGuidance:
        string[];

    repairGuidance:
        string[];

}


export interface BuildExecutionProfile {

    id:
        string;

    profileSuffix:
        string;

    aliases:
        string[];

    dependencyFiles:
        string[];

    writablePathPatterns:
        string[];

    allowedExecutables:
        string[];

    commands:
        ProfileCommands;

    conventions:
        string[];

    implementationGuidance:
        string[];

    repairGuidance:
        string[];

}


// ============================================================
// APPLICATION PROFILES
// ============================================================


const applicationProfiles:
    BackendApplicationProfile[] =
[
    {

        id:
            "typescript-node-express-npm",

        languageAliases: [
            "typescript",
            "ts"
        ],

        runtimeAliases: [
            "node",
            "nodejs"
        ],

        frameworkAliases: [
            "express",
            "expressjs"
        ],

        packageManagerAliases: [
            "npm"
        ],

        sourceRoots: [
            "src"
        ],

        testRoots: [
            "tests",
            "test",
            "src"
        ],

        dependencyFiles: [
            "package.json",
            "package-lock.json",
            "tsconfig.json"
        ],

        writablePathPatterns: [
            "src/**",
            "tests/**",
            "test/**"
        ],

        sharedPathPatterns: [
            "src/common/**",
            "src/config/**",
            "src/middleware/**"
        ],

        protectedPathPatterns: [
            ".git/**",
            "node_modules/**",
            "dist/**",
            ".env"
        ],

        allowedExecutables: [
            "node",
            "npm",
            "npx"
        ],

        commands: {

            setup: [
                {
                    name:
                        "Install dependencies",

                    purpose:
                        "DEPENDENCY_INSTALL",

                    executable:
                        "npm",

                    args: [
                        "install"
                    ],

                    timeoutMs:
                        180000,

                    optional:
                        false
                }
            ],

            focusedValidation: [
                {
                    name:
                        "TypeScript validation",

                    purpose:
                        "TYPECHECK",

                    executable:
                        "npx",

                    args: [
                        "tsc",
                        "--noEmit"
                    ],

                    timeoutMs:
                        120000,

                    optional:
                        false
                }
            ],

            fullValidation:
                [],

            preview: {

                name:
                    "Start development server",

                purpose:
                    "PREVIEW",

                executable:
                    "npm",

                args: [
                    "run",
                    "dev"
                ],

                timeoutMs:
                    30000,

                optional:
                    false
            }

        },

        conventions: [
            "Separate routes, controllers, services, middleware, and data access.",
            "Keep HTTP handling separate from business logic.",
            "Use centralized error handling."
        ],

        implementationGuidance: [
            "Keep route handlers small.",
            "Place business logic inside services.",
            "Validate all external input.",
            "Respect domain module boundaries."
        ],

        repairGuidance: [
            "Resolve TypeScript errors first.",
            "Check route registration when endpoints are unavailable.",
            "Check middleware ordering."
        ]

    },

    {

        id:
            "typescript-node-nestjs-npm",

        languageAliases: [
            "typescript",
            "ts"
        ],

        runtimeAliases: [
            "node",
            "nodejs"
        ],

        frameworkAliases: [
            "nestjs",
            "nest"
        ],

        packageManagerAliases: [
            "npm"
        ],

        sourceRoots: [
            "src"
        ],

        testRoots: [
            "tests",
            "test",
            "src"
        ],

        dependencyFiles: [
            "package.json",
            "package-lock.json",
            "tsconfig.json",
            "nest-cli.json"
        ],

        writablePathPatterns: [
            "src/**",
            "tests/**",
            "test/**"
        ],

        sharedPathPatterns: [
            "src/common/**",
            "src/config/**"
        ],

        protectedPathPatterns: [
            ".git/**",
            "node_modules/**",
            "dist/**",
            ".env"
        ],

        allowedExecutables: [
            "node",
            "npm",
            "npx"
        ],

        commands: {

            bootstrap: [
                {
                    name:
                        "Create NestJS application",

                    purpose:
                        "BOOTSTRAP",

                    executable:
                        "npx",

                    args: [
                        "@nestjs/cli",
                        "new",
                        ".",
                        "--package-manager",
                        "npm",
                        "--skip-git"
                    ],

                    timeoutMs:
                        180000,

                    optional:
                        false
                }
            ],

            setup: [
                {
                    name:
                        "Install dependencies",

                    purpose:
                        "DEPENDENCY_INSTALL",

                    executable:
                        "npm",

                    args: [
                        "install"
                    ],

                    timeoutMs:
                        180000,

                    optional:
                        false
                }
            ],

            focusedValidation: [
                {
                    name:
                        "TypeScript validation",

                    purpose:
                        "TYPECHECK",

                    executable:
                        "npx",

                    args: [
                        "tsc",
                        "--noEmit"
                    ],

                    timeoutMs:
                        120000,

                    optional:
                        false
                }
            ],

            fullValidation:
                [],

            preview: {

                name:
                    "Start development server",

                purpose:
                    "PREVIEW",

                executable:
                    "npm",

                args: [
                    "run",
                    "start:dev"
                ],

                timeoutMs:
                    30000,

                optional:
                    false
            }

        },

        conventions: [
            "Use NestJS modules for domain boundaries.",
            "Use controllers for HTTP transport.",
            "Use providers and services for business logic.",
            "Use dependency injection."
        ],

        implementationGuidance: [
            "Respect module boundaries from architecture.json.",
            "Keep controllers small.",
            "Keep business logic inside services.",
            "Use guards for authentication and authorization."
        ],

        repairGuidance: [
            "Resolve TypeScript errors first.",
            "Check provider registration when dependency injection fails.",
            "Check module imports and exports."
        ]

    }
];


// ============================================================
// PERSISTENCE PROFILES
// ============================================================


const persistenceProfiles:
    PersistenceExecutionProfile[] =
[
    {

        id:
            "prisma-postgresql",

        profileSuffix:
            "prisma",

        dataAccessAliases: [
            "prisma",
            "prismaorm"
        ],

        databaseEngineAliases: [
            "postgresql",
            "postgres",
            "pgsql"
        ],

        dependencyFiles: [
            "prisma/schema.prisma"
        ],

        writablePathPatterns: [
            "prisma/**",
            "src/database/**"
        ],

        sharedPathPatterns: [
            "src/database/**"
        ],

        protectedPathPatterns:
            [],

        allowedExecutables: [
            "npx"
        ],

        commands: {

            setup: [
                {
                    name:
                        "Generate Prisma client",

                    purpose:
                        "CODEGEN",

                    executable:
                        "npx",

                    args: [
                        "prisma",
                        "generate"
                    ],

                    timeoutMs:
                        120000,

                    optional:
                        false
                }
            ],

            focusedValidation: [
                {
                    name:
                        "Validate Prisma schema",

                    purpose:
                        "SCHEMA_VALIDATE",

                    executable:
                        "npx",

                    args: [
                        "prisma",
                        "validate"
                    ],

                    timeoutMs:
                        120000,

                    optional:
                        false
                }
            ],

            fullValidation: [
                {
                    name:
                        "Validate Prisma schema",

                    purpose:
                        "SCHEMA_VALIDATE",

                    executable:
                        "npx",

                    args: [
                        "prisma",
                        "validate"
                    ],

                    timeoutMs:
                        120000,

                    optional:
                        false
                }
            ]

        },

        conventions: [
            "Use Prisma Client as the selected persistence technology."
        ],

        implementationGuidance: [
            "Generate Prisma schema from storage-contract.json.",
            "Treat storage-contract.json as authoritative."
        ],

        repairGuidance: [
            "Validate Prisma schema after changes.",
            "Regenerate Prisma Client after schema changes."
        ]

    },

    {

        id:
            "drizzle-postgresql",

        profileSuffix:
            "drizzle",

        dataAccessAliases: [
            "drizzle",
            "drizzleorm",
            "drizzle-orm"
        ],

        databaseEngineAliases: [
            "postgresql",
            "postgres",
            "pgsql"
        ],

        dependencyFiles: [
            "drizzle.config.ts",
            "src/database/schema.ts"
        ],

        writablePathPatterns: [
            "src/database/**",
            "drizzle/**",
            "drizzle.config.ts"
        ],

        sharedPathPatterns: [
            "src/database/**"
        ],

        protectedPathPatterns:
            [],

        allowedExecutables: [
            "npx"
        ],

        commands: {

            setup: [
                {
                    name:
                        "Generate Drizzle migrations",

                    purpose:
                        "CODEGEN",

                    executable:
                        "npx",

                    args: [
                        "drizzle-kit",
                        "generate"
                    ],

                    timeoutMs:
                        120000,

                    optional:
                        false
                }
            ],

            focusedValidation:
                [],

            fullValidation:
                []

        },

        conventions: [
            "Use Drizzle ORM as the selected PostgreSQL persistence layer.",
            "Use pg as the PostgreSQL driver."
        ],

        implementationGuidance: [
            "Generate Drizzle schema from storage-contract.json.",
            "Generate migrations only after schema.ts exists.",
            "Do not replace Drizzle ORM with another persistence technology."
        ],

        repairGuidance: [
            "Resolve schema TypeScript errors before migration generation.",
            "Regenerate migrations after physical schema changes."
        ]

    }
];


// ============================================================
// CACHE PROFILES
// ============================================================


const cacheProfiles:
    CacheExecutionProfile[] =
[
    {

        id:
            "redis",

        profileSuffix:
            "redis",

        aliases: [
            "redis",
            "redisserver",
            "redis-server"
        ],

        dependencyFiles: [
            "package.json"
        ],

        writablePathPatterns: [
            "src/cache/**"
        ],

        sharedPathPatterns: [
            "src/cache/**"
        ],

        protectedPathPatterns:
            [],

        allowedExecutables:
            [],

        commands: {

            setup:
                [],

            focusedValidation:
                [],

            fullValidation:
                []

        },

        conventions: [
            "Use Redis as the selected cache technology.",
            "Keep cache access behind a dedicated cache boundary."
        ],

        implementationGuidance: [
            "Read Redis connection information from environment configuration.",
            "Use Redis only for cache use cases defined by the backend contract.",
            "Do not treat cached values as authoritative primary domain state.",
            "Use deterministic cache key namespaces.",
            "Do not silently replace required Redis with an in-memory cache."
        ],

        repairGuidance: [
            "Handle Redis connection and reconnect errors explicitly.",
            "Do not silently disable Redis when the backend contract requires caching."
        ]

    }
];


// ============================================================
// TEST PROFILES
// ============================================================


const testProfiles:
    TestExecutionProfile[] =
[
    {

        id:
            "jest",

        profileSuffix:
            "jest",

        aliases: [
            "jest"
        ],

        testRoots: [
            "tests",
            "test",
            "src"
        ],

        dependencyFiles: [
            "package.json"
        ],

        writablePathPatterns: [
            "tests/**",
            "test/**",
            "src/**/*.spec.ts",
            "src/**/*.test.ts"
        ],

        allowedExecutables: [
            "npm"
        ],

        commands: {

            setup:
                [],

            focusedValidation:
                [],

            fullValidation: [
                {
                    name:
                        "Run tests",

                    purpose:
                        "TEST",

                    executable:
                        "npm",

                    args: [
                        "test"
                    ],

                    timeoutMs:
                        180000,

                    optional:
                        true
                }
            ]

        },

        conventions: [
            "Use Jest as the selected backend test framework."
        ],

        implementationGuidance: [
            "Generate backend tests using Jest.",
            "Keep tests deterministic and isolated."
        ],

        repairGuidance: [
            "Fix failing Jest tests without weakening assertions."
        ]

    }
];


// ============================================================
// BUILD PROFILES
// ============================================================


const buildProfiles:
    BuildExecutionProfile[] =
[
    {

        id:
            "tsc",

        profileSuffix:
            "tsc",

        aliases: [
            "tsc",
            "typescriptcompiler",
            "typescript compiler"
        ],

        dependencyFiles: [
            "tsconfig.json",
            "tsconfig.build.json"
        ],

        writablePathPatterns: [
            "tsconfig.build.json"
        ],

        allowedExecutables: [
            "npm"
        ],

        commands: {

            setup:
                [],

            focusedValidation:
                [],

            fullValidation: [
                {
                    name:
                        "Build backend",

                    purpose:
                        "BUILD",

                    executable:
                        "npm",

                    args: [
                        "run",
                        "build"
                    ],

                    timeoutMs:
                        180000,

                    optional:
                        false
                }
            ]

        },

        conventions: [
            "Use the TypeScript compiler as the selected backend build tool."
        ],

        implementationGuidance: [
            "Compile production source with tsconfig.build.json."
        ],

        repairGuidance: [
            "Resolve TypeScript compilation failures before deployment."
        ]

    }
];


// ============================================================
// RESOLUTION
// ============================================================


export function findBackendApplicationProfile(
    selection:
        BackendExecutionSelection
): BackendApplicationProfile | null {

    return (
        applicationProfiles.find(
            profile =>
                matches(
                    selection.language,
                    profile.languageAliases
                )
                &&
                matches(
                    selection.runtime,
                    profile.runtimeAliases
                )
                &&
                matches(
                    selection.framework,
                    profile.frameworkAliases
                )
                &&
                matches(
                    selection.packageManager,
                    profile.packageManagerAliases
                )
        )
        ??
        null
    );

}


export function findPersistenceExecutionProfile(
    selection:
        BackendExecutionSelection
): PersistenceExecutionProfile | null {

    return (
        persistenceProfiles.find(
            profile =>
                matches(
                    selection.dataAccessTechnology,
                    profile.dataAccessAliases
                )
                &&
                matches(
                    selection.databaseEngine,
                    profile.databaseEngineAliases
                )
        )
        ??
        null
    );

}


export function findCacheExecutionProfile(
    selection:
        BackendExecutionSelection
): CacheExecutionProfile | null {

    if (
        !selection.cacheRequired
    ) {

        return null;

    }


    return (
        cacheProfiles.find(
            profile =>
                matches(
                    selection.cacheTechnology,
                    profile.aliases
                )
        )
        ??
        null
    );

}


export function findTestExecutionProfile(
    selection:
        BackendExecutionSelection
): TestExecutionProfile | null {

    return (
        testProfiles.find(
            profile =>
                matches(
                    selection.testFramework,
                    profile.aliases
                )
        )
        ??
        null
    );

}


export function findBuildExecutionProfile(
    selection:
        BackendExecutionSelection
): BuildExecutionProfile | null {

    return (
        buildProfiles.find(
            profile =>
                matches(
                    selection.buildTool,
                    profile.aliases
                )
        )
        ??
        null
    );

}


// ============================================================
// COMPOSITION
// ============================================================


export function composeBackendExecutionProfile(
    selection:
        BackendExecutionSelection,
    application:
        BackendApplicationProfile,
    persistence:
        PersistenceExecutionProfile,
    cache:
        CacheExecutionProfile | null,
    testing:
        TestExecutionProfile,
    build:
        BuildExecutionProfile
): BackendExecutionProfile {

    return {

        id:
            [
                application.id,
                persistence.profileSuffix,
                cache?.profileSuffix,
                testing.profileSuffix,
                build.profileSuffix
            ]
                .filter(
                    (
                        value
                    ): value is string =>
                        Boolean(
                            value
                        )
                )
                .join("-"),

        resolvedBy:
            "BUILT_IN",

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
                application.sourceRoots
            ),

        testRoots:
            uniqueStrings([
                ...application.testRoots,
                ...testing.testRoots
            ]),

        dependencyFiles:
            uniqueStrings([
                ...application.dependencyFiles,
                ...persistence.dependencyFiles,
                ...(
                    cache?.dependencyFiles
                    ??
                    []
                ),
                ...testing.dependencyFiles,
                ...build.dependencyFiles
            ]),

        writablePathPatterns:
            uniqueStrings([
                ...application.writablePathPatterns,
                ...persistence.writablePathPatterns,
                ...(
                    cache?.writablePathPatterns
                    ??
                    []
                ),
                ...testing.writablePathPatterns,
                ...build.writablePathPatterns
            ]),

        sharedPathPatterns:
            uniqueStrings([
                ...application.sharedPathPatterns,
                ...persistence.sharedPathPatterns,
                ...(
                    cache?.sharedPathPatterns
                    ??
                    []
                )
            ]),

        protectedPathPatterns:
            uniqueStrings([
                ...application.protectedPathPatterns,
                ...persistence.protectedPathPatterns,
                ...(
                    cache?.protectedPathPatterns
                    ??
                    []
                )
            ]),

        allowedExecutables:
            uniqueStrings([
                ...application.allowedExecutables,
                ...persistence.allowedExecutables,
                ...(
                    cache?.allowedExecutables
                    ??
                    []
                ),
                ...testing.allowedExecutables,
                ...build.allowedExecutables
            ]),

        commands: {

            bootstrap:
                application.commands.bootstrap
                ??
                [],

            setup:
                mergeCommands(
                    application.commands.setup,
                    persistence.commands.setup,
                    cache?.commands.setup
                    ??
                    [],
                    testing.commands.setup,
                    build.commands.setup
                ),

            focusedValidation:
                mergeCommands(
                    application.commands.focusedValidation,
                    persistence.commands.focusedValidation,
                    cache?.commands.focusedValidation
                    ??
                    [],
                    testing.commands.focusedValidation,
                    build.commands.focusedValidation
                ),

            fullValidation:
                mergeCommands(
                    application.commands.fullValidation,
                    persistence.commands.fullValidation,
                    cache?.commands.fullValidation
                    ??
                    [],
                    testing.commands.fullValidation,
                    build.commands.fullValidation
                ),

            preview:
                application.commands.preview

        },

        conventions:
            uniqueStrings([
                ...application.conventions,
                ...persistence.conventions,
                ...(
                    cache?.conventions
                    ??
                    []
                ),
                ...testing.conventions,
                ...build.conventions
            ]),

        implementationGuidance:
            uniqueStrings([
                ...application.implementationGuidance,
                ...persistence.implementationGuidance,
                ...(
                    cache?.implementationGuidance
                    ??
                    []
                ),
                ...testing.implementationGuidance,
                ...build.implementationGuidance
            ]),

        repairGuidance:
            uniqueStrings([
                ...application.repairGuidance,
                ...persistence.repairGuidance,
                ...(
                    cache?.repairGuidance
                    ??
                    []
                ),
                ...testing.repairGuidance,
                ...build.repairGuidance
            ])

    };

}


// ============================================================
// HELPERS
// ============================================================


function matches(
    value:
        string,
    aliases:
        string[]
): boolean {

    const normalized =
        normalizeTechnology(
            value
        );


    return aliases.some(
        alias =>
            normalizeTechnology(
                alias
            )
            ===
            normalized
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


function mergeCommands(
    ...groups:
        CommandSpec[][]
): CommandSpec[] {

    const result:
        CommandSpec[] =
        [];


    const byName =
        new Map<
            string,
            CommandSpec
        >();


    for (
        const group
        of groups
    ) {

        for (
            const command
            of group
        ) {

            const key =
                command.name
                    .trim()
                    .toLowerCase();


            const existing =
                byName.get(
                    key
                );


            if (
                existing
            ) {

                if (
                    !sameCommand(
                        existing,
                        command
                    )
                ) {

                    throw new Error(
                        `BACKEND_EXECUTION_COMMAND_CONFLICT:${command.name}`
                    );

                }


                continue;

            }


            byName.set(
                key,
                command
            );


            result.push(
                command
            );

        }

    }


    return result;

}


function sameCommand(
    left:
        CommandSpec,
    right:
        CommandSpec
): boolean {

    return (
        left.purpose
        ===
        right.purpose
        &&
        left.executable
        ===
        right.executable
        &&
        JSON.stringify(
            left.args
        )
        ===
        JSON.stringify(
            right.args
        )
        &&
        (
            left.cwd
            ??
            ""
        )
        ===
        (
            right.cwd
            ??
            ""
        )
        &&
        (
            left.timeoutMs
            ??
            0
        )
        ===
        (
            right.timeoutMs
            ??
            0
        )
        &&
        left.optional
        ===
        right.optional
    );

}
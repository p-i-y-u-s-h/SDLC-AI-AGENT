export function normalizeArchitectureOutput(
    input: any,
    projectName: string
) {

    return {

        ...input,

        projectName:
            normalizeProjectName(
                input.projectName,
                projectName
            ),

        backend: {
            ...input.backend,

            modules:
                normalizeArray(
                    input.backend?.modules
                )
        },

        frontend: {
            ...input.frontend,

            modules:
                normalizeArray(
                    input.frontend?.modules
                )
        },

        database: {
            ...input.database
        },

        cache: {
            ...input.cache,

            useCases:
                normalizeArray(
                    input.cache?.useCases
                )
        },

        authentication:
            normalizeAuthentication(
                input.authentication
            ),

        apiModules:
            normalizeArray(
                input.apiModules
            ),

        externalIntegrations:
            normalizeArray(
                input.externalIntegrations
            ),

        projectStructure: {

            backend:
                normalizeStructure(
                    input.projectStructure?.backend
                ),

            frontend:
                normalizeStructure(
                    input.projectStructure?.frontend
                )

        },

        developmentPlan:
            normalizeArray(
                input.developmentPlan
            )

    };
}


function normalizeProjectName(
    value: unknown,
    fallback: string
): string {

    if (
        typeof value === "string"
        &&
        value.trim()
    ) {

        return value.trim();

    }


    return fallback;
}


function normalizeAuthentication(
    value: any
) {

    const authentication =
        value
        &&
        typeof value === "object"
            ? value
            : {};


    const strategy =
        typeof authentication.strategy === "string"
            ? authentication.strategy
            : "None";


    const required =
        typeof authentication.required === "boolean"
            ? authentication.required
            : isAuthenticationRequired(
                strategy
            );


    return {

        ...authentication,

        required,

        strategy

    };
}


function isAuthenticationRequired(
    strategy: string
): boolean {

    const normalized =
        strategy
            .trim()
            .toLowerCase();


    return ![
        "",
        "none",
        "not required",
        "no authentication",
        "n/a"
    ].includes(
        normalized
    );
}


function normalizeArray(
    value: unknown
): any[] {

    return Array.isArray(value)
        ? value
        : [];
}


function normalizeStructure(
    value: unknown
): string[] {

    if (
        Array.isArray(value)
    ) {

        return value.map(
            item =>
                String(item)
        );

    }


    if (
        value
        &&
        typeof value === "object"
    ) {

        return flattenStructure(
            value as Record<string, unknown>
        );

    }


    return [];
}


function flattenStructure(
    value: Record<string, unknown>,
    prefix = ""
): string[] {

    const paths:
        string[] = [];


    for (
        const [
            key,
            child
        ]
        of Object.entries(value)
    ) {

        const current =
            prefix
                ? `${prefix}/${key}`
                : key;


        if (
            Array.isArray(child)
        ) {

            if (
                child.length === 0
            ) {

                paths.push(
                    current
                );

                continue;
            }


            for (
                const item
                of child
            ) {

                paths.push(
                    `${current}/${String(item)}`
                );

            }


            continue;
        }


        if (
            child
            &&
            typeof child === "object"
        ) {

            paths.push(
                ...flattenStructure(
                    child as Record<string, unknown>,
                    current
                )
            );

            continue;
        }


        paths.push(
            current
        );

    }


    return paths;
}
import type {
    BackendContract
} from "../schemas/backendContractSchema.js";


export function normalizeApiContractOutput(
    input:
        any,
    backend:
        BackendContract
) {

    const source =
        structuredClone(
            input
            ??
            {}
        );


    const generatedGroups =
        Array.isArray(
            source.groups
        )
            ?
            source.groups
            :
            [];


    const groups =
        backend.modules.flatMap(
            module =>
                module.apiGroups.map(
                    group => {

                        const generated =
                            findGeneratedGroup(
                                generatedGroups,
                                group.name,
                                group.routePrefix
                            );


                        return {

                            name:
                                group.name,

                            ownerModule:
                                module.name,

                            routePrefix:
                                normalizePath(
                                    group.routePrefix
                                ),

                            endpoints:
                                normalizeEndpoints(
                                    generated?.endpoints,
                                    group.routePrefix,
                                    backend.authentication.required
                                )

                        };

                    }
                )
        );


    const schemas =
        normalizeSchemas(
            source.schemas
        );


    ensureStandardErrorSchema(
        schemas
    );


    return {

        projectName:
            backend.projectName,

        apiStyle:
            "REST",

        authentication: {

            required:
                backend.authentication.required,

            strategy:
                backend.authentication.strategy,

            roles:
                uniqueStrings(
                    backend.actors
                )

        },

        schemas,

        groups,

        errorModel:
            standardErrorModel()

    };

}


function findGeneratedGroup(
    groups:
        any[],
    expectedName:
        string,
    expectedPrefix:
        string
) {

    const normalizedPrefix =
        normalizePath(
            expectedPrefix
        );


    return groups.find(
        group =>
            group?.name
            ===
            expectedName
    )
    ??
    groups.find(
        group =>
            normalizePath(
                String(
                    group?.routePrefix
                    ??
                    ""
                )
            )
            ===
            normalizedPrefix
    );

}


function normalizeEndpoints(
    value:
        unknown,
    routePrefix:
        string,
    authenticationRequired:
        boolean
) {

    if (
        !Array.isArray(
            value
        )
    ) {

        return [];

    }


    return value.map(
        endpoint => {

            const method =
                String(
                    endpoint?.method
                    ??
                    ""
                )
                    .trim()
                    .toUpperCase();


            const path =
                normalizeEndpointPath(
                    String(
                        endpoint?.path
                        ??
                        ""
                    ),
                    routePrefix
                );


            const pathParameters =
                normalizeParameters(
                    endpoint?.pathParameters,
                    true
                );


            const queryParameters =
                normalizeParameters(
                    endpoint?.queryParameters,
                    false
                );


            const requestBody =
                method
                ===
                "GET"
                    ?
                    null
                    :
                    normalizeRequestBody(
                        endpoint?.requestBody
                    );


            const pagination =
                normalizePagination(
                    endpoint?.pagination,
                    queryParameters
                );


            return {

                operationId:
                    String(
                        endpoint?.operationId
                        ??
                        ""
                    )
                        .trim(),

                requirementIds:
                    uniqueStrings(
                        endpoint?.requirementIds
                    ),

                method,

                path,

                summary:
                    String(
                        endpoint?.summary
                        ??
                        ""
                    )
                        .trim(),

                description:
                    String(
                        endpoint?.description
                        ??
                        ""
                    )
                        .trim(),

                auth: {

                    required:
                        typeof endpoint?.auth?.required
                        ===
                        "boolean"
                            ?
                            endpoint.auth.required
                            :
                            authenticationRequired,

                    roles:
                        uniqueStrings(
                            endpoint?.auth?.roles
                        )

                },

                pathParameters,

                queryParameters,

                requestBody,

                responses:
                    normalizeResponses(
                        endpoint?.responses
                    ),

                pagination,

                businessRules:
                    uniqueStrings(
                        endpoint?.businessRules
                    )

            };

        }
    );

}


function normalizeParameters(
    value:
        unknown,
    forceRequired:
        boolean
) {

    if (
        !Array.isArray(
            value
        )
    ) {

        return [];

    }


    return value
        .map(
            parameter => ({

                name:
                    String(
                        parameter?.name
                        ??
                        ""
                    )
                        .trim(),

                type:
                    normalizePrimitiveType(
                        parameter?.type
                    ),

                required:
                    forceRequired
                        ?
                        true
                        :
                        Boolean(
                            parameter?.required
                        ),

                description:
                    String(
                        parameter?.description
                        ??
                        ""
                    )
                        .trim(),

                format:
                    normalizeNullableString(
                        parameter?.format
                    )

            })
        )
        .filter(
            parameter =>
                parameter.name.length > 0
        );

}


function normalizeRequestBody(
    value:
        any
) {

    if (
        !value
        ||
        typeof value
        !==
        "object"
    ) {

        return null;

    }


    const schemaRef =
        normalizeNullableString(
            value.schemaRef
        );


    if (
        !schemaRef
    ) {

        return null;

    }


    const contentType =
        normalizeContentType(
            value.contentType
        );


    return {

        required:
            typeof value.required
            ===
            "boolean"
                ?
                value.required
                :
                true,

        contentType,

        schemaRef

    };

}


function normalizeResponses(
    value:
        unknown
) {

    if (
        !Array.isArray(
            value
        )
    ) {

        return [];

    }


    return value
        .map(
            response => ({

                statusCode:
                    normalizeStatusCode(
                        response?.statusCode
                    ),

                description:
                    String(
                        response?.description
                        ??
                        ""
                    )
                        .trim(),

                schemaRef:
                    normalizeNullableString(
                        response?.schemaRef
                    )

            })
        )
        .filter(
            response =>
                Number.isInteger(
                    response.statusCode
                )
                &&
                response.statusCode >= 100
                &&
                response.statusCode <= 599
        );

}


function normalizePagination(
    value:
        any,
    queryParameters:
        Array<{
            name: string;
        }>
) {

    if (
        !value
        ||
        typeof value
        !==
        "object"
    ) {

        return null;

    }


    const queryNames =
        new Set(
            queryParameters.map(
                parameter =>
                    parameter.name
                        .trim()
                        .toLowerCase()
            )
        );


    let strategy =
        String(
            value.strategy
            ??
            ""
        )
            .trim()
            .toUpperCase()
            .replace(
                /\s+/g,
                "_"
            );


    if (
        strategy
        ===
        "OFFSET_BASED"
        ||
        strategy
        ===
        "OFFSET-BASED"
        ||
        strategy
        ===
        "PAGE"
        ||
        strategy
        ===
        "PAGED"
        ||
        strategy
        ===
        "PAGE_BASED"
        ||
        strategy
        ===
        "PAGE-BASED"
        ||
        strategy
        ===
        "PAGE_NUMBER"
        ||
        strategy
        ===
        "PAGE_NUMBER_BASED"
    ) {

        strategy =
            "OFFSET";

    }


    if (
        strategy
        ===
        "CURSOR_BASED"
        ||
        strategy
        ===
        "CURSOR-BASED"
        ||
        strategy
        ===
        "TOKEN"
        ||
        strategy
        ===
        "TOKEN_BASED"
    ) {

        strategy =
            "CURSOR";

    }


    if (
        strategy
        !==
        "OFFSET"
        &&
        strategy
        !==
        "CURSOR"
    ) {

        if (
            queryNames.has(
                "cursor"
            )
            ||
            queryNames.has(
                "nextcursor"
            )
            ||
            queryNames.has(
                "continuationtoken"
            )
        ) {

            strategy =
                "CURSOR";

        }
        else if (
            queryNames.has(
                "page"
            )
            ||
            queryNames.has(
                "offset"
            )
            ||
            queryNames.has(
                "pagenumber"
            )
        ) {

            strategy =
                "OFFSET";

        }
        else {

            return null;

        }

    }


    let defaultLimit =
        normalizePositiveInteger(
            value.defaultLimit,
            20
        );


    let maxLimit =
        normalizePositiveInteger(
            value.maxLimit,
            100
        );


    if (
        maxLimit < 1
    ) {

        maxLimit =
            100;

    }


    if (
        defaultLimit
        >
        maxLimit
    ) {

        defaultLimit =
            maxLimit;

    }


    return {

        strategy:
            strategy as
                "OFFSET"
                |
                "CURSOR",

        defaultLimit,

        maxLimit

    };

}


function normalizeSchemas(
    value:
        unknown
): any[] {

    if (
        !Array.isArray(
            value
        )
    ) {

        return [];

    }


    return value
        .map(
            schema => ({

                name:
                    String(
                        schema?.name
                        ??
                        ""
                    )
                        .trim(),

                description:
                    String(
                        schema?.description
                        ??
                        ""
                    )
                        .trim(),

                fields:
                    Array.isArray(
                        schema?.fields
                    )
                        ?
                        schema.fields
                            .map(
                                (field: any) => ({

                                    name:
                                        String(
                                            field?.name
                                            ??
                                            ""
                                        )
                                            .trim(),

                                    type:
                                        normalizeFieldType(
                                            field?.type
                                        ),

                                    required:
                                        Boolean(
                                            field?.required
                                        ),

                                    nullable:
                                        Boolean(
                                            field?.nullable
                                        ),

                                    description:
                                        String(
                                            field?.description
                                            ??
                                            ""
                                        )
                                            .trim(),

                                    format:
                                        normalizeNullableString(
                                            field?.format
                                        ),

                                    schemaRef:
                                        normalizeNullableString(
                                            field?.schemaRef
                                        ),

                                    items:
                                        normalizeArrayItem(
                                            field?.items
                                        ),

                                    enumValues:
                                        uniqueStrings(
                                            field?.enumValues
                                        )

                                })
                            )
                            .filter(
                                (field: any) =>
                                    field.name.length > 0
                            )
                        :
                        []

            })
        )
        .filter(
            schema =>
                schema.name.length > 0
        );

}


function normalizeArrayItem(
    value:
        any
) {

    if (
        !value
        ||
        typeof value
        !==
        "object"
    ) {

        return null;

    }


    const type =
        normalizeFieldType(
            value.type
        );


    return {

        type,

        format:
            normalizeNullableString(
                value.format
            ),

        schemaRef:
            normalizeNullableString(
                value.schemaRef
            )

    };

}


function ensureStandardErrorSchema(
    schemas:
        any[]
): void {

    const existingIndex =
        schemas.findIndex(
            schema =>
                schema?.name
                ===
                "ApiError"
        );


    const schema = {

        name:
            "ApiError",

        description:
            "Standard API error response.",

        fields: [
            {

                name:
                    "code",

                type:
                    "STRING",

                required:
                    true,

                nullable:
                    false,

                description:
                    "Stable machine-readable error code.",

                format:
                    null,

                schemaRef:
                    null,

                items:
                    null,

                enumValues:
                    []

            },
            {

                name:
                    "message",

                type:
                    "STRING",

                required:
                    true,

                nullable:
                    false,

                description:
                    "Human-readable error message.",

                format:
                    null,

                schemaRef:
                    null,

                items:
                    null,

                enumValues:
                    []

            },
            {

                name:
                    "details",

                type:
                    "OBJECT",

                required:
                    false,

                nullable:
                    true,

                description:
                    "Optional structured error details.",

                format:
                    null,

                schemaRef:
                    null,

                items:
                    null,

                enumValues:
                    []

            }
        ]

    };


    if (
        existingIndex
        >=
        0
    ) {

        schemas[
            existingIndex
        ] =
            schema;

        return;

    }


    schemas.push(
        schema
    );

}


function standardErrorModel() {

    return {

        schemaRef:
            "ApiError",

        codes: [
            {

                code:
                    "VALIDATION_ERROR",

                httpStatus:
                    400,

                description:
                    "Request parameters or body are invalid."

            },
            {

                code:
                    "UNAUTHORIZED",

                httpStatus:
                    401,

                description:
                    "Authentication is required or credentials are invalid."

            },
            {

                code:
                    "FORBIDDEN",

                httpStatus:
                    403,

                description:
                    "Authenticated user lacks permission."

            },
            {

                code:
                    "NOT_FOUND",

                httpStatus:
                    404,

                description:
                    "Requested resource does not exist."

            },
            {

                code:
                    "CONFLICT",

                httpStatus:
                    409,

                description:
                    "Request conflicts with current resource or domain state."

            },
            {

                code:
                    "INTERNAL_ERROR",

                httpStatus:
                    500,

                description:
                    "Unexpected server failure."

            }
        ]

    };

}


function normalizeEndpointPath(
    value:
        string,
    routePrefix:
        string
): string {

    const prefix =
        normalizePath(
            routePrefix
        );


    const trimmed =
        value
            .trim()
            .replace(
                /:([A-Za-z0-9_]+)/g,
                "{$1}"
            );


    if (
        !trimmed
    ) {

        return prefix;

    }


    const normalized =
        normalizePath(
            trimmed
        );


    /*
     * Already uses the authoritative prefix.
     */
    if (
        normalized
        ===
        prefix
        ||
        normalized.startsWith(
            `${prefix}/`
        )
    ) {

        return normalized;

    }


    /*
     * A complete API path targeting another API group
     * should not be silently changed.
     *
     * The structural validator will reject it if it
     * does not belong to the current group.
     */
    if (
        normalized.startsWith(
            "/api/"
        )
    ) {

        return normalized;

    }


    /*
     * Last segment of authoritative prefix.
     *
     * /api/v1/auth
     * -> auth
     *
     * /api/v1/events
     * -> events
     */
    const prefixSegments =
        prefix
            .split(
                "/"
            )
            .filter(
                Boolean
            );


    const resourceSegment =
        prefixSegments[
            prefixSegments.length - 1
        ];


    const normalizedSegments =
        normalized
            .split(
                "/"
            )
            .filter(
                Boolean
            );


    /*
     * Prevent duplicated resource prefixes.
     *
     * Prefix:
     * /api/v1/auth
     *
     * Generated:
     * /auth/login
     *
     * Result:
     * /api/v1/auth/login
     *
     * NOT:
     * /api/v1/auth/auth/login
     */
    if (
        resourceSegment
        &&
        normalizedSegments.length > 0
        &&
        normalizedSegments[0]
            .toLowerCase()
        ===
        resourceSegment
            .toLowerCase()
    ) {

        const remainingPath =
            normalizedSegments
                .slice(
                    1
                )
                .join(
                    "/"
                );


        if (
            !remainingPath
        ) {

            return prefix;

        }


        return normalizePath(
            `${prefix}/${remainingPath}`
        );

    }


    /*
     * Relative shorthand.
     *
     * /login
     * /search
     * /{eventId}
     *
     * becomes:
     *
     * /api/v1/auth/login
     * /api/v1/events/search
     * /api/v1/events/{eventId}
     */
    return normalizePath(
        `${prefix}/${normalized.replace(/^\/+/, "")}`
    );

}


function normalizePath(
    value:
        string
): string {

    let result =
        value
            .trim()
            .replace(
                /\/+/g,
                "/"
            );


    if (
        !result.startsWith(
            "/"
        )
    ) {

        result =
            `/${result}`;

    }


    if (
        result.length > 1
        &&
        result.endsWith(
            "/"
        )
    ) {

        result =
            result.slice(
                0,
                -1
            );

    }


    return result;

}


function normalizeNullableString(
    value:
        unknown
): string | null {

    if (
        typeof value
        !==
        "string"
    ) {

        return null;

    }


    const trimmed =
        value.trim();


    return trimmed
        ?
        trimmed
        :
        null;

}


function normalizePositiveInteger(
    value:
        unknown,
    fallback:
        number
): number {

    const numeric =
        Number(
            value
        );


    if (
        !Number.isFinite(
            numeric
        )
        ||
        numeric <= 0
    ) {

        return fallback;

    }


    return Math.floor(
        numeric
    );

}


function normalizeStatusCode(
    value:
        unknown
): number {

    const numeric =
        Number(
            value
        );


    if (
        !Number.isFinite(
            numeric
        )
    ) {

        return 500;

    }


    return Math.floor(
        numeric
    );

}


function normalizeContentType(
    value:
        unknown
):
    "application/json"
    |
    "multipart/form-data" {

    const normalized =
        String(
            value
            ??
            ""
        )
            .trim()
            .toLowerCase();


    if (
        normalized
        ===
        "multipart/form-data"
        ||
        normalized
        ===
        "multipart"
        ||
        normalized
        ===
        "form-data"
    ) {

        return "multipart/form-data";

    }


    return "application/json";

}


function normalizePrimitiveType(
    value:
        unknown
):
    "STRING"
    |
    "INTEGER"
    |
    "NUMBER"
    |
    "BOOLEAN" {

    const normalized =
        String(
            value
            ??
            "STRING"
        )
            .trim()
            .toUpperCase();


    switch (
        normalized
    ) {

        case "INTEGER":
        case "INT":
            return "INTEGER";

        case "NUMBER":
        case "FLOAT":
        case "DOUBLE":
        case "DECIMAL":
            return "NUMBER";

        case "BOOLEAN":
        case "BOOL":
            return "BOOLEAN";

        default:
            return "STRING";

    }

}


function normalizeFieldType(
    value:
        unknown
):
    "STRING"
    |
    "INTEGER"
    |
    "NUMBER"
    |
    "BOOLEAN"
    |
    "OBJECT"
    |
    "ARRAY"
    |
    "BINARY" {

    const normalized =
        String(
            value
            ??
            "STRING"
        )
            .trim()
            .toUpperCase();


    switch (
        normalized
    ) {

        case "INTEGER":
        case "INT":
            return "INTEGER";

        case "NUMBER":
        case "FLOAT":
        case "DOUBLE":
        case "DECIMAL":
            return "NUMBER";

        case "BOOLEAN":
        case "BOOL":
            return "BOOLEAN";

        case "OBJECT":
        case "JSON":
            return "OBJECT";

        case "ARRAY":
        case "LIST":
            return "ARRAY";

        case "BINARY":
        case "FILE":
        case "BUFFER":
            return "BINARY";

        default:
            return "STRING";

    }

}


function uniqueStrings(
    value:
        unknown
): string[] {

    if (
        !Array.isArray(
            value
        )
    ) {

        return [];

    }


    return [
        ...new Set(
            value
                .filter(
                    item =>
                        typeof item
                        ===
                        "string"
                )
                .map(
                    item =>
                        item.trim()
                )
                .filter(
                    Boolean
                )
        )
    ];

}
import type {
    ApiContract
} from "../schemas/apiContractSchema.js";

import type {
    BackendContract
} from "../schemas/backendContractSchema.js";


export function validateApiContract(
    api:
        ApiContract,
    backend:
        BackendContract
): void {

    validateIdentity(
        api,
        backend
    );


    const expectedGroups =
        backend.modules.flatMap(
            module =>
                module.apiGroups.map(
                    group => ({

                        ...group,

                        ownerModule:
                            module.name

                    })
                )
        );


    if (
        api.groups.length
        !==
        expectedGroups.length
    ) {

        throw new Error(
            `API_GROUP_COUNT_MISMATCH: expected ${expectedGroups.length}, received ${api.groups.length}`
        );

    }


    const schemaNames =
        new Set<string>();


    for (
        const schema
        of api.schemas
    ) {

        if (
            schemaNames.has(
                schema.name
            )
        ) {

            throw new Error(
                `API_DUPLICATE_SCHEMA:${schema.name}`
            );

        }


        schemaNames.add(
            schema.name
        );

    }


    const operationIds =
        new Set<string>();


    const endpointKeys =
        new Set<string>();


    const validRequirementIds =
        new Set(
            backend.functionalRequirements.map(
                requirement =>
                    requirement.id
            )
        );


    const coveredRequirementIds =
        new Set<string>();


    const validRoles =
        new Set(
            backend.actors
        );


    for (
        const expected
        of expectedGroups
    ) {

        const group =
            api.groups.find(
                candidate =>
                    candidate.name
                    ===
                    expected.name
            );


        if (
            !group
        ) {

            throw new Error(
                `API_MISSING_GROUP:${expected.name}`
            );

        }


        if (
            group.ownerModule
            !==
            expected.ownerModule
        ) {

            throw new Error(
                `API_GROUP_OWNER_MISMATCH:${group.name}`
            );

        }


        if (
            group.routePrefix
            !==
            normalizePath(
                expected.routePrefix
            )
        ) {

            throw new Error(
                `API_GROUP_PREFIX_MISMATCH:${group.name}`
            );

        }


        const allowedMethods =
            new Set(
                expected.methods
            );


        for (
            const endpoint
            of group.endpoints
        ) {

            if (
                !allowedMethods.has(
                    endpoint.method
                )
            ) {

                throw new Error(
                    `API_METHOD_NOT_ALLOWED:${endpoint.method}:${endpoint.path}`
                );

            }


            validateOperationId(
                endpoint.operationId
            );


            if (
                operationIds.has(
                    endpoint.operationId
                )
            ) {

                throw new Error(
                    `API_DUPLICATE_OPERATION_ID:${endpoint.operationId}`
                );

            }


            operationIds.add(
                endpoint.operationId
            );


            if (
                !isPathInsidePrefix(
                    endpoint.path,
                    group.routePrefix
                )
            ) {

                throw new Error(
                    `API_PATH_OUTSIDE_GROUP:${endpoint.path}`
                );

            }


            const endpointKey =
                `${endpoint.method} ${endpoint.path}`;


            if (
                endpointKeys.has(
                    endpointKey
                )
            ) {

                throw new Error(
                    `API_DUPLICATE_ENDPOINT:${endpointKey}`
                );

            }


            endpointKeys.add(
                endpointKey
            );


            validatePathParameters(
                endpoint.path,
                endpoint.pathParameters
            );


            validateQueryParameters(
                endpoint.queryParameters
            );


            if (
                endpoint.method
                ===
                "GET"
                &&
                endpoint.requestBody
            ) {

                throw new Error(
                    `API_GET_REQUEST_BODY_NOT_ALLOWED:${endpoint.operationId}`
                );

            }


            validateEndpointAuth(
                endpoint.auth,
                validRoles,
                endpoint.operationId
            );


            for (
                const requirementId
                of endpoint.requirementIds
            ) {

                if (
                    !validRequirementIds.has(
                        requirementId
                    )
                ) {

                    throw new Error(
                        `API_UNKNOWN_REQUIREMENT:${requirementId}:${endpoint.operationId}`
                    );

                }


                coveredRequirementIds.add(
                    requirementId
                );

            }


            validateResponses(
                endpoint.operationId,
                endpoint.responses,
                schemaNames
            );


            if (
                endpoint.requestBody
            ) {

                validateSchemaReference(
                    endpoint.requestBody.schemaRef,
                    schemaNames,
                    `requestBody:${endpoint.operationId}`
                );

            }


            validatePagination(
                endpoint
            );

        }

    }


    validateSchemaReferences(
        api,
        schemaNames
    );


    validateSchemaReference(
        api.errorModel.schemaRef,
        schemaNames,
        "errorModel"
    );


    const uncovered =
        backend.functionalRequirements
            .map(
                requirement =>
                    requirement.id
            )
            .filter(
                requirementId =>
                    !coveredRequirementIds.has(
                        requirementId
                    )
            );


    if (
        uncovered.length
        >
        0
    ) {

        throw new Error(
            `API_UNCOVERED_REQUIREMENTS:${uncovered.join(",")}`
        );

    }

}


function validateIdentity(
    api:
        ApiContract,
    backend:
        BackendContract
): void {

    if (
        api.projectName
        !==
        backend.projectName
    ) {

        throw new Error(
            "API_PROJECT_MISMATCH"
        );

    }


    if (
        api.apiStyle
        !==
        backend.technology.apiStyle
    ) {

        throw new Error(
            "API_STYLE_MISMATCH"
        );

    }


    if (
        api.authentication.strategy
        !==
        backend.authentication.strategy
    ) {

        throw new Error(
            "API_AUTH_STRATEGY_MISMATCH"
        );

    }

}


function validateOperationId(
    operationId:
        string
): void {

    if (
        !/^[a-z][A-Za-z0-9]*$/.test(
            operationId
        )
    ) {

        throw new Error(
            `API_INVALID_OPERATION_ID:${operationId}`
        );

    }

}


function validatePathParameters(
    path:
        string,
    parameters:
        Array<{
            name: string;
            required: boolean;
        }>
): void {

    const placeholders =
        extractPathParameters(
            path
        );


    const parameterNames =
        parameters.map(
            parameter =>
                parameter.name
        );


    if (
        new Set(
            parameterNames
        ).size
        !==
        parameterNames.length
    ) {

        throw new Error(
            `API_DUPLICATE_PATH_PARAMETER:${path}`
        );

    }


    const sortedPlaceholders =
        [
            ...placeholders
        ]
            .sort();


    const sortedParameters =
        [
            ...parameterNames
        ]
            .sort();


    if (
        JSON.stringify(
            sortedPlaceholders
        )
        !==
        JSON.stringify(
            sortedParameters
        )
    ) {

        throw new Error(
            `API_PATH_PARAMETER_MISMATCH:${path}`
        );

    }


    for (
        const parameter
        of parameters
    ) {

        if (
            !parameter.required
        ) {

            throw new Error(
                `API_PATH_PARAMETER_NOT_REQUIRED:${path}:${parameter.name}`
            );

        }

    }

}


function validateQueryParameters(
    parameters:
        Array<{
            name: string;
        }>
): void {

    const names =
        parameters.map(
            parameter =>
                parameter.name
        );


    if (
        new Set(
            names
        ).size
        !==
        names.length
    ) {

        throw new Error(
            "API_DUPLICATE_QUERY_PARAMETER"
        );

    }

}


function validateEndpointAuth(
    auth:
        {
            required: boolean;
            roles: string[];
        },
    validRoles:
        Set<string>,
    operationId:
        string
): void {

    for (
        const role
        of auth.roles
    ) {

        if (
            !validRoles.has(
                role
            )
        ) {

            throw new Error(
                `API_UNKNOWN_ROLE:${role}:${operationId}`
            );

        }

    }


    if (
        !auth.required
        &&
        auth.roles.length
        >
        0
    ) {

        throw new Error(
            `API_PUBLIC_ENDPOINT_WITH_ROLES:${operationId}`
        );

    }

}


function validateResponses(
    operationId:
        string,
    responses:
        Array<{
            statusCode: number;
            schemaRef: string | null;
        }>,
    schemaNames:
        Set<string>
): void {

    const statusCodes =
        new Set<number>();


    let hasSuccess =
        false;


    for (
        const response
        of responses
    ) {

        if (
            statusCodes.has(
                response.statusCode
            )
        ) {

            throw new Error(
                `API_DUPLICATE_RESPONSE_STATUS:${operationId}:${response.statusCode}`
            );

        }


        statusCodes.add(
            response.statusCode
        );


        if (
            response.statusCode
            >=
            200
            &&
            response.statusCode
            <
            300
        ) {

            hasSuccess =
                true;

        }


        if (
            response.schemaRef
        ) {

            validateSchemaReference(
                response.schemaRef,
                schemaNames,
                `response:${operationId}:${response.statusCode}`
            );

        }

    }


    if (
        !hasSuccess
    ) {

        throw new Error(
            `API_NO_SUCCESS_RESPONSE:${operationId}`
        );

    }

}


function validateSchemaReferences(
    api:
        ApiContract,
    schemaNames:
        Set<string>
): void {

    for (
        const schema
        of api.schemas
    ) {

        for (
            const field
            of schema.fields
        ) {

            if (
                field.schemaRef
            ) {

                validateSchemaReference(
                    field.schemaRef,
                    schemaNames,
                    `schema:${schema.name}.${field.name}`
                );

            }


            if (
                field.items?.schemaRef
            ) {

                validateSchemaReference(
                    field.items.schemaRef,
                    schemaNames,
                    `schemaArray:${schema.name}.${field.name}`
                );

            }

        }

    }

}


function validateSchemaReference(
    reference:
        string,
    schemaNames:
        Set<string>,
    location:
        string
): void {

    if (
        !schemaNames.has(
            reference
        )
    ) {

        throw new Error(
            `API_UNKNOWN_SCHEMA_REF:${reference}:${location}`
        );

    }

}


function validatePagination(
    endpoint:
        {
            operationId: string;

            queryParameters:
                Array<{
                    name: string;
                }>;

            pagination:
                {
                    strategy:
                        "OFFSET"
                        |
                        "CURSOR";

                    defaultLimit:
                        number;

                    maxLimit:
                        number;
                }
                |
                null;
        }
): void {

    if (
        !endpoint.pagination
    ) {

        return;

    }


    if (
        endpoint.pagination.defaultLimit
        >
        endpoint.pagination.maxLimit
    ) {

        throw new Error(
            `API_INVALID_PAGINATION_LIMIT:${endpoint.operationId}`
        );

    }


    const queryNames =
        new Set(
            endpoint.queryParameters.map(
                parameter =>
                    parameter.name
            )
        );


    if (
        endpoint.pagination.strategy
        ===
        "OFFSET"
    ) {

        const hasPaginationParameters =
            queryNames.has(
                "page"
            )
            ||
            queryNames.has(
                "offset"
            );


        if (
            !hasPaginationParameters
        ) {

            throw new Error(
                `API_OFFSET_PAGINATION_PARAMETER_MISSING:${endpoint.operationId}`
            );

        }


        if (
            !queryNames.has(
                "limit"
            )
        ) {

            throw new Error(
                `API_PAGINATION_LIMIT_PARAMETER_MISSING:${endpoint.operationId}`
            );

        }

    }


    if (
        endpoint.pagination.strategy
        ===
        "CURSOR"
    ) {

        if (
            !queryNames.has(
                "cursor"
            )
        ) {

            throw new Error(
                `API_CURSOR_PARAMETER_MISSING:${endpoint.operationId}`
            );

        }


        if (
            !queryNames.has(
                "limit"
            )
        ) {

            throw new Error(
                `API_PAGINATION_LIMIT_PARAMETER_MISSING:${endpoint.operationId}`
            );

        }

    }

}


function extractPathParameters(
    path:
        string
): string[] {

    const result:
        string[] =
        [];


    const regex =
        /\{([^{}]+)\}/g;


    let match:
        RegExpExecArray
        |
        null;


    while (
        (
            match =
                regex.exec(
                    path
                )
        )
        !==
        null
    ) {

        result.push(
            match[1]
        );

    }


    return result;

}


function isPathInsidePrefix(
    path:
        string,
    prefix:
        string
): boolean {

    const normalizedPath =
        normalizePath(
            path
        );


    const normalizedPrefix =
        normalizePath(
            prefix
        );


    return (
        normalizedPath
        ===
        normalizedPrefix
        ||
        normalizedPath.startsWith(
            `${normalizedPrefix}/`
        )
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
        result.length
        >
        1
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
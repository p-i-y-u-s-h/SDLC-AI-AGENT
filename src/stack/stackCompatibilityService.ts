import type {
    TechnologyManifest
} from "../types/technology.js";


const frameworkLanguages:
    Record<
        string,
        string[]
    > = {

    fastapi: [
        "python"
    ],

    django: [
        "python"
    ],

    flask: [
        "python"
    ],

    nestjs: [
        "typescript",
        "javascript"
    ],

    express: [
        "typescript",
        "javascript"
    ],

    expressjs: [
        "typescript",
        "javascript"
    ],

    fastify: [
        "typescript",
        "javascript"
    ],

    hono: [
        "typescript",
        "javascript"
    ],

    springboot: [
        "java",
        "kotlin"
    ],

    ktor: [
        "kotlin"
    ],

    aspnetcore: [
        "csharp"
    ],

    gin: [
        "go"
    ],

    fiber: [
        "go"
    ],

    axum: [
        "rust"
    ],

    actixweb: [
        "rust"
    ],

    laravel: [
        "php"
    ],

    rails: [
        "ruby"
    ],

    rubyonrails: [
        "ruby"
    ],

    phoenix: [
        "elixir"
    ]

};


export function validateTechnologyCompatibility(
    manifest: TechnologyManifest
) {

    const language =
        normalizeLanguage(
            manifest.backend.language.value
        );


    const framework =
        normalizeTechnology(
            manifest.backend.framework.value
        );


    const allowedLanguages =
        frameworkLanguages[
            framework
        ];


    if (
        !allowedLanguages
    ) {

        return;
    }


    if (
        allowedLanguages.includes(
            language
        )
    ) {

        return;
    }


    throw new Error(
        `INCOMPATIBLE_TECH_STACK: ${manifest.backend.language.value} cannot use ${manifest.backend.framework.value}.`
    );
}


function normalizeLanguage(
    value: string
) {

    const normalized =
        normalizeTechnology(
            value
        );


    if (
        normalized === "c#"
        ||
        normalized === "csharp"
    ) {

        return "csharp";
    }


    if (
        normalized === "golang"
    ) {

        return "go";
    }


    return normalized;
}


function normalizeTechnology(
    value: string
) {

    return String(value)

        .toLowerCase()

        .replace(
            /[^a-z0-9#+]/g,
            ""
        );
}
import fs from "fs";
import path from "path";


export interface ProjectWorkspace {

    projectName: string;
    projectSlug: string;
    root: string;

    outputDir: string;
    databaseDir: string;
    generatedDir: string;
    backendDir: string;
    frontendDir: string;
    testsDir: string;
    deploymentDir: string;

    requirements: string;
    architecture: string;
    technologyManifest: string;
    storageContract: string;

    databaseDesign: string;
    schemaSQL: string;
    erDiagram: string;
    erLayout: string;

    backendExecutionProfile: string;
    backendContract: string;

    apiContractRaw: string;
    apiContract: string;

    backendGenerationPlan: string;

    tokenUsage: string;
}


export function createProjectWorkspace(
    projectName: string
): ProjectWorkspace {

    const projectsRoot =
        "projects";


    fs.mkdirSync(
        projectsRoot,
        {
            recursive: true
        }
    );


    const baseSlug =
        slugify(
            projectName
        );


    let projectSlug =
        baseSlug;


    let projectRoot =
        path.join(
            projectsRoot,
            projectSlug
        );


    let counter =
        2;


    while (
        fs.existsSync(
            projectRoot
        )
    ) {

        projectSlug =
            `${baseSlug}-${counter}`;


        projectRoot =
            path.join(
                projectsRoot,
                projectSlug
            );


        counter++;

    }


    const workspace =
        buildWorkspace(
            projectName,
            projectSlug,
            projectRoot
        );


    ensureWorkspaceDirectories(
        workspace
    );


    console.log(
        `\nProject workspace: ${projectRoot}`
    );


    return workspace;

}


export function getOrCreateProjectWorkspace(
    projectName: string
): ProjectWorkspace {

    const projectsRoot =
        "projects";

    fs.mkdirSync(
        projectsRoot,
        {
            recursive: true
        }
    );

    const baseSlug =
        slugify(
            projectName
        );

    const projectRoot =
        path.join(
            projectsRoot,
            baseSlug
        );

    if (
        fs.existsSync(
            projectRoot
        )
    ) {

        return openProjectWorkspace(
            baseSlug
        );

    }

    return createProjectWorkspace(
        projectName
    );

}


export function openProjectWorkspace(
    projectSlug: string
): ProjectWorkspace {

    const projectRoot =
        path.join(
            "projects",
            projectSlug
        );


    if (
        !fs.existsSync(
            projectRoot
        )
    ) {

        throw new Error(
            `PROJECT_WORKSPACE_NOT_FOUND:${projectRoot}`
        );

    }


    const projectName =
        resolveExistingProjectName(
            projectRoot,
            projectSlug
        );


    const workspace =
        buildWorkspace(
            projectName,
            projectSlug,
            projectRoot
        );


    ensureWorkspaceDirectories(
        workspace
    );


    console.log(
        `\nUsing existing workspace: ${projectRoot}`
    );


    return workspace;

}


function buildWorkspace(
    projectName: string,
    projectSlug: string,
    projectRoot: string
): ProjectWorkspace {

    const outputDir =
        path.join(
            projectRoot,
            "output"
        );


    const databaseDir =
        path.join(
            projectRoot,
            "database"
        );


    const generatedDir =
        path.join(
            projectRoot,
            "generated"
        );


    const backendDir =
        path.join(
            generatedDir,
            "backend"
        );


    const frontendDir =
        path.join(
            generatedDir,
            "frontend"
        );


    const testsDir =
        path.join(
            projectRoot,
            "tests"
        );


    const deploymentDir =
        path.join(
            projectRoot,
            "deployment"
        );


    return {

        projectName,

        projectSlug,

        root:
            projectRoot,

        outputDir,

        databaseDir,

        generatedDir,

        backendDir,

        frontendDir,

        testsDir,

        deploymentDir,

        requirements:
            path.join(
                outputDir,
                "requirements.json"
            ),

        architecture:
            path.join(
                outputDir,
                "architecture.json"
            ),

        technologyManifest:
            path.join(
                outputDir,
                "technology-manifest.json"
            ),

        storageContract:
            path.join(
                outputDir,
                "storage-contract.json"
            ),

        databaseDesign:
            path.join(
                outputDir,
                "database-design.json"
            ),

        schemaSQL:
            path.join(
                databaseDir,
                "schema.sql"
            ),

        erDiagram:
            path.join(
                outputDir,
                "er-diagram.svg"
            ),

        erLayout:
            path.join(
                outputDir,
                "er-layout.json"
            ),

        backendExecutionProfile:
            path.join(
                outputDir,
                "backend-execution-profile.json"
            ),

        backendContract:
            path.join(
                outputDir,
                "backend-contract.json"
            ),

        apiContractRaw:
            path.join(
                outputDir,
                "api-contract.raw.json"
            ),

        apiContract:
            path.join(
                outputDir,
                "api-contract.json"
            ),

        backendGenerationPlan:
            path.join(
                outputDir,
                "backend-generation-plan.json"
            ),

        tokenUsage:
            path.join(
                outputDir,
                "token-usage.json"
            )

    };

}


function ensureWorkspaceDirectories(
    workspace: ProjectWorkspace
): void {

    const directories = [

        workspace.root,
        workspace.outputDir,
        workspace.databaseDir,
        workspace.generatedDir,
        workspace.backendDir,
        workspace.frontendDir,
        workspace.testsDir,
        workspace.deploymentDir

    ];


    for (
        const directory
        of directories
    ) {

        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        );

    }

}


function resolveExistingProjectName(
    projectRoot: string,
    fallback:
        string
): string {

    const candidates = [

        path.join(
            projectRoot,
            "output",
            "requirements.json"
        ),

        path.join(
            projectRoot,
            "output",
            "backend-contract.json"
        ),

        path.join(
            projectRoot,
            "output",
            "backend-generation-plan.json"
        )

    ];


    for (
        const candidate
        of candidates
    ) {

        if (
            !fs.existsSync(
                candidate
            )
        ) {

            continue;

        }


        try {

            const parsed =
                JSON.parse(
                    fs.readFileSync(
                        candidate,
                        "utf-8"
                    )
                );


            if (
                typeof parsed?.projectName
                ===
                "string"
                &&
                parsed.projectName.trim()
            ) {

                return parsed.projectName.trim();

            }

        }
        catch {

            continue;

        }

    }


    return fallback;

}


function slugify(
    value: string
): string {

    const slug =
        String(
            value
        )
            .toLowerCase()
            .trim()
            .replace(
                /[^a-z0-9]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            );


    return (
        slug
        ||
        "unnamed-project"
    );

}
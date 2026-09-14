import fs from "fs";
import path from "path";

import {
    Graphviz
} from "@hpcc-js/wasm-graphviz";


interface Column {

    columnName: string;

    dataType: string;

    isPrimaryKey: boolean;

    isNullable: boolean;

    isUnique: boolean;

    defaultValue?: string;
}


interface Table {

    tableName: string;

    columns: Column[];
}


interface Relationship {

    fromTable: string;

    fromColumn: string;

    toTable: string;

    toColumn: string;

    relationshipType: string;
}


interface DatabaseDesign {

    databaseName: string;

    tables: Table[];

    relationships: Relationship[];
}


interface RequirementModule {

    name: string;

    description: string;
}


interface Requirements {

    projectName?: string;

    modules?: RequirementModule[];
}


interface NormalizedRelation {

    parentTable: string;

    parentColumn: string;

    childTable: string;

    childColumn: string;

    label: string;
}


// ============================================================
// MAIN
// ============================================================

export async function generateGraphvizER(
    database: DatabaseDesign,
    requirements: Requirements
) {

    console.log(
        "Generating structured ER documentation..."
    );


    fs.mkdirSync(
        "output",
        {
            recursive: true
        }
    );


    fs.mkdirSync(
        "output/er-modules",
        {
            recursive: true
        }
    );


    const graphviz =
        await Graphviz.load();


    // --------------------------------------------------------
    // Normalize relationships
    // --------------------------------------------------------

    const relationships =
        database.relationships.map(
            normalizeRelationship
        );


    // --------------------------------------------------------
    // Detect modules
    // --------------------------------------------------------

    const modules =
        detectTableModules(
            database,
            requirements,
            relationships
        );


    // ========================================================
    // 1. GENERATE MASTER OVERVIEW
    // ========================================================

    const overviewDOT =
        generateOverviewDOT(
            database,
            modules,
            relationships
        );


    fs.writeFileSync(

        "output/er-overview.dot",

        overviewDOT,

        "utf-8"

    );


    const overviewSVG =
        graphviz.layout(
            overviewDOT,
            "svg",
            "dot"
        );


    fs.writeFileSync(

        "output/er-overview.svg",

        overviewSVG,

        "utf-8"

    );


    console.log(
        "✅ output/er-overview.svg"
    );


    // ========================================================
    // 2. GENERATE MODULE DIAGRAMS
    // ========================================================

    for (
        const [moduleName, tableNames]
        of modules.entries()
    ) {

        if (
            tableNames.length === 0
        ) {
            continue;
        }


        const moduleDOT =
            generateModuleDOT(

                moduleName,

                tableNames,

                database,

                relationships

            );


        const safeName =
            fileSafeName(
                moduleName
            );


        const dotPath =
            path.join(

                "output",
                "er-modules",
                `${safeName}.dot`

            );


        const svgPath =
            path.join(

                "output",
                "er-modules",
                `${safeName}.svg`

            );


        fs.writeFileSync(

            dotPath,

            moduleDOT,

            "utf-8"

        );


        const svg =
            graphviz.layout(
                moduleDOT,
                "svg",
                "dot"
            );


        fs.writeFileSync(

            svgPath,

            svg,

            "utf-8"

        );


        console.log(
            `✅ ${svgPath}`
        );
    }


    console.log(
        "\n========================================"
    );

    console.log(
        "ER DOCUMENTATION COMPLETED"
    );

    console.log(
        "========================================"
    );


    console.log(
        `Tables: ${database.tables.length}`
    );


    console.log(
        `Relationships: ${relationships.length}`
    );


    console.log(
        `Modules: ${modules.size}`
    );
}


// ============================================================
// OVERVIEW DIAGRAM
// ============================================================

function generateOverviewDOT(

    database: DatabaseDesign,

    modules: Map<string, string[]>,

    relationships: NormalizedRelation[]

) {

    let dot = `

digraph EROverview {

    graph [

        rankdir=TB,

        bgcolor="white",

        pad="0.5",

        nodesep="0.6",

        ranksep="0.9",

        splines=polyline,

        overlap=false,

        compound=true,

        newrank=true

    ];


    node [

        shape=plain,

        fontname="Arial"

    ];


    edge [

        fontname="Arial",

        fontsize=9,

        arrowsize=0.7

    ];


    title [

        shape=plain,

        label=<

            <FONT POINT-SIZE="22">

                <B>${escapeHTML(
                    database.databaseName
                )}</B>

            </FONT>

        >

    ];

`;


    let clusterIndex = 0;


    // ========================================================
    // MODULE CLUSTERS
    // ========================================================

    for (
        const [moduleName, tables]
        of modules.entries()
    ) {

        clusterIndex++;


        dot += `

    subgraph cluster_${clusterIndex} {

        label="${escapeDOT(moduleName)}";

        labelloc="t";

        fontsize=16;

        fontname="Arial Bold";

        style="rounded";

        margin=20;

`;


        for (
            const tableName
            of tables
        ) {

            const table =
                database.tables.find(
                    t =>
                        t.tableName === tableName
                );


            if (!table) {
                continue;
            }


            const primaryKeys =
                table.columns
                    .filter(
                        c =>
                            c.isPrimaryKey
                    )
                    .map(
                        c =>
                            c.columnName
                    );


            const foreignKeys =
                relationships

                    .filter(
                        r =>
                            r.childTable ===
                            tableName
                    )

                    .map(
                        r =>
                            r.childColumn
                    );


            dot +=
                generateCompactTable(

                    table,

                    primaryKeys,

                    foreignKeys

                );

        }


        dot += `
    }

`;
    }


    // ========================================================
    // RELATIONSHIPS
    // ========================================================

    for (
        const relation
        of relationships
    ) {

        dot += `

    "${relation.parentTable}"
        ->
    "${relation.childTable}"
    [
        label="${relation.label}"
    ];

`;
    }


    dot += `
}
`;


    return dot;
}


// ============================================================
// COMPACT TABLE
// ============================================================

function generateCompactTable(

    table: Table,

    primaryKeys: string[],

    foreignKeys: string[]

) {

    let html = `

    "${table.tableName}" [

        label=<

            <TABLE

                BORDER="1"

                CELLBORDER="0"

                CELLSPACING="0"

                CELLPADDING="6"

            >

                <TR>

                    <TD>

                        <FONT POINT-SIZE="12">

                            <B>${escapeHTML(
                                table.tableName.toUpperCase()
                            )}</B>

                        </FONT>

                    </TD>

                </TR>
`;


    if (
        primaryKeys.length > 0
    ) {

        html += `

                <TR>

                    <TD ALIGN="LEFT">

                        PK: ${escapeHTML(
                            primaryKeys.join(", ")
                        )}

                    </TD>

                </TR>
`;

    }


    if (
        foreignKeys.length > 0
    ) {

        html += `

                <TR>

                    <TD ALIGN="LEFT">

                        FK: ${escapeHTML(
                            foreignKeys.join(", ")
                        )}

                    </TD>

                </TR>
`;

    }


    html += `

            </TABLE>

        >

    ];

`;


    return html;
}


// ============================================================
// MODULE DETAILED DIAGRAM
// ============================================================

function generateModuleDOT(

    moduleName: string,

    tableNames: string[],

    database: DatabaseDesign,

    relationships: NormalizedRelation[]

) {

    const tableSet =
        new Set(
            tableNames
        );


    // --------------------------------------------------------
    // External tables referenced by this module
    // --------------------------------------------------------

    const externalTables =
        new Set<string>();


    for (
        const relation
        of relationships
    ) {

        if (
            tableSet.has(
                relation.childTable
            ) &&
            !tableSet.has(
                relation.parentTable
            )
        ) {

            externalTables.add(
                relation.parentTable
            );

        }


        if (
            tableSet.has(
                relation.parentTable
            ) &&
            !tableSet.has(
                relation.childTable
            )
        ) {

            externalTables.add(
                relation.childTable
            );

        }

    }


    let dot = `

digraph ModuleER {

    graph [

        rankdir=TB,

        bgcolor="white",

        pad="0.5",

        nodesep="0.7",

        ranksep="1.0",

        splines=polyline,

        overlap=false

    ];


    node [

        shape=plain,

        fontname="Arial"

    ];


    edge [

        fontname="Arial",

        fontsize=9,

        arrowsize=0.7

    ];


    title [

        shape=plain,

        label=<

            <FONT POINT-SIZE="20">

                <B>${escapeHTML(
                    moduleName
                )}</B>

            </FONT>

        >

    ];

`;


    // ========================================================
    // INTERNAL FULL TABLES
    // ========================================================

    for (
        const tableName
        of tableNames
    ) {

        const table =
            database.tables.find(
                t =>
                    t.tableName === tableName
            );


        if (!table) {
            continue;
        }


        dot +=
            generateDetailedTable(
                table,
                relationships
            );

    }


    // ========================================================
    // EXTERNAL REFERENCES
    // ========================================================

    for (
        const external
        of externalTables
    ) {

        dot += `

    "${external}" [

        shape=box,

        style="dashed",

        label="${escapeDOT(
            external
        )}\\nExternal Module"

    ];

`;

    }


    // ========================================================
    // MODULE RELATIONSHIPS
    // ========================================================

    for (
        const relation
        of relationships
    ) {

        const touchesModule =

            tableSet.has(
                relation.parentTable
            )

            ||

            tableSet.has(
                relation.childTable
            );


        if (!touchesModule) {
            continue;
        }


        dot += `

    "${relation.parentTable}"
        ->
    "${relation.childTable}"
    [
        label="${relation.label}"
    ];

`;
    }


    dot += `
}
`;


    return dot;
}


// ============================================================
// DETAILED TABLE
// ============================================================

function generateDetailedTable(

    table: Table,

    relationships: NormalizedRelation[]

) {

    const foreignKeys =
        new Set(

            relationships

                .filter(
                    r =>
                        r.childTable ===
                        table.tableName
                )

                .map(
                    r =>
                        r.childColumn
                )

        );


    let html = `

    "${table.tableName}" [

        label=<

            <TABLE

                BORDER="1"

                CELLBORDER="1"

                CELLSPACING="0"

                CELLPADDING="5"

            >

                <TR>

                    <TD COLSPAN="4">

                        <FONT POINT-SIZE="12">

                            <B>${escapeHTML(
                                table.tableName.toUpperCase()
                            )}</B>

                        </FONT>

                    </TD>

                </TR>


                <TR>

                    <TD><B>Column</B></TD>

                    <TD><B>Type</B></TD>

                    <TD><B>Key</B></TD>

                    <TD><B>Null</B></TD>

                </TR>
`;


    for (
        const column
        of table.columns
    ) {

        const fk =
            foreignKeys.has(
                column.columnName
            );


        let key = "";


        if (
            column.isPrimaryKey &&
            fk
        ) {

            key = "PK/FK";

        }

        else if (
            column.isPrimaryKey
        ) {

            key = "PK";

        }

        else if (fk) {

            key = "FK";

        }

        else if (
            column.isUnique
        ) {

            key = "UQ";

        }


        html += `

                <TR>

                    <TD ALIGN="LEFT">

                        ${escapeHTML(
                            column.columnName
                        )}

                    </TD>

                    <TD ALIGN="LEFT">

                        ${escapeHTML(
                            column.dataType
                        )}

                    </TD>

                    <TD>

                        ${key}

                    </TD>

                    <TD>

                        ${
                            column.isNullable
                                ? "YES"
                                : "NO"
                        }

                    </TD>

                </TR>
`;

    }


    html += `

            </TABLE>

        >

    ];

`;


    return html;
}


// ============================================================
// MODULE DETECTION
// ============================================================

function detectTableModules(

    database: DatabaseDesign,

    requirements: Requirements,

    relationships: NormalizedRelation[]

) {

    const result =
        new Map<string, string[]>();


    const requirementModules =
        requirements.modules ?? [];


    // ========================================================
    // CREATE MODULES
    // ========================================================

    for (
        const module
        of requirementModules
    ) {

        result.set(
            module.name,
            []
        );

    }


    result.set(
        "Supporting / Shared",
        []
    );


    const assigned =
        new Map<string, string>();


    // ========================================================
    // FIRST PASS
    // Match table name against requirement module
    // ========================================================

    for (
        const table
        of database.tables
    ) {

        const tableTokens =
            tokenize(
                table.tableName
            );


        let bestModule:
            string | undefined;


        let bestScore = 0;


        for (
            const module
            of requirementModules
        ) {

            const moduleTokens =
                tokenize(

                    module.name
                    +
                    " "
                    +
                    module.description

                );


            let score = 0;


            for (
                const token
                of tableTokens
            ) {

                if (
                    moduleTokens.has(
                        token
                    )
                ) {

                    score++;

                }

            }


            if (
                score > bestScore
            ) {

                bestScore =
                    score;

                bestModule =
                    module.name;

            }

        }


        if (
            bestModule &&
            bestScore > 0
        ) {

            assigned.set(

                table.tableName,

                bestModule

            );


            result
                .get(bestModule)!
                .push(
                    table.tableName
                );

        }

    }


    // ========================================================
    // SECOND PASS
    // Inherit module from related tables
    // ========================================================

    for (
        let pass = 0;
        pass < 3;
        pass++
    ) {

        for (
            const table
            of database.tables
        ) {

            if (
                assigned.has(
                    table.tableName
                )
            ) {
                continue;
            }


            const votes =
                new Map<string, number>();


            for (
                const relation
                of relationships
            ) {

                let neighbour:
                    string | undefined;


                if (
                    relation.parentTable ===
                    table.tableName
                ) {

                    neighbour =
                        relation.childTable;

                }

                else if (
                    relation.childTable ===
                    table.tableName
                ) {

                    neighbour =
                        relation.parentTable;

                }


                if (!neighbour) {
                    continue;
                }


                const neighbourModule =
                    assigned.get(
                        neighbour
                    );


                if (!neighbourModule) {
                    continue;
                }


                votes.set(

                    neighbourModule,

                    (
                        votes.get(
                            neighbourModule
                        ) ?? 0
                    ) + 1

                );

            }


            let winner:
                string | undefined;


            let winnerVotes = 0;


            for (
                const [module, count]
                of votes.entries()
            ) {

                if (
                    count > winnerVotes
                ) {

                    winner =
                        module;

                    winnerVotes =
                        count;

                }

            }


            if (winner) {

                assigned.set(

                    table.tableName,

                    winner

                );


                result
                    .get(winner)!
                    .push(
                        table.tableName
                    );

            }

        }

    }


    // ========================================================
    // UNASSIGNED
    // ========================================================

    for (
        const table
        of database.tables
    ) {

        if (
            !assigned.has(
                table.tableName
            )
        ) {

            result
                .get(
                    "Supporting / Shared"
                )!
                .push(
                    table.tableName
                );

        }

    }


    // Remove empty modules

    for (
        const [name, tables]
        of [...result.entries()]
    ) {

        if (
            tables.length === 0
        ) {

            result.delete(
                name
            );

        }

    }


    return result;
}


// ============================================================
// RELATIONSHIP NORMALIZATION
// ============================================================

function normalizeRelationship(
    relation: Relationship
): NormalizedRelation {

    const type =
        relation.relationshipType

            .replace(
                /[\s-]+/g,
                "_"
            )

            .toUpperCase();


    if (
        type ===
        "MANY_TO_ONE"
    ) {

        return {

            parentTable:
                relation.toTable,

            parentColumn:
                relation.toColumn,

            childTable:
                relation.fromTable,

            childColumn:
                relation.fromColumn,

            label:
                "1:N"

        };

    }


    if (
        type ===
        "ONE_TO_MANY"
    ) {

        return {

            parentTable:
                relation.fromTable,

            parentColumn:
                relation.fromColumn,

            childTable:
                relation.toTable,

            childColumn:
                relation.toColumn,

            label:
                "1:N"

        };

    }


    if (
        type ===
        "ONE_TO_ONE"
    ) {

        return {

            parentTable:
                relation.toTable,

            parentColumn:
                relation.toColumn,

            childTable:
                relation.fromTable,

            childColumn:
                relation.fromColumn,

            label:
                "1:1"

        };

    }


    return {

        parentTable:
            relation.fromTable,

        parentColumn:
            relation.fromColumn,

        childTable:
            relation.toTable,

        childColumn:
            relation.toColumn,

        label:
            "N:N"

    };
}


// ============================================================
// TOKENIZATION
// ============================================================

function tokenize(
    value: string
) {

    const words =
        value

            .toLowerCase()

            .replace(
                /[^a-z0-9]+/g,
                " "
            )

            .split(
                /\s+/
            )

            .filter(Boolean);


    const tokens =
        new Set<string>();


    for (
        let word
        of words
    ) {

        tokens.add(
            word
        );


        // Simple plural handling

        if (
            word.endsWith(
                "ies"
            )
        ) {

            tokens.add(

                word.slice(
                    0,
                    -3
                ) + "y"

            );

        }


        else if (
            word.endsWith(
                "s"
            ) &&
            word.length > 3
        ) {

            tokens.add(

                word.slice(
                    0,
                    -1
                )

            );

        }

    }


    return tokens;
}


// ============================================================
// SAFE FILE NAME
// ============================================================

function fileSafeName(
    value: string
) {

    return value

        .toLowerCase()

        .replace(
            /[^a-z0-9]+/g,
            "-"
        )

        .replace(
            /^-|-$/g,
            ""
        );
}


// ============================================================
// ESCAPING
// ============================================================

function escapeHTML(
    value: string
) {

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;");
}


function escapeDOT(
    value: string
) {

    return String(value)

        .replace(
            /\\/g,
            "\\\\"
        )

        .replace(
            /"/g,
            '\\"'
        );
}
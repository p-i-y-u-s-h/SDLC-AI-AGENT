import * as ELKModule
    from "elkjs/lib/elk.bundled.js";

import type {
    RelationalRelationship,
    RelationalStorageContract,
    RelationalTable
} from "../types/storage.js";


const ELKConstructor =
    (
        ELKModule as any
    ).default
    ??
    ELKModule;


const elk =
    new ELKConstructor();


const HEADER_HEIGHT =
    42;


const ROW_HEIGHT =
    28;


const MIN_TABLE_WIDTH =
    340;


const MAX_TABLE_WIDTH =
    560;


const PORT_SIZE =
    4;


interface TableVisual {

    table:
        RelationalTable;

    nodeId:
        string;

    width:
        number;

    height:
        number;

    columnIndexes:
        Map<string, number>;

}


interface EdgeMeta {

    relationship:
        RelationalRelationship;

    sourcePortId:
        string;

    targetPortId:
        string;

}


export interface ElkERDiagramResult {

    svg:
        string;

    layout:
        unknown;

}


export async function generateElkERDiagram(
    contract: RelationalStorageContract
): Promise<ElkERDiagramResult> {

    const tableVisuals =
        buildTableVisuals(
            contract.design.tables
        );


    const visualByTable =
        new Map(
            tableVisuals.map(
                visual => [
                    visual.table.name,
                    visual
                ]
            )
        );


    validateRelationships(
        contract.design.relationships,
        visualByTable
    );


    const sourceTotals =
        countRelationshipPorts(
            contract.design.relationships,
            "source"
        );


    const targetTotals =
        countRelationshipPorts(
            contract.design.relationships,
            "target"
        );


    const sourceSeen =
        new Map<string, number>();


    const targetSeen =
        new Map<string, number>();


    const portsByTable =
        new Map<
            string,
            any[]
        >();


    for (
        const visual
        of tableVisuals
    ) {

        portsByTable.set(
            visual.table.name,
            []
        );

    }


    const edgeMeta =
        new Map<
            string,
            EdgeMeta
        >();


    const edges =
        contract.design.relationships.map(
            (
                relationship,
                index
            ) => {

                const edgeId =
                    `edge_${index}`;


                const sourcePortId =
                    `source_${index}`;


                const targetPortId =
                    `target_${index}`;


                const sourceVisual =
                    visualByTable.get(
                        relationship.fromTable
                    )!;


                const targetVisual =
                    visualByTable.get(
                        relationship.toTable
                    )!;


                const sourceKey =
                    relationshipPortKey(
                        relationship.fromTable,
                        relationship.fromColumn
                    );


                const targetKey =
                    relationshipPortKey(
                        relationship.toTable,
                        relationship.toColumn
                    );


                const sourceIndex =
                    sourceSeen.get(
                        sourceKey
                    )
                    ?? 0;


                const targetIndex =
                    targetSeen.get(
                        targetKey
                    )
                    ?? 0;


                sourceSeen.set(
                    sourceKey,
                    sourceIndex + 1
                );


                targetSeen.set(
                    targetKey,
                    targetIndex + 1
                );


                const sourceCount =
                    sourceTotals.get(
                        sourceKey
                    )
                    ?? 1;


                const targetCount =
                    targetTotals.get(
                        targetKey
                    )
                    ?? 1;


                const sourceY =
                    getColumnPortY(
                        sourceVisual,
                        relationship.fromColumn,
                        sourceIndex,
                        sourceCount
                    );


                const targetY =
                    getColumnPortY(
                        targetVisual,
                        relationship.toColumn,
                        targetIndex,
                        targetCount
                    );


                portsByTable
                    .get(
                        relationship.fromTable
                    )!
                    .push({

                        id:
                            sourcePortId,

                        width:
                            PORT_SIZE,

                        height:
                            PORT_SIZE,

                        x:
                            sourceVisual.width
                            -
                            PORT_SIZE / 2,

                        y:
                            sourceY
                            -
                            PORT_SIZE / 2,

                        layoutOptions: {

                            "elk.port.side":
                                "EAST"

                        }

                    });


                portsByTable
                    .get(
                        relationship.toTable
                    )!
                    .push({

                        id:
                            targetPortId,

                        width:
                            PORT_SIZE,

                        height:
                            PORT_SIZE,

                        x:
                            -PORT_SIZE / 2,

                        y:
                            targetY
                            -
                            PORT_SIZE / 2,

                        layoutOptions: {

                            "elk.port.side":
                                "WEST"

                        }

                    });


                edgeMeta.set(
                    edgeId,
                    {

                        relationship,

                        sourcePortId,

                        targetPortId

                    }
                );


                return {

                    id:
                        edgeId,

                    sources: [
                        sourcePortId
                    ],

                    targets: [
                        targetPortId
                    ]

                };

            }
        );


    const children =
        tableVisuals.map(
            visual => ({

                id:
                    visual.nodeId,

                width:
                    visual.width,

                height:
                    visual.height,

                ports:
                    portsByTable.get(
                        visual.table.name
                    ),

                layoutOptions: {

                    "elk.portConstraints":
                        "FIXED_POS"

                }

            })
        );


    const graph =
        {

            id:
                "er-root",

            layoutOptions: {

                "elk.algorithm":
                    "layered",

                "elk.direction":
                    "RIGHT",

                "elk.edgeRouting":
                    "ORTHOGONAL",

                "elk.spacing.nodeNode":
                    "100",

                "elk.spacing.edgeNode":
                    "35",

                "elk.spacing.edgeEdge":
                    "20",

                "elk.layered.spacing.nodeNodeBetweenLayers":
                    "220",

                "elk.layered.spacing.edgeNodeBetweenLayers":
                    "45",

                "elk.layered.spacing.edgeEdgeBetweenLayers":
                    "25",

                "elk.layered.crossingMinimization.strategy":
                    "LAYER_SWEEP",

                "elk.layered.nodePlacement.strategy":
                    "BRANDES_KOEPF",

                "elk.layered.cycleBreaking.strategy":
                    "GREEDY",

                "elk.layered.considerModelOrder.strategy":
                    "NODES_AND_EDGES"

            },

            children,

            edges

        };


    const layout =
        await elk.layout(
            graph as any
        );


    const svg =
        renderSvg(
            contract,
            layout,
            tableVisuals,
            edgeMeta
        );


    return {

        svg,

        layout

    };

}


function buildTableVisuals(
    tables: RelationalTable[]
): TableVisual[] {

    return tables.map(
        table => {

            const columnIndexes =
                new Map<string, number>();


            table.columns.forEach(
                (
                    column,
                    index
                ) => {

                    columnIndexes.set(
                        column.name,
                        index
                    );

                }
            );


            const width =
                calculateTableWidth(
                    table
                );


            const height =
                HEADER_HEIGHT
                +
                table.columns.length
                *
                ROW_HEIGHT;


            return {

                table,

                nodeId:
                    tableNodeId(
                        table.name
                    ),

                width,

                height,

                columnIndexes

            };

        }
    );

}


function calculateTableWidth(
    table: RelationalTable
): number {

    let longest =
        table.name.length
        *
        9
        +
        50;


    for (
        const column
        of table.columns
    ) {

        const markerLength =
            column.primaryKey
                ? 5
                : column.unique
                    ? 5
                    : 0;


        const estimated =
            (
                column.name.length
                +
                column.type.length
                +
                markerLength
            )
            *
            7.2
            +
            100;


        longest =
            Math.max(
                longest,
                estimated
            );

    }


    return Math.min(
        MAX_TABLE_WIDTH,
        Math.max(
            MIN_TABLE_WIDTH,
            Math.ceil(
                longest
            )
        )
    );

}


function validateRelationships(
    relationships:
        RelationalRelationship[],
    visualByTable:
        Map<string, TableVisual>
): void {

    for (
        const relationship
        of relationships
    ) {

        const source =
            visualByTable.get(
                relationship.fromTable
            );


        if (
            !source
        ) {

            throw new Error(
                `ER_UNKNOWN_SOURCE_TABLE:${relationship.fromTable}`
            );

        }


        const target =
            visualByTable.get(
                relationship.toTable
            );


        if (
            !target
        ) {

            throw new Error(
                `ER_UNKNOWN_TARGET_TABLE:${relationship.toTable}`
            );

        }


        if (
            !source.columnIndexes.has(
                relationship.fromColumn
            )
        ) {

            throw new Error(
                `ER_UNKNOWN_SOURCE_COLUMN:${relationship.fromTable}.${relationship.fromColumn}`
            );

        }


        if (
            !target.columnIndexes.has(
                relationship.toColumn
            )
        ) {

            throw new Error(
                `ER_UNKNOWN_TARGET_COLUMN:${relationship.toTable}.${relationship.toColumn}`
            );

        }

    }

}


function countRelationshipPorts(
    relationships:
        RelationalRelationship[],
    side:
        "source"
        |
        "target"
): Map<string, number> {

    const result =
        new Map<string, number>();


    for (
        const relationship
        of relationships
    ) {

        const key =
            side === "source"
                ?
                relationshipPortKey(
                    relationship.fromTable,
                    relationship.fromColumn
                )
                :
                relationshipPortKey(
                    relationship.toTable,
                    relationship.toColumn
                );


        result.set(
            key,
            (
                result.get(
                    key
                )
                ??
                0
            )
            +
            1
        );

    }


    return result;

}


function relationshipPortKey(
    table:
        string,
    column:
        string
): string {

    return `${table}.${column}`;

}


function getColumnPortY(
    visual:
        TableVisual,
    column:
        string,
    position:
        number,
    total:
        number
): number {

    const index =
        visual.columnIndexes.get(
            column
        );


    if (
        index === undefined
    ) {

        throw new Error(
            `ER_UNKNOWN_COLUMN:${visual.table.name}.${column}`
        );

    }


    const rowCenter =
        HEADER_HEIGHT
        +
        index
        *
        ROW_HEIGHT
        +
        ROW_HEIGHT / 2;


    return rowCenter
        +
        distributedPortOffset(
            position,
            total
        );

}


function distributedPortOffset(
    index:
        number,
    total:
        number
): number {

    if (
        total <= 1
    ) {

        return 0;

    }


    const maxSpread =
        14;


    const step =
        Math.min(
            6,
            (
                maxSpread
                *
                2
            )
            /
            (
                total
                -
                1
            )
        );


    return (
        index
        -
        (
            total
            -
            1
        )
        /
        2
    )
    *
    step;

}


function renderSvg(
    contract:
        RelationalStorageContract,
    layout:
        any,
    tableVisuals:
        TableVisual[],
    edgeMeta:
        Map<string, EdgeMeta>
): string {

    const visualByNodeId =
        new Map(
            tableVisuals.map(
                visual => [
                    visual.nodeId,
                    visual
                ]
            )
        );


    const graphWidth =
        Number(
            layout.width
            ??
            0
        );


    const graphHeight =
        Number(
            layout.height
            ??
            0
        );


    const horizontalMargin =
        80;


    const topMargin =
        100;


    const bottomMargin =
        70;


    const width =
        Math.ceil(
            graphWidth
            +
            horizontalMargin
            *
            2
        );


    const height =
        Math.ceil(
            graphHeight
            +
            topMargin
            +
            bottomMargin
        );


    const edgeSvg =
        renderEdges(
            layout.edges
            ??
            [],
            edgeMeta
        );


    const nodeSvg =
        renderNodes(
            layout.children
            ??
            [],
            visualByNodeId
        );


    const title =
        escapeXml(
            `${contract.projectName} — Entity Relationship Diagram`
        );


    const subtitle =
        escapeXml(
            `${contract.engine} • ${contract.design.tables.length} tables • ${contract.design.relationships.length} relationships`
        );


    return `<?xml version="1.0" encoding="UTF-8"?>
<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
>
    <rect
        x="0"
        y="0"
        width="${width}"
        height="${height}"
        fill="#ffffff"
    />

    <text
        x="${horizontalMargin}"
        y="38"
        font-family="Inter, Segoe UI, Arial, sans-serif"
        font-size="24"
        font-weight="700"
        fill="#0f172a"
    >${title}</text>

    <text
        x="${horizontalMargin}"
        y="64"
        font-family="Inter, Segoe UI, Arial, sans-serif"
        font-size="13"
        fill="#64748b"
    >${subtitle}</text>

    <g
        transform="translate(${horizontalMargin}, ${topMargin})"
    >
        ${edgeSvg}

        ${nodeSvg}
    </g>
</svg>`;
}


function renderEdges(
    edges:
        any[],
    edgeMeta:
        Map<string, EdgeMeta>
): string {

    const output:
        string[] =
        [];


    for (
        const edge
        of edges
    ) {

        const meta =
            edgeMeta.get(
                edge.id
            );


        if (
            !meta
        ) {

            continue;

        }


        const sections =
            Array.isArray(
                edge.sections
            )
                ?
                edge.sections
                :
                [];


        for (
            const section
            of sections
        ) {

            const points =
                sectionPoints(
                    section
                );


            if (
                points.length < 2
            ) {

                continue;

            }


            const path =
                pointsToPath(
                    points
                );


            output.push(
                `<path
                    d="${path}"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />`
            );


            output.push(
                `<path
                    d="${path}"
                    fill="none"
                    stroke="#64748b"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />`
            );


            const [
                sourceCardinality,
                targetCardinality
            ] =
                cardinalityMarkers(
                    meta.relationship.type
                );


            const sourceLabelPoint =
                pointToward(
                    points[0],
                    points[1],
                    15
                );


            const targetLabelPoint =
                pointToward(
                    points[
                        points.length
                        -
                        1
                    ],
                    points[
                        points.length
                        -
                        2
                    ],
                    15
                );


            output.push(
                renderCardinalityLabel(
                    sourceLabelPoint.x,
                    sourceLabelPoint.y,
                    sourceCardinality
                )
            );


            output.push(
                renderCardinalityLabel(
                    targetLabelPoint.x,
                    targetLabelPoint.y,
                    targetCardinality
                )
            );

        }

    }


    return output.join(
        "\n"
    );

}


function sectionPoints(
    section:
        any
): Array<{
    x: number;
    y: number;
}> {

    const result:
        Array<{
            x: number;
            y: number;
        }> =
        [];


    if (
        section?.startPoint
    ) {

        result.push(
            section.startPoint
        );

    }


    if (
        Array.isArray(
            section?.bendPoints
        )
    ) {

        result.push(
            ...section.bendPoints
        );

    }


    if (
        section?.endPoint
    ) {

        result.push(
            section.endPoint
        );

    }


    return result;

}


function pointsToPath(
    points:
        Array<{
            x: number;
            y: number;
        }>
): string {

    return points
        .map(
            (
                point,
                index
            ) => {

                const command =
                    index === 0
                        ?
                        "M"
                        :
                        "L";


                return `${command}${round(point.x)} ${round(point.y)}`;

            }
        )
        .join(
            " "
        );

}


function renderCardinalityLabel(
    x:
        number,
    y:
        number,
    value:
        string
): string {

    return `<text
        x="${round(x)}"
        y="${round(y + 4)}"
        text-anchor="middle"
        font-family="Inter, Segoe UI, Arial, sans-serif"
        font-size="11"
        font-weight="700"
        fill="#334155"
        stroke="#ffffff"
        stroke-width="4"
        paint-order="stroke"
    >${value}</text>`;

}


function cardinalityMarkers(
    type:
        RelationalRelationship["type"]
): [
    string,
    string
] {

    switch (
        type
    ) {

        case "one-to-one":

            return [
                "1",
                "1"
            ];


        case "one-to-many":

            return [
                "1",
                "N"
            ];


        case "many-to-one":

            return [
                "N",
                "1"
            ];


        case "many-to-many":

            return [
                "N",
                "N"
            ];

    }

}


function pointToward(
    from:
        {
            x: number;
            y: number;
        },
    to:
        {
            x: number;
            y: number;
        },
    distance:
        number
): {
    x: number;
    y: number;
} {

    const dx =
        to.x
        -
        from.x;


    const dy =
        to.y
        -
        from.y;


    const length =
        Math.sqrt(
            dx * dx
            +
            dy * dy
        );


    if (
        length === 0
    ) {

        return {

            x:
                from.x,

            y:
                from.y

        };

    }


    return {

        x:
            from.x
            +
            dx
            /
            length
            *
            distance,

        y:
            from.y
            +
            dy
            /
            length
            *
            distance

    };

}


function renderNodes(
    nodes:
        any[],
    visualByNodeId:
        Map<string, TableVisual>
): string {

    return nodes
        .map(
            node => {

                const visual =
                    visualByNodeId.get(
                        node.id
                    );


                if (
                    !visual
                ) {

                    return "";

                }


                return renderTableNode(
                    node,
                    visual
                );

            }
        )
        .join(
            "\n"
        );

}


function renderTableNode(
    node:
        any,
    visual:
        TableVisual
): string {

    const table =
        visual.table;


    const foreignKeyColumns =
        new Set<string>();


    if (
        Array.isArray(
            node.ports
        )
    ) {

        for (
            const port
            of node.ports
        ) {

            if (
                typeof port.id
                ===
                "string"
                &&
                port.id.startsWith(
                    "source_"
                )
            ) {

                const y =
                    Number(
                        port.y
                        ??
                        0
                    )
                    +
                    PORT_SIZE / 2;


                const columnIndex =
                    Math.floor(
                        (
                            y
                            -
                            HEADER_HEIGHT
                        )
                        /
                        ROW_HEIGHT
                    );


                const column =
                    table.columns[
                        columnIndex
                    ];


                if (
                    column
                ) {

                    foreignKeyColumns.add(
                        column.name
                    );

                }

            }

        }

    }


    const rows =
        table.columns
            .map(
                (
                    column,
                    index
                ) => {

                    const y =
                        HEADER_HEIGHT
                        +
                        index
                        *
                        ROW_HEIGHT;


                    const flags:
                        string[] =
                        [];


                    if (
                        column.primaryKey
                    ) {

                        flags.push(
                            "PK"
                        );

                    }


                    if (
                        foreignKeyColumns.has(
                            column.name
                        )
                    ) {

                        flags.push(
                            "FK"
                        );

                    }


                    if (
                        column.unique
                        &&
                        !column.primaryKey
                    ) {

                        flags.push(
                            "UQ"
                        );

                    }


                    const marker =
                        flags.length
                            ?
                            `[${flags.join("/")}] `
                            :
                            "";


                    const rowFill =
                        index % 2 === 0
                            ?
                            "#ffffff"
                            :
                            "#f8fafc";


                    return `
                    <rect
                        x="1"
                        y="${y}"
                        width="${visual.width - 2}"
                        height="${ROW_HEIGHT}"
                        fill="${rowFill}"
                    />

                    <line
                        x1="0"
                        y1="${y}"
                        x2="${visual.width}"
                        y2="${y}"
                        stroke="#e2e8f0"
                        stroke-width="1"
                    />

                    <text
                        x="14"
                        y="${y + 18}"
                        font-family="Consolas, Menlo, monospace"
                        font-size="12"
                        fill="#0f172a"
                    >${escapeXml(marker + column.name)}</text>

                    <text
                        x="${visual.width - 14}"
                        y="${y + 18}"
                        text-anchor="end"
                        font-family="Consolas, Menlo, monospace"
                        font-size="11"
                        fill="#64748b"
                    >${escapeXml(column.type)}</text>
                    `;

                }
            )
            .join(
                "\n"
            );


    const ports =
        Array.isArray(
            node.ports
        )
            ?
            node.ports
                .map(
                    (
                        port: any
                    ) => {

                        const cx =
                            Number(
                                port.x
                                ??
                                0
                            )
                            +
                            PORT_SIZE / 2;


                        const cy =
                            Number(
                                port.y
                                ??
                                0
                            )
                            +
                            PORT_SIZE / 2;


                        return `<circle
                            cx="${round(cx)}"
                            cy="${round(cy)}"
                            r="2.5"
                            fill="#475569"
                        />`;

                    }
                )
                .join(
                    "\n"
                )
            :
            "";


    return `
    <g
        transform="translate(${round(node.x ?? 0)}, ${round(node.y ?? 0)})"
    >
        <rect
            x="0"
            y="0"
            width="${visual.width}"
            height="${visual.height}"
            rx="8"
            ry="8"
            fill="#ffffff"
            stroke="#334155"
            stroke-width="1.5"
        />

        <rect
            x="0"
            y="0"
            width="${visual.width}"
            height="${HEADER_HEIGHT}"
            rx="8"
            ry="8"
            fill="#e2e8f0"
        />

        <rect
            x="0"
            y="${HEADER_HEIGHT - 8}"
            width="${visual.width}"
            height="8"
            fill="#e2e8f0"
        />

        <line
            x1="0"
            y1="${HEADER_HEIGHT}"
            x2="${visual.width}"
            y2="${HEADER_HEIGHT}"
            stroke="#94a3b8"
            stroke-width="1"
        />

        <text
            x="14"
            y="27"
            font-family="Inter, Segoe UI, Arial, sans-serif"
            font-size="15"
            font-weight="700"
            fill="#0f172a"
        >${escapeXml(table.name)}</text>

        ${rows}

        ${ports}
    </g>
    `;

}


function tableNodeId(
    tableName:
        string
): string {

    return `table_${tableName}`;

}


function escapeXml(
    value:
        string
): string {

    return value
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&apos;"
        );

}


function round(
    value:
        number
): number {

    return Math.round(
        value
        *
        100
    )
    /
    100;

}
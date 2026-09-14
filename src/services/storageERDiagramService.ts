import fs from "fs";

import {
    readJSON
} from "../utils/fileManager.js";

import {
    storageContractSchema
} from "../schemas/storageContractSchema.js";

import {
    generateElkERDiagram
} from "../utils/elkERGenerator.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";


export async function generateStorageERDiagram(
    workspace: ProjectWorkspace
) {

    const storage =
        storageContractSchema.parse(
            readJSON(
                workspace.storageContract
            )
        );


    if (
        storage.model !== "RELATIONAL"
    ) {

        console.log(
            `ℹ️ ER diagram skipped for storage model ${storage.model}`
        );

        return null;

    }


    const {
        svg,
        layout
    } =
        await generateElkERDiagram(
            storage
        );


    fs.writeFileSync(
        workspace.erDiagram,
        svg,
        "utf-8"
    );


    if (
        workspace.erLayout
    ) {

        fs.writeFileSync(
            workspace.erLayout,
            JSON.stringify(
                layout,
                null,
                2
            ),
            "utf-8"
        );

    }


    console.log(
        `✅ ER Diagram: ${storage.design.tables.length} tables | ${storage.design.relationships.length} relationships`
    );


    return workspace.erDiagram;

}
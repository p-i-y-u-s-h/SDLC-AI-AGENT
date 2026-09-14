import fs from "fs";
import path from "path";

import {
    readJSON
} from "../utils/fileManager.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";

import {
    storageContractSchema
} from "../schemas/storageContractSchema.js";

import {
    backendContractSchema
} from "../schemas/backendContractSchema.js";

import {
    backendExecutionProfileSchema
} from "../schemas/backendExecutionProfileSchema.js";

import {
    resolveStorageImplementationAdapter
} from "../storage/storageImplementationResolver.js";


export interface BackendStorageImplementationResult {
    createdFiles: string[];
    engine: string;
    orm: string;
}


export async function generateBackendStorageImplementation(
    workspace: ProjectWorkspace
): Promise<BackendStorageImplementationResult> {
    const storage = storageContractSchema.parse(readJSON(workspace.storageContract));
    const backend = backendContractSchema.parse(readJSON(workspace.backendContract));
    const profile = backendExecutionProfileSchema.parse(readJSON(workspace.backendExecutionProfile));

    const adapter = resolveStorageImplementationAdapter(storage, backend, profile);
    const result = await adapter.generate(storage, backend, profile);

    const createdFiles: string[] = [];

    for (const file of result.files) {
        const relativePath = file.path.replace(/^[\\/]+/, "");
        const absolutePath = path.join(workspace.backendDir, relativePath);

        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, file.content, "utf-8");

        createdFiles.push(relativePath);
        console.log(`  + ${relativePath}`);
    }

    console.log(`✅ Primary Storage Implemented: ${result.orm} + ${result.engine} (${createdFiles.length} files)`);

    return {
        createdFiles,
        engine: result.engine,
        orm: result.orm
    };
}

import fs from "fs";
import path from "path";
import type { ProjectWorkspace } from "../utils/projectWorkspace.js";


export interface RepositoryFile {
    relativePath: string;
    role: "CONFIG" | "DATABASE" | "MIDDLEWARE" | "MODULE" | "TEST" | "SERVER" | "OTHER";
    exports: string[];
    imports: string[];
}


export interface RepositoryIndex {
    backendRoot: string;
    files: RepositoryFile[];
    existingModules: string[];
    databaseFiles: string[];
    testFiles: string[];
    configFiles: string[];
    scannedAt: string;
}


export function inspectRepository(
    workspace: ProjectWorkspace
): RepositoryIndex {
    const backendRoot = workspace.backendDir;
    const files: RepositoryFile[] = [];
    const existingModules = new Set<string>();
    const databaseFiles: string[] = [];
    const testFiles: string[] = [];
    const configFiles: string[] = [];

    if (fs.existsSync(backendRoot)) {
        scanDirectory(backendRoot, "", (relPath, fullPath) => {
            const ext = path.extname(relPath).toLowerCase();
            if (![".ts", ".js", ".json", ".sql"].includes(ext)) {
                return;
            }

            const normalizedRel = relPath.replace(/\\/g, "/");
            const content = fs.readFileSync(fullPath, "utf-8");

            const exports = extractExports(content);
            const imports = extractImports(content);
            const role = classifyFileRole(normalizedRel);

            files.push({
                relativePath: normalizedRel,
                role,
                exports,
                imports
            });

            if (role === "DATABASE") databaseFiles.push(normalizedRel);
            if (role === "TEST") testFiles.push(normalizedRel);
            if (role === "CONFIG") configFiles.push(normalizedRel);

            // Extract module name from src/modules/<moduleName>/...
            const moduleMatch = normalizedRel.match(/^src\/modules\/([^/]+)/);
            if (moduleMatch && moduleMatch[1]) {
                existingModules.add(moduleMatch[1]);
            }
        });
    }

    return {
        backendRoot,
        files,
        existingModules: Array.from(existingModules),
        databaseFiles,
        testFiles,
        configFiles,
        scannedAt: new Date().toISOString()
    };
}


function scanDirectory(
    baseDir: string,
    currentRel: string,
    callback: (relPath: string, fullPath: string) => void
): void {
    const dir = path.join(baseDir, currentRel);
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (["node_modules", ".git", "dist", ".sdlc-cache"].includes(entry.name)) {
            continue;
        }

        const entryRel = path.join(currentRel, entry.name);
        const fullPath = path.join(baseDir, entryRel);

        if (entry.isDirectory()) {
            scanDirectory(baseDir, entryRel, callback);
        } else if (entry.isFile()) {
            callback(entryRel, fullPath);
        }
    }
}


function classifyFileRole(relPath: string): RepositoryFile["role"] {
    const lower = relPath.toLowerCase();
    if (lower.includes("test") || lower.includes("spec")) return "TEST";
    if (lower.includes("database") || lower.includes("drizzle") || lower.includes("schema")) return "DATABASE";
    if (lower.includes("middleware")) return "MIDDLEWARE";
    if (lower.includes("modules/")) return "MODULE";
    if (lower.includes("config") || lower.endsWith(".json") || lower.includes(".env")) return "CONFIG";
    if (lower.includes("server") || lower.includes("main") || lower.includes("app.")) return "SERVER";
    return "OTHER";
}


function extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:const|function|class|type|interface|enum)\s+([A-Za-z0-9_$]+)/g;
    let match;
    while ((match = exportRegex.exec(content)) !== null) {
        if (match[1]) exports.push(match[1]);
    }
    return exports;
}


function extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+(?:(?:{[^}]+})|(?:[A-Za-z0-9_$*]+))\s+from\s+["']([^"']+)["']/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        if (match[1]) imports.push(match[1]);
    }
    return imports;
}

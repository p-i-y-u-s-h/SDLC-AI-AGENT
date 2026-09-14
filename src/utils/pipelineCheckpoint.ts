import crypto from "crypto";
import fs from "fs";
import path from "path";


export interface StageCheckpoint {
    stageId: string;
    version: string;
    inputFingerprint: string;
    outputArtifacts: string[];
    outputFingerprints: Record<string, string>;
    status: "COMPLETED" | "FAILED";
    completedAt: string;
}


export interface PipelineState {
    version: string;
    lastUpdated: string;
    stages: Record<string, StageCheckpoint>;
}


const PIPELINE_STATE_VERSION = "1.0.0";
const PIPELINE_STATE_FILE = "pipeline-state.json";


// Dependency chain for invalidation
const STAGE_ORDER = [
    "REQUIREMENT_ANALYSIS",
    "ARCHITECTURE",
    "TECHNOLOGY_MANIFEST",
    "STORAGE_DESIGN",
    "ER_DIAGRAM",
    "BACKEND_EXECUTION_PROFILE",
    "BACKEND_CONTRACT",
    "API_CONTRACT",
    "BACKEND_GENERATION_PLAN",
    "BACKEND_SCAFFOLD",
    "STORAGE_IMPLEMENTATION",
    "CACHE_IMPLEMENTATION",
    "REPOSITORY_INTELLIGENCE",
    "BACKEND_MODULE_GENERATION",
    "BACKEND_VALIDATION",
    "FRONTEND_CONTRACT",
    "FRONTEND_GENERATION_PLAN",
    "FRONTEND_SCAFFOLD",
    "FRONTEND_MODULE_GENERATION",
    "FULL_INTEGRATION",
    "DOCKER",
    "CICD",
    "DEPLOYMENT"
];


export function computeFingerprint(data: string | Buffer | Record<string, unknown>): string {
    const hash = crypto.createHash("sha256");
    if (typeof data === "string" || Buffer.isBuffer(data)) {
        hash.update(data);
    } else {
        hash.update(JSON.stringify(data));
    }
    return hash.digest("hex");
}


export function computeFileFingerprint(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        const content = fs.readFileSync(filePath);
        return computeFingerprint(content);
    } catch {
        return null;
    }
}


export function computeFilesFingerprint(filePaths: string[]): string {
    const hash = crypto.createHash("sha256");
    for (const filePath of filePaths) {
        const fp = computeFileFingerprint(filePath);
        hash.update(filePath + ":" + (fp || "missing"));
    }
    return hash.digest("hex");
}


export function getPipelineStatePath(outputDir: string): string {
    return path.join(outputDir, PIPELINE_STATE_FILE);
}


export function loadPipelineState(outputDir: string): PipelineState {
    const statePath = getPipelineStatePath(outputDir);
    if (!fs.existsSync(statePath)) {
        return {
            version: PIPELINE_STATE_VERSION,
            lastUpdated: new Date().toISOString(),
            stages: {}
        };
    }

    try {
        const raw = fs.readFileSync(statePath, "utf-8");
        return JSON.parse(raw);
    } catch {
        return {
            version: PIPELINE_STATE_VERSION,
            lastUpdated: new Date().toISOString(),
            stages: {}
        };
    }
}


export function savePipelineState(outputDir: string, state: PipelineState): void {
    const statePath = getPipelineStatePath(outputDir);
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    state.lastUpdated = new Date().toISOString();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}


export function isStageReusable(
    outputDir: string,
    stageId: string,
    currentInputFingerprint: string
): boolean {
    const state = loadPipelineState(outputDir);
    const checkpoint = state.stages[stageId];

    if (!checkpoint) {
        return false;
    }

    if (checkpoint.status !== "COMPLETED") {
        return false;
    }

    if (checkpoint.inputFingerprint !== currentInputFingerprint) {
        return false;
    }

    // Verify all output artifacts exist and match their fingerprints
    for (const [relativePath, expectedHash] of Object.entries(checkpoint.outputFingerprints)) {
        let fullPath = relativePath;
        if (!fs.existsSync(fullPath)) {
            fullPath = path.isAbsolute(relativePath)
                ? relativePath
                : path.join(outputDir, relativePath);
        }
        if (!fs.existsSync(fullPath)) {
            fullPath = path.resolve(relativePath);
        }

        const currentHash = computeFileFingerprint(fullPath);
        if (!currentHash || currentHash !== expectedHash) {
            return false;
        }
    }

    return true;
}


export function recordStageCheckpoint(
    outputDir: string,
    checkpoint: Omit<StageCheckpoint, "completedAt">
): void {
    const state = loadPipelineState(outputDir);
    state.stages[checkpoint.stageId] = {
        ...checkpoint,
        completedAt: new Date().toISOString()
    };
    savePipelineState(outputDir, state);
}


export function invalidateDownstreamStages(
    outputDir: string,
    fromStageId: string
): void {
    const state = loadPipelineState(outputDir);
    const startIndex = STAGE_ORDER.indexOf(fromStageId);

    if (startIndex === -1) {
        return;
    }

    let modified = false;
    for (let i = startIndex + 1; i < STAGE_ORDER.length; i++) {
        const stageId = STAGE_ORDER[i];
        if (state.stages[stageId]) {
            delete state.stages[stageId];
            modified = true;
        }
    }

    if (modified) {
        savePipelineState(outputDir, state);
    }
}

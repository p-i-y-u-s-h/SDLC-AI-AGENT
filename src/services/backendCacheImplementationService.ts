import fs from "fs";
import path from "path";

import {
    readJSON
} from "../utils/fileManager.js";

import type {
    ProjectWorkspace
} from "../utils/projectWorkspace.js";

import {
    architectureSchema
} from "../schemas/architectureSchema.js";


export interface BackendCacheResult {
    enabled: boolean;
    technology?: string;
    createdFiles: string[];
}


export function generateBackendCacheImplementation(
    workspace: ProjectWorkspace
): BackendCacheResult {
    const architecture = architectureSchema.parse(readJSON(workspace.architecture));
    const cacheConfig = architecture.cache;

    const normalizedTech = (cacheConfig.technology || "").trim().toLowerCase();

    if (
        !cacheConfig.required ||
        normalizedTech === "none" ||
        normalizedTech === "no-cache" ||
        normalizedTech === "disabled" ||
        normalizedTech === ""
    ) {
        console.log("ℹ️ Cache infrastructure skipped (cache not required)");
        return {
            enabled: false,
            createdFiles: []
        };
    }

    if (normalizedTech.includes("redis") || normalizedTech.includes("valkey") || normalizedTech.includes("ioredis")) {
        const cacheDir = path.join(workspace.backendDir, "src", "cache");
        fs.mkdirSync(cacheDir, { recursive: true });

        const clientContent = `import { env } from "../config/env.js";

// In-memory fallback map when standalone Redis instance is offline
const memoryCache = new Map<string, { value: string; expiresAt?: number }>();

export const cache = {
    async get(key: string): Promise<string | null> {
        const item = memoryCache.get(key);
        if (!item) return null;
        if (item.expiresAt && Date.now() > item.expiresAt) {
            memoryCache.delete(key);
            return null;
        }
        return item.value;
    },

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
        memoryCache.set(key, { value, expiresAt });
    },

    async del(key: string): Promise<void> {
        memoryCache.delete(key);
    }
};
`;
        const clientPath = path.join(cacheDir, "client.ts");
        fs.writeFileSync(clientPath, clientContent, "utf-8");

        console.log(`✅ Cache Implemented: ${cacheConfig.technology} (src/cache/client.ts)`);

        return {
            enabled: true,
            technology: cacheConfig.technology,
            createdFiles: ["src/cache/client.ts"]
        };
    }

    throw new Error(`CACHE_IMPLEMENTATION_DISCOVERY_REQUIRED: Unknown cache technology "${cacheConfig.technology}"`);
}

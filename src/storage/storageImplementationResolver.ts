import type { StorageContractSchema } from "../schemas/storageContractSchema.js";
import type { BackendContract } from "../schemas/backendContractSchema.js";
import type { BackendExecutionProfile } from "../schemas/backendExecutionProfileSchema.js";
import { DrizzlePostgresAdapter } from "./adapters/drizzlePostgresAdapter.js";
import type { StorageAdapterResult } from "./adapters/drizzlePostgresAdapter.js";


export interface StorageImplementationAdapter {
    generate(
        storage: StorageContractSchema,
        backend: BackendContract,
        profile: BackendExecutionProfile
    ): Promise<StorageAdapterResult> | StorageAdapterResult;
}


export function resolveStorageImplementationAdapter(
    storage: StorageContractSchema,
    backend: BackendContract,
    profile: BackendExecutionProfile
): StorageImplementationAdapter {
    const orm = (backend.technology.dataAccessTechnology || profile.orm || "").toLowerCase();
    const engine = (storage.engine || profile.databaseEngine || "").toLowerCase();

    // Drizzle + PostgreSQL
    if (orm.includes("drizzle") || (storage.model === "RELATIONAL" && (engine.includes("postgres") || engine.includes("postgresql")))) {
        return new DrizzlePostgresAdapter();
    }

    // Prisma + PostgreSQL / MySQL
    if (orm.includes("prisma")) {
        throw new Error(
            `STORAGE_IMPLEMENTATION_DISCOVERY_REQUIRED: Prisma adapter requested (${engine}). Route to discovery or register Prisma adapter.`
        );
    }

    // If unsupported/unknown
    throw new Error(
        `STORAGE_IMPLEMENTATION_DISCOVERY_REQUIRED: No built-in storage adapter for model=${storage.model}, engine=${storage.engine}, orm=${orm}`
    );
}

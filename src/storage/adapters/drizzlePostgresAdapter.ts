import type { StorageContractSchema } from "../../schemas/storageContractSchema.js";
import type { BackendContract } from "../../schemas/backendContractSchema.js";
import type { BackendExecutionProfile } from "../../schemas/backendExecutionProfileSchema.js";


export interface StorageFile {
    path: string;
    content: string;
}


export interface StorageAdapterResult {
    files: StorageFile[];
    engine: string;
    orm: string;
}


export class DrizzlePostgresAdapter {
    generate(
        storage: StorageContractSchema,
        backend: BackendContract,
        profile: BackendExecutionProfile
    ): StorageAdapterResult {
        if (storage.model !== "RELATIONAL" || !("tables" in storage.design)) {
            throw new Error(`DRIZZLE_ADAPTER_INVALID_STORAGE_MODEL: Expected RELATIONAL storage, received ${storage.model}`);
        }

        const tables = storage.design.tables;
        const relationships = storage.design.relationships || [];

        // Map foreign keys for quick lookup: table.column -> target
        const fkMap = new Map<string, { targetTable: string; targetColumn: string; onDelete?: string }>();
        for (const rel of relationships) {
            if (rel.fromTable && rel.fromColumn && rel.toTable && rel.toColumn) {
                fkMap.set(`${rel.fromTable}.${rel.fromColumn}`, {
                    targetTable: rel.toTable,
                    targetColumn: rel.toColumn,
                    onDelete: rel.onDelete
                });
            }
        }

        const tableDeclarations: string[] = [];
        const importsSet = new Set<string>(["pgTable", "text", "varchar", "integer", "boolean", "timestamp"]);

        for (const table of tables) {
            const columnsCode: string[] = [];

            for (const col of table.columns) {
                let colDef = "";
                const isPk = col.primaryKey;
                const isNullable = col.nullable;
                const fk = fkMap.get(`${table.name}.${col.name}`);

                const lowerType = col.type.toLowerCase();

                if (lowerType.includes("uuid")) {
                    importsSet.add("uuid");
                    colDef = `uuid("${col.name}")`;
                    if (isPk) {
                        colDef += `.defaultRandom().primaryKey()`;
                    }
                } else if (lowerType.includes("bigint")) {
                    importsSet.add("bigint");
                    colDef = `bigint("${col.name}", { mode: "number" })`;
                    if (isPk) colDef += `.primaryKey().generatedAlwaysAsIdentity()`;
                } else if (lowerType.includes("int")) {
                    importsSet.add("integer");
                    colDef = `integer("${col.name}")`;
                    if (isPk) colDef += `.primaryKey().generatedAlwaysAsIdentity()`;
                } else if (lowerType.includes("bool")) {
                    importsSet.add("boolean");
                    colDef = `boolean("${col.name}")`;
                    if (col.defaultValue !== undefined && col.defaultValue !== null) {
                        colDef += `.default(${col.defaultValue})`;
                    }
                } else if (lowerType.includes("time") || lowerType.includes("date")) {
                    importsSet.add("timestamp");
                    colDef = `timestamp("${col.name}")`;
                    if (col.name.toLowerCase().includes("created")) {
                        colDef += `.defaultNow()`;
                    }
                } else if (lowerType.includes("json")) {
                    importsSet.add("jsonb");
                    colDef = `jsonb("${col.name}")`;
                } else if (lowerType.includes("numeric") || lowerType.includes("decimal")) {
                    importsSet.add("numeric");
                    colDef = `numeric("${col.name}")`;
                } else {
                    importsSet.add("text");
                    colDef = `text("${col.name}")`;
                    if (isPk) colDef += `.primaryKey()`;
                }

                if (!isPk && !isNullable) {
                    colDef += `.notNull()`;
                }

                if (col.unique && !isPk) {
                    colDef += `.unique()`;
                }

                // Foreign key constraint
                if (fk) {
                    const onDeleteAction = fk.onDelete ? `, { onDelete: "${fk.onDelete.toLowerCase()}" }` : "";
                    colDef += `.references(() => ${fk.targetTable}Table.${fk.targetColumn}${onDeleteAction})`;
                }

                columnsCode.push(`    ${col.name}: ${colDef}`);
            }

            const tableNameUpper = capitalize(table.name);
            tableDeclarations.push(`
export const ${table.name}Table = pgTable("${table.name}", {
${columnsCode.join(",\n")}
});

export type ${tableNameUpper} = typeof ${table.name}Table.$inferSelect;
export type New${tableNameUpper} = typeof ${table.name}Table.$inferInsert;
`);
        }

        const schemaImports = `import { ${Array.from(importsSet).sort().join(", ")} } from "drizzle-orm/pg-core";\n`;
        const schemaContent = schemaImports + tableDeclarations.join("\n") + "\n";

        const clientContent = `import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

const { Pool } = pg;

export const pool = new Pool({
    connectionString: env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/app_db"
});

export const db = drizzle(pool, { schema });
`;

        return {
            files: [
                {
                    path: "src/database/schema.ts",
                    content: schemaContent
                },
                {
                    path: "src/database/client.ts",
                    content: clientContent
                }
            ],
            engine: storage.engine,
            orm: "Drizzle ORM"
        };
    }
}


function capitalize(str: string): string {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

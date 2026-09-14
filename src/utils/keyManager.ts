import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ChatGoogleGenerativeAI } from "@langchain/google-genai";

class KeyManager {
    private keys: string[] = [];
    private currentIndex = 0;
    private registeredModels: Set<ChatGoogleGenerativeAI> = new Set();
    private exhaustedKeys: Set<string> = new Set();

    constructor() {
        this.discoverKeys();
    }

    /**
     * Discover all Google API keys from process.env and .env file
     */
    public discoverKeys(): void {
        const found = new Set<string>();

        // 1. Current process.env.GOOGLE_API_KEY
        if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim()) {
            found.add(process.env.GOOGLE_API_KEY.trim());
        }

        // 2. Comma-separated GOOGLE_API_KEYS
        if (process.env.GOOGLE_API_KEYS) {
            for (const k of process.env.GOOGLE_API_KEYS.split(",")) {
                const trimmed = k.trim();
                if (trimmed) found.add(trimmed);
            }
        }

        // 3. Scan .env file for all keys (including commented lines)
        try {
            const envPath = path.resolve(process.cwd(), ".env");
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, "utf-8");
                const regex = /(?:#\s*)?GOOGLE_API_KEY\s*=\s*["']?([A-Za-z0-9_.-]+)["']?/g;
                let match: RegExpExecArray | null;
                while ((match = regex.exec(envContent)) !== null) {
                    const key = match[1]?.trim();
                    if (key && (key.startsWith("AQ.") || key.startsWith("AIzaSy"))) {
                        found.add(key);
                    }
                }
            }
        } catch {
            // Ignore file read error
        }

        this.keys = Array.from(found);

        // Put active GOOGLE_API_KEY first if present
        if (process.env.GOOGLE_API_KEY) {
            const active = process.env.GOOGLE_API_KEY.trim();
            const idx = this.keys.indexOf(active);
            if (idx > 0) {
                this.keys.splice(idx, 1);
                this.keys.unshift(active);
            }
        }

        this.currentIndex = 0;
    }

    public getActiveKey(): string {
        if (this.keys.length === 0) {
            return process.env.GOOGLE_API_KEY || "";
        }
        return this.keys[this.currentIndex] || this.keys[0];
    }

    public getKeyPoolSize(): number {
        return this.keys.length;
    }

    public registerModel(model: ChatGoogleGenerativeAI): void {
        this.registeredModels.add(model);
        // Ensure model uses active key if not already set
        const active = this.getActiveKey();
        if (active) {
            model.apiKey = active;
            if ((model as any).client) {
                (model as any).client.apiKey = active;
            }
        }
    }

    /**
     * Rotate to the next available API key in the pool.
     * Returns true if a different key is now active, false if pool is exhausted.
     */
    public rotateApiKey(reason?: string): boolean {
        if (this.keys.length <= 1) {
            return false;
        }

        const currentKey = this.getActiveKey();
        this.exhaustedKeys.add(currentKey);

        // Find next non-exhausted key
        let nextIndex = -1;
        for (let i = 0; i < this.keys.length; i++) {
            const candidate = this.keys[(this.currentIndex + 1 + i) % this.keys.length];
            if (!this.exhaustedKeys.has(candidate)) {
                nextIndex = (this.currentIndex + 1 + i) % this.keys.length;
                break;
            }
        }

        // If all are exhausted, reset exhausted set but advance to cycle again
        if (nextIndex === -1) {
            this.exhaustedKeys.clear();
            this.exhaustedKeys.add(currentKey);
            nextIndex = (this.currentIndex + 1) % this.keys.length;
        }

        if (nextIndex === this.currentIndex) {
            return false;
        }

        this.currentIndex = nextIndex;
        const newKey = this.keys[this.currentIndex];
        process.env.GOOGLE_API_KEY = newKey;

        // Propagate to all registered models
        for (const model of this.registeredModels) {
            try {
                model.apiKey = newKey;
                if ((model as any).client) {
                    (model as any).client.apiKey = newKey;
                }
            } catch {
                // Ignore model update failure
            }
        }

        const masked = newKey.length > 10 ? `...${newKey.slice(-6)}` : newKey;
        console.warn(
            `🔄 [KeyManager] Switched active Google API key to: ${masked} (${this.currentIndex + 1}/${this.keys.length})${reason ? ` [Reason: ${reason}]` : ""}`
        );

        return true;
    }
}

export const keyManager = new KeyManager();

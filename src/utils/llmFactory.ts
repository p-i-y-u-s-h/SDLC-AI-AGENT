import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { keyManager } from "./keyManager.js";

export interface ChatModelOptions extends Partial<ConstructorParameters<typeof ChatGoogleGenerativeAI>[0]> {
    model?: string;
    temperature?: number;
    json?: boolean;
    maxOutputTokens?: number;
}

/**
 * Central factory for creating ChatGoogleGenerativeAI instances.
 * Automatically wires into KeyManager for transparent multi-key pooling and failover.
 */
export function createChatModel(options: ChatModelOptions = {}): ChatGoogleGenerativeAI {
    const activeKey = keyManager.getActiveKey() || process.env.GOOGLE_API_KEY;
    const model = new ChatGoogleGenerativeAI({
        model: process.env.GEMINI_MODEL || "gemini-flash-latest",
        temperature: 0,
        ...options,
        maxRetries: 0,
        apiKey: activeKey
    });

    keyManager.registerModel(model);
    return model;
}

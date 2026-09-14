import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { REPAIR_PROMPT } from "./repairPrompt.js";

import { createChatModel } from "../utils/llmFactory.js";

const model = createChatModel({
    temperature: 0,
    json: true,
    maxOutputTokens: 32768
});

export interface RepairAgentInput {
    messages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
    }>;
}

export const repairAgent = {
    async invoke(input: RepairAgentInput) {
        const response = await model.invoke([
            { role: "system", content: REPAIR_PROMPT },
            ...input.messages
        ]);
        return { messages: [response] };
    }
};

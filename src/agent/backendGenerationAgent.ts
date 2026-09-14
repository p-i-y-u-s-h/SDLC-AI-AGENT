import "dotenv/config";

import {
    ChatGoogleGenerativeAI
} from "@langchain/google-genai";

import {
    BACKEND_GENERATION_PROMPT
} from "./backendGenerationPrompt.js";


import { createChatModel } from "../utils/llmFactory.js";

const model = createChatModel({
    temperature: 0,
    json: true,
    maxOutputTokens: 32768
});


export interface BackendGenerationAgentInput {
    messages: Array<{
        role:
            "user"
            | "assistant"
            | "system";
        content:
            string;
    }>;
}


export const backendGenerationAgent = {
    async invoke(
        input: BackendGenerationAgentInput
    ) {
        const response =
            await model.invoke([
                {
                    role: "system",
                    content: BACKEND_GENERATION_PROMPT
                },
                ...input.messages
            ]);

        return {
            messages: [
                response
            ]
        };
    }
};

import "dotenv/config";

import {
    ChatGoogleGenerativeAI
} from "@langchain/google-genai";

import {
    FRONTEND_GENERATION_PROMPT
} from "./frontendGenerationPrompt.js";


import { createChatModel } from "../utils/llmFactory.js";

const model = createChatModel({
    temperature: 0,
    json: true,
    maxOutputTokens: 32768
});


export interface FrontendGenerationAgentInput {
    messages: Array<{
        role:
            "user"
            | "assistant"
            | "system";
        content:
            string;
    }>;
}


export const frontendGenerationAgent = {
    async invoke(
        input: FrontendGenerationAgentInput
    ) {
        const response =
            await model.invoke([
                {
                    role: "system",
                    content: FRONTEND_GENERATION_PROMPT
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

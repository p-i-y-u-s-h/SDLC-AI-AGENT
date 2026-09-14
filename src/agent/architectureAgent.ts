import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createDeepAgent } from "deepagents";
import { ARCHITECTURE_AGENT_PROMPT } from "./architecturePrompt.js";

import { createChatModel } from "../utils/llmFactory.js";

const model = createChatModel({
    temperature: 0
});


export const architectureAgent =
    createDeepAgent({
        model,
        systemPrompt:
            ARCHITECTURE_AGENT_PROMPT
    });
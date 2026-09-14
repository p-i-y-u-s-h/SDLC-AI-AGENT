import "dotenv/config";

import {
    ChatGoogleGenerativeAI
} from "@langchain/google-genai";

import {
    createDeepAgent
} from "deepagents";

import {
    STORAGE_AGENT_PROMPT
} from "./storagePrompt.js";


import { createChatModel } from "../utils/llmFactory.js";

const model = createChatModel({
    temperature: 0
});


export const storageAgent =
    createDeepAgent({

        model,

        systemPrompt:
            STORAGE_AGENT_PROMPT

    });
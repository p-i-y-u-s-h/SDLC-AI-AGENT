import "dotenv/config";

import {
    ChatGoogleGenerativeAI
} from "@langchain/google-genai";

import {
    createDeepAgent
} from "deepagents";

import {
    STACK_DISCOVERY_PROMPT
} from "./stackDiscoveryPrompt.js";


import { createChatModel } from "../utils/llmFactory.js";

const model = createChatModel({
    temperature: 0
});


export const stackDiscoveryAgent =
    createDeepAgent({

        model,

        systemPrompt:
            STACK_DISCOVERY_PROMPT

    });
import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createDeepAgent } from "deepagents";

import { REQUIREMENT_AGENT_PROMPT } from "./prompts.js";

import { createChatModel } from "../utils/llmFactory.js";

const model = createChatModel({
  temperature: 0
});

export const requirementAgent = createDeepAgent({
  model,
  systemPrompt: REQUIREMENT_AGENT_PROMPT
});



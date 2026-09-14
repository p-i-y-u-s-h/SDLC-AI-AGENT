import "dotenv/config";

import {
    ChatGoogleGenerativeAI
} from "@langchain/google-genai";

import {
    API_CONTRACT_PROMPT
} from "./apiContractPrompt.js";


import { createChatModel } from "../utils/llmFactory.js";

const model = createChatModel({
    temperature: 0,
    json: true,
    maxOutputTokens: 32768
});


type ApiContractAgentInput = {

    messages: Array<{
        role:
            "user"
            |
            "assistant"
            |
            "system";

        content:
            string;
    }>;

};


export const apiContractAgent = {

    async invoke(
        input: ApiContractAgentInput
    ) {

        const response =
            await model.invoke([
                {
                    role: "system",
                    content: API_CONTRACT_PROMPT
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
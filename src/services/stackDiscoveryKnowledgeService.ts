import type {
    BackendExecutionSelection
} from "../stack/backendExecutionProfiles.js";


export interface StackDiscoveryKnowledgeChunk {

    source:
        string;

    content:
        string;

}


export type StackDiscoveryKnowledgeProvider =
    (
        selection:
            BackendExecutionSelection
    ) => Promise<
        StackDiscoveryKnowledgeChunk[]
    >;


let provider:
    StackDiscoveryKnowledgeProvider
    |
    null =
    null;


export function configureStackDiscoveryKnowledgeProvider(
    value:
        StackDiscoveryKnowledgeProvider
): void {

    provider =
        value;

}


export async function retrieveStackDiscoveryKnowledge(
    selection:
        BackendExecutionSelection
): Promise<
    StackDiscoveryKnowledgeChunk[]
> {

    if (
        !provider
    ) {

        return [];

    }


    const chunks =
        await provider(
            selection
        );


    return chunks
        .filter(
            chunk =>
                Boolean(
                    chunk.source.trim()
                )
                &&
                Boolean(
                    chunk.content.trim()
                )
        )
        .slice(
            0,
            8
        )
        .map(
            chunk => ({

                source:
                    chunk.source.trim(),

                content:
                    chunk.content
                        .trim()
                        .slice(
                            0,
                            8000
                        )

            })
        );

}
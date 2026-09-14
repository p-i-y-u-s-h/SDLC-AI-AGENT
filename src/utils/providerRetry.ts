export interface ProviderRetryOptions {
    operationName?: string;
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
}


export function isHardQuotaError(error: unknown): boolean {
    const message = getErrorMessage(error).toLowerCase();

    // Permanent daily limit / project quota markers:
    if (
        message.includes("daily quota exceeded") ||
        message.includes("daily limit") ||
        message.includes("generaterequestsperdayperprojectpermodel") ||
        message.includes("generate_content_free_tier_requests") ||
        (message.includes("billing details") && message.includes("per day"))
    ) {
        return true;
    }

    const suggestedDelay = extractSuggestedDelayMs(error);
    // If the provider returned a specific retry delay under 3 minutes (e.g. 13s, 52s),
    // it is a rolling rate limit / burst window, NOT a permanent daily quota exhaustion.
    if (suggestedDelay !== null && suggestedDelay <= 180000) {
        return false;
    }

    return (
        message.includes("quota exceeded") ||
        message.includes("exceeded your current quota")
    );
}


export function isTransientProviderError(error: unknown): boolean {
    if (isHardQuotaError(error)) {
        return false;
    }

    const message = getErrorMessage(error).toLowerCase();

    return (
        message.includes("503") ||
        message.includes("service unavailable") ||
        message.includes("high demand") ||
        message.includes("temporarily unavailable") ||
        message.includes("temporary overload") ||
        message.includes("overloaded") ||
        message.includes("502") ||
        message.includes("bad gateway") ||
        message.includes("504") ||
        message.includes("gateway timeout") ||
        message.includes("429") ||
        message.includes("resource exhausted") ||
        message.includes("rate limit") ||
        message.includes("too many requests") ||
        message.includes("timeout") ||
        message.includes("timed out") ||
        message.includes("etimedout") ||
        message.includes("econnreset") ||
        message.includes("fetch failed") ||
        message.includes("network error") ||
        message.includes("socket hang up")
    );
}


import { keyManager } from "./keyManager.js";

export async function withProviderRetry<T>(
    operation: () => Promise<T>,
    options: ProviderRetryOptions = {}
): Promise<T> {
    const operationName = options.operationName || "LLM Operation";
    const maxAttempts = options.maxAttempts ?? 5;
    const initialDelayMs = options.initialDelayMs ?? 3000;
    const maxDelayMs = options.maxDelayMs ?? 45000;

    let attempt = 1;

    while (attempt <= maxAttempts) {
        try {
            return await operation();
        } catch (error) {
            if (isHardQuotaError(error)) {
                const rotated = keyManager.rotateApiKey("Daily quota exceeded on active key");
                if (rotated) {
                    console.warn(`🔄 Automatically retrying ${operationName} with next Google API key...`);
                    await sleep(1000);
                    continue;
                }
                console.error(`\n❌ PROVIDER_QUOTA_EXHAUSTED: ${operationName} exceeded daily/hard quota across all keys.`);
                throw new Error(
                    `PROVIDER_QUOTA_EXHAUSTED: ${operationName} failed due to provider daily quota limit. ${getErrorMessage(error)}`
                );
            }

            const transient = isTransientProviderError(error);

            if (!transient || attempt >= maxAttempts) {
                // Before giving up completely, try rotating key once more
                if (transient && keyManager.rotateApiKey("Exhausted max retry attempts on transient error")) {
                    console.warn(`🔄 Switched to fresh key to bypass rate limit. Retrying ${operationName}...`);
                    await sleep(1000);
                    attempt = 1;
                    continue;
                }
                throw error;
            }

            // Proactively rotate on rate-limit errors (429 or resource exhausted)
            const msg = getErrorMessage(error).toLowerCase();
            if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("resource exhausted")) {
                const rotated = keyManager.rotateApiKey("Proactive rotation to bypass rate limit window");
                if (rotated) {
                    await sleep(1500);
                    attempt++;
                    continue;
                }
            }

            // Extract retryDelay from error if Google provided it, e.g. "retry in 22s"
            const suggestedDelay = extractSuggestedDelayMs(error);
            const backoffDelay = Math.min(
                initialDelayMs * Math.pow(2, attempt - 1),
                maxDelayMs
            );
            const delay = Math.max(suggestedDelay || 0, backoffDelay);

            console.warn(
                `⚠️ ${operationName} temporarily unavailable (attempt ${attempt}/${maxAttempts}). Retrying in ${Math.round(delay / 1000)}s...`
            );

            await sleep(delay);
            attempt++;
        }
    }

    throw new Error(`${operationName} retry loop exhausted after ${maxAttempts} attempts`);
}


function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error || "");
}


export function extractSuggestedDelayMs(error: unknown): number | null {
    const message = getErrorMessage(error);
    const matchSeconds = message.match(/retry\s+in\s+([\d.]+)\s*s/i) || message.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
    if (matchSeconds && matchSeconds[1]) {
        const seconds = parseFloat(matchSeconds[1]);
        if (!isNaN(seconds) && seconds > 0) {
            return Math.ceil(seconds * 1000) + 1500; // Extra buffer
        }
    }
    const matchHeader = message.match(/retry-after:\s*([\d.]+)/i);
    if (matchHeader && matchHeader[1]) {
        const seconds = parseFloat(matchHeader[1]);
        if (!isNaN(seconds) && seconds > 0) {
            return Math.ceil(seconds * 1000) + 1500;
        }
    }
    return null;
}


function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

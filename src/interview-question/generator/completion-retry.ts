import type { GenerateForAnswerInput } from "@/interview-question/generator/generator-types";
import { requestCompletion } from "@/interview-question/generator/completion-clients";
import { sleep } from "@/interview-question/generator/generator-common";

const MAX_RETRY_ATTEMPTS = 4;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 8000;

function getErrorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function getRetryAfterMs(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const headers = (error as { headers?: unknown }).headers;

  if (!headers || typeof headers !== "object") return null;

  if (typeof (headers as { get?: unknown }).get === "function") {
    const retryAfter = (headers as { get: (name: string) => string | null }).get("retry-after");
    if (!retryAfter) return null;
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
    return null;
  }

  const retryAfterValue = (headers as Record<string, unknown>)["retry-after"];
  if (typeof retryAfterValue === "string") {
    const seconds = Number(retryAfterValue);
    if (Number.isFinite(seconds) && seconds > 0) return Math.round(seconds * 1000);
  }

  return null;
}

function computeBackoffDelayMs(attempt: number, error: unknown): number {
  const retryAfter = getRetryAfterMs(error);
  if (retryAfter && retryAfter > 0) return retryAfter;

  const exponential = Math.min(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
  const jitter = Math.floor(Math.random() * 400);
  return exponential + jitter;
}

function isRetryableStatus(status: number | null): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function requestCompletionWithRetry(input: GenerateForAnswerInput, prompt: string): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    const attemptStartedAt = Date.now();
    try {
      const content = await requestCompletion(input, prompt);
      console.info("[llm] completion success", {
        applicationId: input.application.applicationId,
        answerId: input.answer.answerId,
        provider: input.runtime.provider,
        attempt,
        elapsedMs: Date.now() - attemptStartedAt,
      });
      return content;
    } catch (error) {
      lastError = error;
      const status = getErrorStatus(error);
      console.warn("[llm] completion failed", {
        applicationId: input.application.applicationId,
        answerId: input.answer.answerId,
        provider: input.runtime.provider,
        attempt,
        status,
        elapsedMs: Date.now() - attemptStartedAt,
        error: error instanceof Error ? error.message : error,
      });

      if (!isRetryableStatus(status) || attempt === MAX_RETRY_ATTEMPTS) {
        break;
      }

      const delayMs = computeBackoffDelayMs(attempt, error);
      console.info("[llm] retry scheduled", {
        applicationId: input.application.applicationId,
        answerId: input.answer.answerId,
        provider: input.runtime.provider,
        attempt,
        delayMs,
      });
      await sleep(delayMs);
    }
  }

  const status = getErrorStatus(lastError);
  if (status === 429) {
    throw new Error("LLM rate limit reached (429). Please retry shortly.");
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to call local LLM.");
}

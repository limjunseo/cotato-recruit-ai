import type { ApplicationAnswer, ApplicationDetail } from "@/types/application";
import type { LlmRuntimeConfig } from "@/llm/types";
import {
  INTERVIEW_QUESTION_SYSTEM_PROMPT,
  buildInterviewQuestionRepairPrompt,
  buildInterviewQuestionUserPrompt,
} from "@/llm/interview-question-prompts";
import { parseInterviewGeneration } from "@/llm/parser";

type GenerateForAnswerInput = {
  application: ApplicationDetail;
  answer: ApplicationAnswer;
  questionCount: number;
  runtime: LlmRuntimeConfig;
};

type GeneratedForAnswer = {
  evaluationSummary: string;
  questions: string[];
};

const MAX_RETRY_ATTEMPTS = 4;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 8000;
const MAX_OUTPUT_VALIDATION_ATTEMPTS = 2;
const OUTPUT_RETRY_DELAY_MS = 250;
const SHORT_ANSWER_LENGTH_THRESHOLD = 35;

const FALLBACK_SHORT_ANSWER_QUESTIONS = [
  "당시 해결하려던 문제 상황과 목표를 한 문장으로 설명해 주세요.",
  "실제로 시도한 방법 중 최종 선택한 방법과 그 근거는 무엇이었나요?",
  "적용 후 결과를 확인한 기준(지표, 사용자 반응, 운영 안정성 등)은 무엇이었나요?",
  "같은 문제가 다시 발생한다면 어떤 방식으로 설계를 바꾸거나 예방하시겠어요?",
  "협업 과정에서 이 문제를 공유하고 조율한 방식이 있었다면 구체적으로 알려주세요.",
] as const;

class LlmHttpError extends Error {
  status: number;
  headers: Headers;

  constructor(message: string, status: number, headers: Headers) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function normalizeMessageContent(content: unknown): string {
  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const text = (part as { text?: unknown })?.text;
        return typeof text === "string" ? text : "";
      })
      .join("")
      .trim();
  }

  return "";
}

function extractGeminiText(payload: unknown): string {
  const candidates = (payload as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("Gemini returned no candidates.");
  }

  const first = candidates[0] as {
    content?: { parts?: Array<{ text?: unknown }> };
  };
  const parts = first.content?.parts;
  if (!Array.isArray(parts)) {
    throw new Error("Gemini returned no content parts.");
  }

  const text = parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned empty content.");
  }

  return text;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown error");
}

function isResponseFormatUnsupportedError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  return message.includes("response_format") || message.includes("json_object") || message.includes("unsupported");
}

function normalizeFreeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isPlaceholderText(value: string): boolean {
  const normalized = normalizeFreeText(value);
  if (!normalized) return true;
  if (/^[\s`"'{}[\],:]+$/.test(normalized)) return true;
  return /^["']?\s*(evaluationsummary|summary|questions)\s*["']?\s*:/i.test(normalized);
}

function validateGeneratedOutput(output: GeneratedForAnswer, questionCount: number): { valid: true } | { valid: false; reason: string } {
  const summary = normalizeFreeText(output.evaluationSummary);
  if (isPlaceholderText(summary) || summary.length < 20) {
    return { valid: false, reason: "evaluationSummary가 비어 있거나 너무 짧습니다." };
  }

  const normalizedRequestedCount = Math.max(1, Math.min(questionCount, 3));
  if (output.questions.length < 1 || output.questions.length > normalizedRequestedCount) {
    return { valid: false, reason: `questions 개수는 1~${normalizedRequestedCount}개여야 합니다.` };
  }

  const uniqueQuestions = new Set<string>();
  for (const question of output.questions) {
    const normalizedQuestion = normalizeFreeText(question);
    if (isPlaceholderText(normalizedQuestion) || normalizedQuestion.length < 6) {
      return { valid: false, reason: "유효하지 않은 질문 항목이 포함되어 있습니다." };
    }

    const dedupeKey = normalizedQuestion.toLowerCase();
    if (uniqueQuestions.has(dedupeKey)) {
      return { valid: false, reason: "중복 질문이 포함되어 있습니다." };
    }
    uniqueQuestions.add(dedupeKey);
  }

  return { valid: true };
}

function isShortAnswerContent(content: string): boolean {
  return normalizeFreeText(content).length < SHORT_ANSWER_LENGTH_THRESHOLD;
}

function buildShortAnswerFallback(questionCount: number): GeneratedForAnswer {
  return {
    evaluationSummary:
      "답변 분량이 짧아 문제 상황·선택 근거·실행 결과 확인이 어려움.",
    questions: FALLBACK_SHORT_ANSWER_QUESTIONS.slice(0, questionCount),
  };
}

async function requestLocalCompletion(input: GenerateForAnswerInput, prompt: string): Promise<string> {
  if (input.runtime.provider !== "local") {
    throw new Error("Invalid runtime provider for local completion.");
  }

  const baseRequest = {
    model: input.runtime.model,
    messages: [
      {
        role: "system" as const,
        content: INTERVIEW_QUESTION_SYSTEM_PROMPT,
      },
      { role: "user" as const, content: prompt },
    ],
    temperature: 0.2,
  };

  let response;
  try {
    response = await input.runtime.client.chat.completions.create({
      ...baseRequest,
      response_format: { type: "json_object" },
    });
  } catch (error) {
    if (!isResponseFormatUnsupportedError(error)) {
      throw error;
    }

    response = await input.runtime.client.chat.completions.create(baseRequest);
  }

  const content = normalizeMessageContent(response.choices[0]?.message?.content ?? "");
  if (!content) {
    throw new Error("Local LLM returned empty content.");
  }

  return content;
}

async function requestGeminiCompletion(input: GenerateForAnswerInput, prompt: string): Promise<string> {
  if (input.runtime.provider !== "gemini") {
    throw new Error("Invalid runtime provider for Gemini completion.");
  }

  const url = `${input.runtime.endpoint}/models/${encodeURIComponent(input.runtime.model)}:generateContent?key=${encodeURIComponent(input.runtime.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: INTERVIEW_QUESTION_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new LlmHttpError(`Gemini API ${response.status}: ${errorText || "Unknown error"}`, response.status, response.headers);
  }

  const payload = (await response.json()) as unknown;
  return extractGeminiText(payload);
}

async function requestCompletion(input: GenerateForAnswerInput, prompt: string): Promise<string> {
  if (input.runtime.provider === "gemini") {
    return requestGeminiCompletion(input, prompt);
  }

  return requestLocalCompletion(input, prompt);
}

async function requestCompletionWithRetry(input: GenerateForAnswerInput, prompt: string): Promise<string> {
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

export async function generateQuestionsForAnswer(input: GenerateForAnswerInput): Promise<GeneratedForAnswer> {
  const basePrompt = buildInterviewQuestionUserPrompt(input.application, input.answer, input.questionCount);
  let prompt = basePrompt;

  let lastError: Error | null = null;
  let lastRawOutput = "";

  for (let attempt = 1; attempt <= MAX_OUTPUT_VALIDATION_ATTEMPTS; attempt += 1) {
    const content = await requestCompletionWithRetry(input, prompt);
    lastRawOutput = content;

    try {
      const parsed = parseInterviewGeneration(content, input.questionCount);
      const validation = validateGeneratedOutput(parsed, input.questionCount);

      if (validation.valid) {
        return {
          evaluationSummary: parsed.evaluationSummary,
          questions: parsed.questions,
        };
      }

      lastError = new Error(validation.reason);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Failed to parse LLM response.");
    }

    console.warn("[llm] output validation failed", {
      applicationId: input.application.applicationId,
      answerId: input.answer.answerId,
      attempt,
      reason: lastError?.message,
    });

    if (attempt < MAX_OUTPUT_VALIDATION_ATTEMPTS) {
      prompt = buildInterviewQuestionRepairPrompt(input.questionCount, content, lastError?.message ?? "형식 오류");
      await sleep(OUTPUT_RETRY_DELAY_MS);
    }
  }

  if (isShortAnswerContent(input.answer.content)) {
    console.warn("[llm] short-answer fallback applied", {
      applicationId: input.application.applicationId,
      answerId: input.answer.answerId,
      answerLength: normalizeFreeText(input.answer.content).length,
    });
    return buildShortAnswerFallback(input.questionCount);
  }

  throw new Error(
    `AI returned invalid interview output. ${lastError?.message ?? "Unknown format error."} Raw: ${lastRawOutput.slice(0, 240)}`,
  );
}

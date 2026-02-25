import { buildInterviewQuestionRepairPrompt, buildInterviewQuestionUserPrompt } from "@/interview-question/interview-question-prompts";
import { parseInterviewGeneration } from "@/interview-question/parser";
import { normalizeFreeText, sleep } from "@/interview-question/generator/generator-common";
import { requestCompletionWithRetry } from "@/interview-question/generator/completion-retry";
import { buildShortAnswerFallback, isShortAnswerContent, validateGeneratedOutput } from "@/interview-question/generator/output-validation";
import type { GenerateForAnswerInput, GeneratedForAnswer } from "@/interview-question/generator/generator-types";

const MAX_OUTPUT_VALIDATION_ATTEMPTS = 2;
const OUTPUT_RETRY_DELAY_MS = 250;

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
      prompt = buildInterviewQuestionRepairPrompt(
        input.application,
        input.answer,
        input.questionCount,
        content,
        lastError?.message ?? "\uD615\uC2DD \uC624\uB958",
      );
      await sleep(OUTPUT_RETRY_DELAY_MS);
    }
  }

  if (isShortAnswerContent(input.answer.content)) {
    console.warn("[llm] short-answer fallback applied", {
      applicationId: input.application.applicationId,
      answerId: input.answer.answerId,
      answerLength: normalizeFreeText(input.answer.content).length,
    });
    return buildShortAnswerFallback();
  }

  throw new Error(
    `AI returned invalid interview output. ${lastError?.message ?? "Unknown format error."} Raw: ${lastRawOutput.slice(0, 240)}`,
  );
}

import type { ApplicationDetail, GeneratedAnswerQuestions } from "@/types/application";
import type { GenerateInterviewQuestionsOptions } from "@/llm/types";
import { createLlmRuntimeConfig } from "@/llm/client";
import { generateQuestionsForAnswer } from "@/llm/interview-question-generator";

const REQUEST_SPACING_MS = 350;
const DEFAULT_QUESTION_COUNT = 3;
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 3;

export const INTERVIEW_GENERATION_ERRORS = {
  REQUESTED_ANSWER_NOT_FOUND: "The requested answer does not exist for this application.",
  REQUESTED_ANSWER_EMPTY: "The requested answer is empty.",
  NO_NON_EMPTY_ANSWERS: "No non-empty answers found for this application.",
} as const;

function normalizeQuestionCount(questionCount: number | undefined) {
  if (!Number.isFinite(questionCount)) return DEFAULT_QUESTION_COUNT;
  const normalized = Math.trunc(questionCount as number);
  return Math.max(MIN_QUESTION_COUNT, Math.min(normalized, MAX_QUESTION_COUNT));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateInterviewQuestionsByAnswer(
  application: ApplicationDetail,
  options?: GenerateInterviewQuestionsOptions,
): Promise<GeneratedAnswerQuestions[]> {
  const startedAt = Date.now();
  const runtime = createLlmRuntimeConfig();

  const questionCount = normalizeQuestionCount(options?.questionCount);
  let selectedAnswers = application.answers.filter((answer) => answer.content.trim().length > 0);

  if (options?.answerId) {
    const matchedAnswer = application.answers.find((answer) => answer.answerId === options.answerId);
    if (!matchedAnswer) {
      throw new Error(INTERVIEW_GENERATION_ERRORS.REQUESTED_ANSWER_NOT_FOUND);
    }
    if (matchedAnswer.content.trim().length === 0) {
      throw new Error(INTERVIEW_GENERATION_ERRORS.REQUESTED_ANSWER_EMPTY);
    }
    selectedAnswers = [matchedAnswer];
  }

  if (selectedAnswers.length === 0) {
    throw new Error(INTERVIEW_GENERATION_ERRORS.NO_NON_EMPTY_ANSWERS);
  }

  const results: GeneratedAnswerQuestions[] = [];
  for (const [index, answer] of selectedAnswers.entries()) {
    const answerStartedAt = Date.now();
    console.info("[llm] answer generation started", {
      applicationId: application.applicationId,
      answerId: answer.answerId,
      index: index + 1,
      total: selectedAnswers.length,
    });
    const generated = await generateQuestionsForAnswer({
      application,
      answer,
      questionCount,
      runtime,
    });

    results.push({
      answerId: answer.answerId,
      questionId: answer.questionId,
      answerContent: answer.content,
      evaluationSummary: generated.evaluationSummary,
      questions: generated.questions,
      source: "ai",
    });
    console.info("[llm] answer generation completed", {
      applicationId: application.applicationId,
      answerId: answer.answerId,
      questionCount: generated.questions.length,
      elapsedMs: Date.now() - answerStartedAt,
    });

    if (index < selectedAnswers.length - 1) {
      await sleep(REQUEST_SPACING_MS);
    }
  }

  console.info("[llm] application generation completed", {
    applicationId: application.applicationId,
    answersProcessed: results.length,
    elapsedMs: Date.now() - startedAt,
  });
  return results;
}

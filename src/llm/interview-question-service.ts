import type { ApplicationDetail, GeneratedAnswerQuestions } from "@/types/application";
import type { GenerateInterviewQuestionsOptions } from "@/llm/types";
import { createLlmRuntimeConfig } from "@/llm/client";
import { generateQuestionsForAnswer } from "@/llm/interview-question-generator";

const REQUEST_SPACING_MS = 350;

function normalizeQuestionCount(questionCount: number | undefined) {
  const candidate = questionCount ?? 3;
  return Math.max(1, Math.min(candidate, 3));
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
  const answers = application.answers.filter((answer) => answer.content.trim().length > 0);
  const selectedAnswers = options?.answerId
    ? answers.filter((answer) => answer.answerId === options.answerId)
    : answers;

  if (options?.answerId && selectedAnswers.length === 0) {
    throw new Error("The requested answer does not exist for this application.");
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

    if (generated.questions.length === 0) {
      throw new Error(`AI returned no valid questions for answer_id=${answer.answerId}.`);
    }

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

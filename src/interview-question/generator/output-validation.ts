import type { GeneratedForAnswer } from "@/interview-question/generator/generator-types";
import { normalizeFreeText } from "@/interview-question/generator/generator-common";

const SHORT_ANSWER_LENGTH_THRESHOLD = 35;

function isPlaceholderText(value: string): boolean {
  const normalized = normalizeFreeText(value);
  if (!normalized) return true;
  if (/^[\s`"'{}[\],:]+$/.test(normalized)) return true;
  return /^["']?\s*(evaluationsummary|summary|questions)\s*["']?\s*:/i.test(normalized);
}

export function validateGeneratedOutput(
  output: GeneratedForAnswer,
  questionCount: number,
): { valid: true } | { valid: false; reason: string } {
  const summary = normalizeFreeText(output.evaluationSummary);
  if (isPlaceholderText(summary) || summary.length < 20) {
    return { valid: false, reason: "evaluationSummary\uAC00 \uBE44\uC5B4 \uC788\uAC70\uB098 \uB108\uBB34 \uC9E7\uC2B5\uB2C8\uB2E4." };
  }

  const normalizedRequestedCount = Math.max(1, Math.min(questionCount, 3));
  if (output.questions.length > normalizedRequestedCount) {
    return { valid: false, reason: `questions \uAC1C\uC218\uB294 0~${normalizedRequestedCount}\uAC1C\uC5EC\uC57C \uD569\uB2C8\uB2E4.` };
  }

  const uniqueQuestions = new Set<string>();
  for (const question of output.questions) {
    const normalizedQuestion = normalizeFreeText(question);
    if (isPlaceholderText(normalizedQuestion) || normalizedQuestion.length < 6) {
      return { valid: false, reason: "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC9C8\uBB38 \uD56D\uBAA9\uC774 \uD3EC\uD568\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4." };
    }

    const dedupeKey = normalizedQuestion.toLowerCase();
    if (uniqueQuestions.has(dedupeKey)) {
      return { valid: false, reason: "\uC911\uBCF5 \uC9C8\uBB38\uC774 \uD3EC\uD568\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4." };
    }
    uniqueQuestions.add(dedupeKey);
  }

  return { valid: true };
}

export function isShortAnswerContent(content: string): boolean {
  return normalizeFreeText(content).length < SHORT_ANSWER_LENGTH_THRESHOLD;
}

export function buildShortAnswerFallback(): GeneratedForAnswer {
  return {
    evaluationSummary:
      "\uB2F5\uBCC0 \uBD84\uB7C9\uC774 \uC9E7\uC544 \uBB38\uC81C \uC0C1\uD669\u00B7\uC120\uD0DD \uADFC\uAC70\u00B7\uC2E4\uD589 \uACB0\uACFC \uD655\uC778\uC774 \uC5B4\uB824\uC6C0.",
    questions: [],
  };
}

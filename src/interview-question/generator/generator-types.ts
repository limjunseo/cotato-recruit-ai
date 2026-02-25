import type { ApplicationAnswer, ApplicationDetail } from "@/types/application";
import type { LlmRuntimeConfig } from "@/interview-question/types";

export type GenerateForAnswerInput = {
  application: ApplicationDetail;
  answer: ApplicationAnswer;
  questionCount: number;
  runtime: LlmRuntimeConfig;
};

export type GeneratedForAnswer = {
  evaluationSummary: string;
  questions: string[];
};

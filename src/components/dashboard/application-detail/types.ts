import type { GeneratedAnswerQuestions } from "@/types/application";

export type QuestionsResponse = {
  results: GeneratedAnswerQuestions[];
};

export type NotionSendResponse = {
  pageId: string;
  pageUrl: string;
  results: GeneratedAnswerQuestions[];
};

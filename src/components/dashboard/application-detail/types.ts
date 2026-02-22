import type { GeneratedAnswerQuestions } from "@/types/application";

export type QuestionsResponse = {
  results: GeneratedAnswerQuestions[];
};

export type NotionSendResponse = {
  pageId: string;
  pageUrl: string;
  results: GeneratedAnswerQuestions[];
};

export type InterviewAvailabilityNormalizeResponse = {
  applicationId: string;
  input: string;
  output: string | null;
  status: "PENDING" | "SUCCESS" | "FAILED";
  syncedAt: string | null;
  lastError: string | null;
  skipped: boolean;
};

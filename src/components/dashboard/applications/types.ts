import type { ApplicationListItem } from "@/types/application";

export type NotionSendResponse = {
  pageId?: string;
  pageUrl?: string;
  skipped?: boolean;
};

export type NotionSyncStatsResponse = {
  totalApplicants: number;
  notionSyncedApplicants: number;
};

export type SelectedApplication = {
  applicationId: string;
  name: string;
};

export type SelectedApplicationMap = Record<string, SelectedApplication>;

export type BatchItemResult = {
  applicationId: string;
  name: string;
  status: "success" | "failed" | "skipped";
  message?: string;
  pageUrl?: string;
  elapsedMs?: number;
};

export type BatchProgress = {
  isRunning: boolean;
  total: number;
  processed: number;
  success: number;
  skipped: number;
  failed: number;
  currentName: string | null;
  batchStartedAt: number | null;
  currentItemStartedAt: number | null;
  batchElapsedMs: number;
  results: BatchItemResult[];
};

export type ApplicationsDataState = {
  items: ApplicationListItem[];
  total: number;
  isLoading: boolean;
  error: string | null;
};

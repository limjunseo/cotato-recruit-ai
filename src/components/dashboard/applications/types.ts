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

export type RdsSyncSummaryGroup = {
  count: number;
  ids: string[];
};

export type RdsSyncSummary = {
  applications: RdsSyncSummaryGroup;
  questions: RdsSyncSummaryGroup;
  answers: RdsSyncSummaryGroup;
};

export type NotionAutoSyncSummary = {
  attempted: number;
  success: number;
  skipped: number;
  failed: number;
};

export type RdsSyncResponse = {
  message: string;
  trigger: "manual" | "cron" | string;
  runId?: string | null;
  requestedAt?: string;
  startedAt: string;
  completedAt?: string;
  failedAt?: string;
  durationMs: number;
  syncSummary?: RdsSyncSummary;
  notionSyncSummary?: NotionAutoSyncSummary;
  stdoutTail?: string[];
  stderrTail?: string[];
};

export type RdsSyncLogItem = {
  runId: string;
  trigger: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | string;
  requestedAt: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  message: string | null;
  syncSummary: RdsSyncSummary;
  stdoutTail: string[];
  stderrTail: string[];
  errorCode: string | null;
  errorSignal: string | null;
};

export type RdsSyncLogsResponse = {
  items: RdsSyncLogItem[];
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

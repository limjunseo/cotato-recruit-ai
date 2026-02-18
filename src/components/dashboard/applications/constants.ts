import type { ApplicationFilters } from "@/types/application";
import type { BatchProgress } from "@/components/dashboard/applications/types";

export const DEFAULT_FILTERS: ApplicationFilters = {
  q: "",
  part: "ALL",
  passStatus: "ALL",
  notionExists: "all",
  submitted: "all",
  enrolled: "all",
  prevActivity: "all",
  generationId: "",
  submittedFrom: "",
  submittedTo: "",
  page: 1,
  pageSize: 10,
};

export const BATCH_PAGE_SIZE = 100;
export const DEFAULT_BATCH_QUESTION_COUNT = 3;

export const INITIAL_BATCH_PROGRESS: BatchProgress = {
  isRunning: false,
  total: 0,
  processed: 0,
  success: 0,
  skipped: 0,
  failed: 0,
  currentName: null,
  batchStartedAt: null,
  currentItemStartedAt: null,
  batchElapsedMs: 0,
  results: [],
};

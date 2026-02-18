import {
  BATCH_PAGE_SIZE,
  DEFAULT_BATCH_QUESTION_COUNT,
} from "@/components/dashboard/applications/constants";
import { buildQueryString, parseApiError } from "@/components/dashboard/applications/utils";
import type { NotionSendResponse, NotionSyncStatsResponse } from "@/components/dashboard/applications/types";
import type { ApplicationFilters, ApplicationListItem, ApplicationListResponse } from "@/types/application";

const BATCH_SEND_TIMEOUT_MS = 300_000;

function createTimeoutController(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

export async function fetchApplications(
  filters: ApplicationFilters,
  signal?: AbortSignal,
): Promise<ApplicationListResponse> {
  const response = await fetch(`/api/applications?${buildQueryString(filters)}`, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to load applications."));
  }

  return (await response.json()) as ApplicationListResponse;
}

export async function fetchAllFilteredApplications(baseFilters: ApplicationFilters): Promise<ApplicationListItem[]> {
  const allItems: ApplicationListItem[] = [];
  let page = 1;
  let totalCount = Number.POSITIVE_INFINITY;

  while (allItems.length < totalCount) {
    const loopFilters: ApplicationFilters = {
      ...baseFilters,
      page,
      pageSize: BATCH_PAGE_SIZE,
    };

    const response = await fetch(`/api/applications?${buildQueryString(loopFilters)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, "Failed to fetch filtered applications."));
    }

    const payload = (await response.json()) as ApplicationListResponse;
    allItems.push(...payload.items);
    totalCount = payload.total;

    if (payload.items.length === 0) break;
    page += 1;
  }

  return allItems;
}

export async function fetchNotionSyncStats(signal?: AbortSignal): Promise<NotionSyncStatsResponse> {
  const response = await fetch("/api/applications/notion-sync-stats", {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to load Notion sync stats."));
  }

  return (await response.json()) as NotionSyncStatsResponse;
}

export async function sendApplicationToNotion(
  applicationId: string,
  questionCount = DEFAULT_BATCH_QUESTION_COUNT,
): Promise<NotionSendResponse> {
  const timeout = createTimeoutController(BATCH_SEND_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(`/api/applications/${applicationId}/notion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        questionCount,
      }),
      signal: timeout.signal,
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, "Failed to send to Notion."));
    }

    return (await response.json()) as NotionSendResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timeout after ${Math.round(BATCH_SEND_TIMEOUT_MS / 1000)}s.`);
    }
    throw error;
  } finally {
    timeout.clear();
    const elapsed = Date.now() - startedAt;
    console.info("[batch-send] sendApplicationToNotion finished", { applicationId, elapsedMs: elapsed });
  }
}

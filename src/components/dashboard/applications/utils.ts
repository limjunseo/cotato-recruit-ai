import type { ApplicationFilters } from "@/types/application";

export function buildQueryString(filters: ApplicationFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    const stringValue = String(value);
    if (!stringValue) continue;
    params.set(key, stringValue);
  }

  return params.toString();
}

export function buildSelectionScopeKey(filters: ApplicationFilters) {
  return JSON.stringify({
    q: filters.q,
    part: filters.part,
    passStatus: filters.passStatus,
    notionExists: filters.notionExists,
    submitted: filters.submitted,
    enrolled: filters.enrolled,
    prevActivity: filters.prevActivity,
    generationId: filters.generationId,
    submittedFrom: filters.submittedFrom,
    submittedTo: filters.submittedTo,
  });
}

export function displayName(item: { name: string | null; applicationId: string }) {
  return item.name?.trim() || `Application ${item.applicationId}`;
}

export async function parseApiError(response: Response, fallbackMessage: string) {
  try {
    const payload = (await response.json()) as { message?: string };
    if (payload.message) return payload.message;
  } catch {
    // Keep fallback.
  }
  return fallbackMessage;
}

import type {
  NotionBlockChildrenResponse,
  NotionDatabase,
  NotionDatabaseQueryResponse,
  NotionPage,
} from "@/notion/types";

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_API_VERSION = "2022-06-28";
const NOTION_REQUEST_TIMEOUT_MS = 30_000;

function extractNotionErrorMessage(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    // Intentionally ignore malformed payload.
  }
  return raw;
}

export async function notionRequest<T>(
  notionToken: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOTION_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${NOTION_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${notionToken}`,
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[notion] request failed", {
        path,
        method: init.method,
        status: response.status,
        elapsedMs: Date.now() - startedAt,
      });
      throw new Error(`Notion API ${response.status}: ${extractNotionErrorMessage(errorText)}`);
    }

    console.info("[notion] request succeeded", {
      path,
      method: init.method,
      elapsedMs: Date.now() - startedAt,
    });
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Notion API timeout after ${Math.round(NOTION_REQUEST_TIMEOUT_MS / 1000)}s (${path})`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getDatabaseSchema(notionToken: string, databaseId: string): Promise<NotionDatabase> {
  return notionRequest<NotionDatabase>(notionToken, `/databases/${databaseId}`, {
    method: "GET",
  });
}

export function findPropertyByAliases(
  properties: NotionDatabase["properties"],
  aliases: string[],
): { key: string; type: string } | null {
  const normalizedAliases = aliases.map(normalizeKey);

  for (const [key, value] of Object.entries(properties)) {
    if (normalizedAliases.includes(normalizeKey(key))) {
      return { key, type: value.type };
    }
  }

  return null;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]/g, "");
}

export function buildTextPropertyValue(propertyType: string, value: string | null) {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    if (propertyType === "rich_text") return { rich_text: [] };
    if (propertyType === "multi_select") return { multi_select: [] };
    if (propertyType === "title") return { title: [] };
    if (propertyType === "select") return { select: null };
    if (propertyType === "status") return { status: null };
    if (propertyType === "phone_number") return { phone_number: null };
    return null;
  }

  switch (propertyType) {
    case "title":
      return {
        title: [{ type: "text", text: { content: normalized } }],
      };
    case "rich_text":
      return {
        rich_text: [{ type: "text", text: { content: normalized } }],
      };
    case "select":
      return {
        select: { name: normalized },
      };
    case "multi_select":
      return {
        multi_select: [{ name: normalized }],
      };
    case "status":
      return {
        status: { name: normalized },
      };
    case "phone_number":
      return {
        phone_number: normalized,
      };
    default:
      return null;
  }
}

export function buildNumberPropertyValue(propertyType: string, value: number | null) {
  if (propertyType === "number") {
    return { number: value };
  }

  if (value === null) {
    return buildTextPropertyValue(propertyType, null);
  }

  return buildTextPropertyValue(propertyType, value.toString());
}

type NotionFilter = Record<string, unknown>;

export function buildEqualityFilter(propertyKey: string, propertyType: string, value: string): NotionFilter | null {
  const normalized = value.trim();
  if (!normalized) return null;

  switch (propertyType) {
    case "phone_number":
      return { property: propertyKey, phone_number: { equals: normalized } };
    case "rich_text":
      return { property: propertyKey, rich_text: { equals: normalized } };
    case "title":
      return { property: propertyKey, title: { equals: normalized } };
    case "select":
      return { property: propertyKey, select: { equals: normalized } };
    case "multi_select":
      return { property: propertyKey, multi_select: { contains: normalized } };
    case "status":
      return { property: propertyKey, status: { equals: normalized } };
    default:
      return null;
  }
}

export async function findPageByPropertyValue(
  notionToken: string,
  databaseId: string,
  propertyKey: string,
  propertyType: string,
  value: string,
): Promise<NotionPage | null> {
  const filter = buildEqualityFilter(propertyKey, propertyType, value);
  if (!filter) return null;

  const response = await notionRequest<NotionDatabaseQueryResponse>(notionToken, `/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      page_size: 1,
      filter,
    }),
  });

  return response.results[0] ?? null;
}

export async function listAllBlockIds(notionToken: string, blockId: string): Promise<string[]> {
  const allIds: string[] = [];
  let nextCursor: string | null = null;

  while (true) {
    const query = new URLSearchParams();
    query.set("page_size", "100");
    if (nextCursor) query.set("start_cursor", nextCursor);

    const response = await notionRequest<NotionBlockChildrenResponse>(
      notionToken,
      `/blocks/${blockId}/children?${query.toString()}`,
      { method: "GET" },
    );

    allIds.push(...response.results.map((item) => item.id));

    if (!response.has_more || !response.next_cursor) break;
    nextCursor = response.next_cursor;
  }

  return allIds;
}

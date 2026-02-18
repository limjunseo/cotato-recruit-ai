import type { PartType } from "@/types/application";
import type { NotionPage } from "@/notion/types";
import { buildEqualityFilter, notionRequest } from "@/notion/api";
import { normalizePhone, resolveContactLookup } from "@/notion/notion-contact-lookup-service";
import type { ContactLookup, NotionContactLookupItem, NotionExistenceItem } from "@/notion/notion-contact-types";

const NOTION_BULK_CONTACT_FILTER_CHUNK_SIZE = 25;

function getTextFromRichTextList(value: unknown): string | null {
  if (!Array.isArray(value)) return null;

  const text = value
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const plainText = (item as { plain_text?: unknown }).plain_text;
      if (typeof plainText === "string") return plainText;

      const nestedContent = (item as { text?: { content?: unknown } }).text?.content;
      return typeof nestedContent === "string" ? nestedContent : "";
    })
    .join("")
    .trim();

  return text || null;
}

function extractPropertyValues(page: NotionPage, propertyKey: string, propertyType: string): string[] {
  const properties = page.properties;
  if (!properties) return [];

  const property = properties[propertyKey];
  if (!property || typeof property !== "object") return [];

  switch (propertyType) {
    case "phone_number": {
      const value = normalizePhone((property as { phone_number?: string | null }).phone_number ?? null);
      return value ? [value] : [];
    }
    case "rich_text": {
      const value = getTextFromRichTextList((property as { rich_text?: unknown }).rich_text);
      const normalized = normalizePhone(value);
      return normalized ? [normalized] : [];
    }
    case "title": {
      const value = getTextFromRichTextList((property as { title?: unknown }).title);
      const normalized = normalizePhone(value);
      return normalized ? [normalized] : [];
    }
    case "select": {
      const name = (property as { select?: { name?: unknown } | null }).select?.name;
      const normalized = normalizePhone(typeof name === "string" ? name : null);
      return normalized ? [normalized] : [];
    }
    case "status": {
      const name = (property as { status?: { name?: unknown } | null }).status?.name;
      const normalized = normalizePhone(typeof name === "string" ? name : null);
      return normalized ? [normalized] : [];
    }
    case "multi_select": {
      const multiSelect = (property as { multi_select?: Array<{ name?: unknown }> | null }).multi_select;
      if (!Array.isArray(multiSelect)) return [];
      return multiSelect
        .map((item) => (typeof item?.name === "string" ? normalizePhone(item.name) : null))
        .filter((item): item is string => Boolean(item));
    }
    default:
      return [];
  }
}

async function findExistingContactValues(lookup: ContactLookup, values: string[]): Promise<Set<string>> {
  const filters = values
    .map((value) => buildEqualityFilter(lookup.contact.key, lookup.contact.type, value))
    .filter((filter): filter is Record<string, unknown> => Boolean(filter));

  if (filters.length === 0) return new Set<string>();

  const matchedValues = new Set<string>();
  let nextCursor: string | null = null;
  type NotionQueryPayload = {
    results: NotionPage[];
    has_more: boolean;
    next_cursor: string | null;
  };

  while (true) {
    const response: NotionQueryPayload = await notionRequest<NotionQueryPayload>(
      lookup.notionToken,
      `/databases/${lookup.databaseId}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          page_size: 100,
          ...(nextCursor ? { start_cursor: nextCursor } : {}),
          filter: { or: filters },
        }),
      },
    );

    for (const page of response.results) {
      for (const matched of extractPropertyValues(page, lookup.contact.key, lookup.contact.type)) {
        matchedValues.add(matched);
      }
    }

    if (!response.has_more || !response.next_cursor) break;
    nextCursor = response.next_cursor;
  }

  return matchedValues;
}

export async function findApplicationExistenceByContact(items: NotionContactLookupItem[]): Promise<NotionExistenceItem[]> {
  if (items.length === 0) return [];

  const existenceMap = new Map<string, boolean>();
  const groupedByPart = new Map<PartType, Array<{ applicationId: string; phone: string }>>();

  for (const item of items) {
    const normalizedPhone = normalizePhone(item.phoneNumber);
    if (!normalizedPhone) {
      existenceMap.set(item.applicationId, false);
      continue;
    }

    const group = groupedByPart.get(item.applicationPartType) ?? [];
    group.push({ applicationId: item.applicationId, phone: normalizedPhone });
    groupedByPart.set(item.applicationPartType, group);
    if (!existenceMap.has(item.applicationId)) {
      existenceMap.set(item.applicationId, false);
    }
  }

  for (const [part, group] of groupedByPart) {
    const lookup = await resolveContactLookup(part);
    const appIdsByPhone = new Map<string, string[]>();

    for (const row of group) {
      const appIds = appIdsByPhone.get(row.phone) ?? [];
      appIds.push(row.applicationId);
      appIdsByPhone.set(row.phone, appIds);
    }

    const uniquePhones = Array.from(appIdsByPhone.keys());

    for (let index = 0; index < uniquePhones.length; index += NOTION_BULK_CONTACT_FILTER_CHUNK_SIZE) {
      const phoneChunk = uniquePhones.slice(index, index + NOTION_BULK_CONTACT_FILTER_CHUNK_SIZE);
      const existingPhones = await findExistingContactValues(lookup, phoneChunk);

      for (const phone of existingPhones) {
        const appIds = appIdsByPhone.get(phone);
        if (!appIds) continue;
        for (const applicationId of appIds) {
          existenceMap.set(applicationId, true);
        }
      }
    }
  }

  return items.map((item) => ({
    applicationId: item.applicationId,
    isExists: existenceMap.get(item.applicationId) ?? false,
  }));
}

export async function findExistingApplicationIdsByContact(items: NotionContactLookupItem[]): Promise<string[]> {
  const existenceItems = await findApplicationExistenceByContact(items);
  return existenceItems.filter((item) => item.isExists).map((item) => item.applicationId);
}

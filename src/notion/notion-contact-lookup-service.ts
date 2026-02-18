import type { PartType } from "@/types/application";
import type { NotionPage } from "@/notion/types";
import { getNotionConfig } from "@/notion/config";
import { findPageByPropertyValue, findPropertyByAliases, getDatabaseSchema } from "@/notion/api";
import type { ContactLookup, NotionDatabaseProperties } from "@/notion/notion-contact-types";

const CONTACT_PROPERTY_ALIASES = [
  "\uC5F0\uB77D\uCC98",
  "\uC804\uD654\uBC88\uD638",
  "\uD734\uB300\uD3F0",
  "phone",
  "phonenumber",
  "contact",
];

export function normalizePhone(phoneNumber: string | null): string | null {
  const normalized = phoneNumber?.trim() ?? "";
  return normalized || null;
}

export function findContactProperty(databaseProperties: NotionDatabaseProperties) {
  return findPropertyByAliases(databaseProperties, CONTACT_PROPERTY_ALIASES);
}

export async function resolveContactLookup(part: PartType): Promise<ContactLookup> {
  const notionConfig = getNotionConfig(part);
  const database = await getDatabaseSchema(notionConfig.token, notionConfig.databaseId);
  const contact = findContactProperty(database.properties);

  if (!contact) {
    throw new Error("Contact property not found in the target Notion database.");
  }

  return {
    notionToken: notionConfig.token,
    databaseId: notionConfig.databaseId,
    contact,
  };
}

export async function findNotionPageByContact(part: PartType, phoneNumber: string | null): Promise<NotionPage | null> {
  const normalizedPhone = normalizePhone(phoneNumber);
  if (!normalizedPhone) return null;

  const { notionToken, databaseId, contact } = await resolveContactLookup(part);
  return findPageByPropertyValue(notionToken, databaseId, contact.key, contact.type, normalizedPhone);
}

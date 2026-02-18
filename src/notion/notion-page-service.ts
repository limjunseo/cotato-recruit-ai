import type { ApplicationDetail, GeneratedAnswerQuestions } from "@/types/application";
import type { NotionCreatePageResult, NotionPage } from "@/notion/types";
import { getNotionConfig } from "@/notion/config";
import {
  buildNumberPropertyValue,
  buildTextPropertyValue,
  findPageByPropertyValue,
  findPropertyByAliases,
  getDatabaseSchema,
  listAllBlockIds,
  notionRequest,
} from "@/notion/api";
import { buildChildrenBlocks, chunkBlocks } from "@/notion/blocks";
import { findContactProperty } from "@/notion/notion-contact-lookup-service";
import type { NotionDatabaseProperties } from "@/notion/notion-contact-types";

type ContactProperty = {
  key: string;
  type: string;
  value: string;
};

type BuildPropertiesResult = {
  properties: Record<string, unknown>;
  contact: ContactProperty;
};

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;

  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }

  return age;
}

function requiredName(application: ApplicationDetail): string {
  const name = application.name?.trim();
  if (!name) {
    throw new Error("Application name is required.");
  }
  return name;
}

function requiredPhone(application: ApplicationDetail): string {
  const phone = application.phoneNumber?.trim();
  if (!phone) {
    throw new Error("Application phone number is required for Notion upsert.");
  }
  return phone;
}

function buildNotionProperties(
  application: ApplicationDetail,
  databaseProperties: NotionDatabaseProperties,
  titlePropertyName: string,
): BuildPropertiesResult {
  const properties: Record<string, unknown> = {};
  const titleValue = requiredName(application);

  properties[titlePropertyName] = {
    title: [{ type: "text", text: { content: titleValue } }],
  };

  const university = findPropertyByAliases(databaseProperties, ["\uD559\uAD50", "university", "school"]);
  const major = findPropertyByAliases(databaseProperties, ["\uC804\uACF5", "major"]);
  const gender = findPropertyByAliases(databaseProperties, ["\uC131\uBCC4", "gender"]);
  const age = findPropertyByAliases(databaseProperties, ["\uB098\uC774", "age"]);
  const passStatus = findPropertyByAliases(databaseProperties, [
    "\uD569\uACA9\uC5EC\uBD80",
    "\uD569\uACA9\uC0C1\uD0DC",
    "passstatus",
    "status",
  ]);
  const contact = findContactProperty(databaseProperties);

  if (!contact) {
    throw new Error("Contact property not found in the target Notion database.");
  }

  const contactValue = requiredPhone(application);
  const contactPropertyValue = buildTextPropertyValue(contact.type, contactValue);
  if (!contactPropertyValue) {
    throw new Error(`Contact property type '${contact.type}' is not supported.`);
  }

  if (contact.key === titlePropertyName) {
    throw new Error("Contact property cannot be the title property.");
  }

  if (contact.key !== titlePropertyName) {
    properties[contact.key] = contactPropertyValue;
  }

  if (university && university.key !== titlePropertyName) {
    const value = buildTextPropertyValue(university.type, application.university);
    if (value) properties[university.key] = value;
  }

  if (major && major.key !== titlePropertyName) {
    const value = buildTextPropertyValue(major.type, application.major);
    if (value) properties[major.key] = value;
  }

  if (gender && gender.key !== titlePropertyName) {
    const value = buildTextPropertyValue(gender.type, application.gender);
    if (value) properties[gender.key] = value;
  }

  if (age && age.key !== titlePropertyName) {
    const ageValue = calculateAge(application.birthDate);
    const value = buildNumberPropertyValue(age.type, ageValue);
    if (value) properties[age.key] = value;
  }

  if (passStatus && passStatus.key !== titlePropertyName) {
    const value = buildTextPropertyValue(passStatus.type, application.passStatus);
    if (value) properties[passStatus.key] = value;
  }

  return {
    properties,
    contact: {
      key: contact.key,
      type: contact.type,
      value: contactValue,
    },
  };
}

async function clearPageBlocks(notionToken: string, pageId: string) {
  const blockIds = await listAllBlockIds(notionToken, pageId);
  for (const blockId of blockIds) {
    await notionRequest(notionToken, `/blocks/${blockId}`, {
      method: "DELETE",
    });
  }
}

async function upsertPage(
  notionToken: string,
  databaseId: string,
  properties: Record<string, unknown>,
  contact: ContactProperty,
): Promise<NotionPage> {
  const existingPage = await findPageByPropertyValue(notionToken, databaseId, contact.key, contact.type, contact.value);

  if (!existingPage) {
    return notionRequest<NotionPage>(notionToken, "/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
      }),
    });
  }

  const updatedPage = await notionRequest<NotionPage>(notionToken, `/pages/${existingPage.id}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });

  await clearPageBlocks(notionToken, existingPage.id);
  return updatedPage;
}

export async function createNotionApplicationPage(
  application: ApplicationDetail,
  generatedResults: GeneratedAnswerQuestions[],
): Promise<NotionCreatePageResult> {
  const notionConfig = getNotionConfig(application.applicationPartType);

  if (generatedResults.length === 0) {
    throw new Error("No generated interview questions to send.");
  }

  const database = await getDatabaseSchema(notionConfig.token, notionConfig.databaseId);
  const titleProperty = Object.entries(database.properties).find(([, value]) => value.type === "title");
  if (!titleProperty) {
    throw new Error("No title property found in the target Notion database.");
  }

  const [titlePropertyName] = titleProperty;
  const { properties, contact } = buildNotionProperties(application, database.properties, titlePropertyName);
  const page = await upsertPage(notionConfig.token, notionConfig.databaseId, properties, contact);

  const blocks = buildChildrenBlocks(application, generatedResults);
  const blockChunks = chunkBlocks(blocks);

  for (const chunk of blockChunks) {
    await notionRequest(notionConfig.token, `/blocks/${page.id}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: chunk }),
    });
  }

  return {
    pageId: page.id,
    pageUrl: page.url,
  };
}

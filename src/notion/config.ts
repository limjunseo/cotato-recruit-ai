import type { ApplicationDetail } from "@/types/application";

type NotionConfig = {
  token: string;
  databaseId: string;
};

function resolveDatabaseIdByPart(part: ApplicationDetail["applicationPartType"]) {
  switch (part) {
    case "BE":
      return process.env.NOTION_DATABASE_ID_BE ?? process.env.NOTION_DATABASE_ID_BACKEND ?? null;
    case "DE":
      return process.env.NOTION_DATABASE_ID_DE ?? process.env.NOTION_DATABASE_ID_DESIGN ?? null;
    case "FE":
      return process.env.NOTION_DATABASE_ID_FE ?? process.env.NOTION_DATABASE_ID_FRONTEND ?? null;
    case "PM":
      return process.env.NOTION_DATABASE_ID_PM ?? process.env.NOTION_DATABASE_ID_PLANNING ?? null;
    default:
      return null;
  }
}

export function getNotionConfig(part: ApplicationDetail["applicationPartType"]): NotionConfig {
  const token = process.env.NOTION_TOKEN;
  const databaseId = resolveDatabaseIdByPart(part);

  if (!token || !databaseId) {
    throw new Error(
      `Notion is not configured for part=${part}. Set NOTION_TOKEN and the matching NOTION_DATABASE_ID_* variable.`,
    );
  }

  return { token, databaseId };
}


import type { PartType } from "@/types/application";

export type NotionDatabaseProperties = Record<string, { type: string; [key: string]: unknown }>;

export type ContactLookup = {
  notionToken: string;
  databaseId: string;
  contact: {
    key: string;
    type: string;
  };
};

export type NotionContactLookupItem = {
  applicationId: string;
  applicationPartType: PartType;
  phoneNumber: string | null;
};

export type NotionExistenceItem = {
  applicationId: string;
  isExists: boolean;
};

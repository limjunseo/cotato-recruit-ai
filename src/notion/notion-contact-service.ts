export {
  findContactProperty,
  findNotionPageByContact,
  normalizePhone,
  resolveContactLookup,
} from "@/notion/notion-contact-lookup-service";

export {
  findApplicationExistenceByContact,
  findExistingApplicationIdsByContact,
} from "@/notion/notion-contact-existence-service";

export type {
  ContactLookup,
  NotionContactLookupItem,
  NotionDatabaseProperties,
  NotionExistenceItem,
} from "@/notion/notion-contact-types";

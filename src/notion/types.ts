export type NotionDatabase = {
  properties: Record<
    string,
    {
      type: string;
      [key: string]: unknown;
    }
  >;
};

export type NotionPage = {
  id: string;
  url: string;
  properties?: Record<
    string,
    {
      type: string;
      [key: string]: unknown;
    }
  >;
};

export type NotionDatabaseQueryResponse = {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
};

export type NotionBlockListItem = {
  id: string;
};

export type NotionBlockChildrenResponse = {
  results: NotionBlockListItem[];
  has_more: boolean;
  next_cursor: string | null;
};

export type NotionCreatePageResult = {
  pageId: string;
  pageUrl: string;
};

export type NotionBlock = Record<string, unknown>;

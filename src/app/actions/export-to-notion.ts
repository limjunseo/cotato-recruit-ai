"use server";

import { APIResponseError, Client } from "@notionhq/client";
import { prisma } from "@/lib/prisma";

type AiQuestionsMap = Record<string, string>;

type ExportToNotionResult = {
  pageId: string;
  pageUrl: string;
};

const NOTION_BLOCK_BATCH_SIZE = 100;
const NOTION_TEXT_LIMIT = 1900;

function calculateAge(birthDate: Date | null): number | null {
  if (!birthDate) return null;

  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

function splitText(text: string, chunkSize = NOTION_TEXT_LIMIT): string[] {
  const normalized = text.trim();
  if (!normalized) return ["-"];

  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    chunks.push(normalized.slice(index, index + chunkSize));
  }

  return chunks;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function toTextObject(content: string) {
  return {
    type: "text" as const,
    text: { content },
  };
}

function toSelectOrNull(value: string | null | undefined) {
  const name = value?.trim();
  return name ? { select: { name } } : { select: null };
}

function buildConversationBlocks(
  answers: Array<{
    answer_id: bigint;
    content: string | null;
    question: { content: string } | null;
  }>,
  aiQuestionsMap: AiQuestionsMap,
) {
  const blocks: Array<Record<string, unknown>> = [];

  answers.forEach((answer, index) => {
    const answerId = answer.answer_id.toString();
    const questionTitle = answer.question?.content?.trim() || `Question ${index + 1}`;
    const answerContent = answer.content?.trim() || "-";
    const aiGenerated = aiQuestionsMap[answerId]?.trim() || "No AI questions generated.";

    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [toTextObject(questionTitle)],
      },
    });

    splitText(answerContent).forEach((chunk) => {
      blocks.push({
        object: "block",
        type: "quote",
        quote: {
          rich_text: [toTextObject(chunk)],
        },
      });
    });

    splitText(aiGenerated).forEach((chunk) => {
      blocks.push({
        object: "block",
        type: "callout",
        callout: {
          rich_text: [toTextObject(chunk)],
          icon: { type: "emoji", emoji: "\u{1F916}" },
          color: "gray_background",
        },
      });
    });

    blocks.push({
      object: "block",
      type: "divider",
      divider: {},
    });
  });

  return blocks;
}

export async function exportToNotion(
  applicationId: string,
  aiQuestionsMap: AiQuestionsMap,
): Promise<ExportToNotionResult> {
  const notionApiKey = process.env.NOTION_API_KEY;
  const notionDatabaseId = process.env.NOTION_DATABASE_ID;

  if (!notionApiKey || !notionDatabaseId) {
    throw new Error("Notion is not configured. Set NOTION_API_KEY and NOTION_DATABASE_ID.");
  }

  if (!/^\d+$/.test(applicationId)) {
    throw new Error("Invalid applicationId.");
  }

  const application = await prisma.application.findUnique({
    where: { application_id: BigInt(applicationId) },
    include: {
      answers: {
        include: {
          question: true,
        },
        orderBy: [{ question_id: "asc" }, { answer_id: "asc" }],
      },
    },
  });

  if (!application) {
    throw new Error("Application not found.");
  }

  const notion = new Client({ auth: notionApiKey });
  const age = calculateAge(application.birth_date);

  const properties = {
    Name: {
      title: [toTextObject(application.name?.trim() || `Application ${application.application_id.toString()}`)],
    },
    University: toSelectOrNull(application.university),
    Gender: toSelectOrNull(application.gender),
    "Pass Status": toSelectOrNull(application.pass_status ?? null),
    Age: {
      number: age,
    },
  };

  const blocks = buildConversationBlocks(application.answers, aiQuestionsMap);
  const blockBatches = chunkArray(blocks, NOTION_BLOCK_BATCH_SIZE);
  const [firstBatch, ...restBatches] = blockBatches;

  try {
    const page = await notion.pages.create({
      parent: { database_id: notionDatabaseId },
      properties: properties as never,
      ...(firstBatch ? { children: firstBatch as never } : {}),
    });

    for (const batch of restBatches) {
      await notion.blocks.children.append({
        block_id: page.id,
        children: batch as never,
      });
    }

    const pageUrl = "url" in page ? page.url ?? "" : "";

    return {
      pageId: page.id,
      pageUrl,
    };
  } catch (error) {
    if (error instanceof APIResponseError) {
      throw new Error(`Notion export failed: ${error.message}`);
    }
    throw new Error(`Notion export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

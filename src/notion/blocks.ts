import type { ApplicationAnswer, ApplicationDetail, GeneratedAnswerQuestions } from "@/types/application";
import type { NotionBlock } from "@/notion/types";

const NOTION_TEXT_LIMIT = 1900;
const NOTION_CHILDREN_BATCH_LIMIT = 100;

function chunkText(text: string, size = NOTION_TEXT_LIMIT): string[] {
  const normalized = text.trim();
  if (!normalized) return ["-"];

  const chunks: string[] = [];
  for (let index = 0; index < normalized.length; index += size) {
    chunks.push(normalized.slice(index, index + size));
  }
  return chunks;
}

function heading2Block(text: string): NotionBlock {
  return {
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

function quoteBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "quote",
    quote: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

function calloutBlock(text: string, emoji: string, color: string): NotionBlock {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: [{ type: "text", text: { content: text } }],
      icon: { type: "emoji", emoji },
      color,
    },
  };
}

function numberedListItemBlock(text: string): NotionBlock {
  return {
    object: "block",
    type: "numbered_list_item",
    numbered_list_item: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  };
}

function dividerBlock(): NotionBlock {
  return {
    object: "block",
    type: "divider",
    divider: {},
  };
}

function answerContentBlocks(answer: ApplicationAnswer): NotionBlock[] {
  const contentChunks = chunkText(answer.content);
  return contentChunks.map((chunk) => quoteBlock(chunk));
}

export function buildChildrenBlocks(
  application: ApplicationDetail,
  generatedResults: GeneratedAnswerQuestions[],
): NotionBlock[] {
  const answerMap = new Map(application.answers.map((answer) => [answer.answerId, answer]));
  const blocks: NotionBlock[] = [];

  for (const [index, result] of generatedResults.entries()) {
    const answer = answerMap.get(result.answerId);
    const questionTitle = answer?.questionContent ?? `question_id=${result.questionId}`;

    if (index > 0) {
      blocks.push(dividerBlock());
    }

    blocks.push(heading2Block(`📌 ${index + 1}. ${questionTitle}`));
    blocks.push(calloutBlock("지원자 답변", "🗣️", "gray_background"));
    if (answer) {
      blocks.push(...answerContentBlocks(answer));
    } else {
      for (const chunk of chunkText(result.answerContent)) {
        blocks.push(quoteBlock(chunk));
      }
    }

    blocks.push(calloutBlock(`자기소개서 평가 요약\n${result.evaluationSummary}`, "🧠", "yellow_background"));
    blocks.push(calloutBlock("AI 면접 꼬리질문", "🤖", "blue_background"));

    for (const question of result.questions) {
      for (const chunk of chunkText(question)) {
        blocks.push(numberedListItemBlock(chunk));
      }
    }
  }

  return blocks;
}

export function chunkBlocks<T>(items: T[], size = NOTION_CHILDREN_BATCH_LIMIT): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

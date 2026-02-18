import type { ApplicationAnswer, ApplicationDetail, GeneratedAnswerQuestions } from "@/types/application";

const MAX_PREVIEW_ITEMS = 1;
const MAX_ANSWER_PREVIEW_LENGTH = 280;
const MAX_SUMMARY_PREVIEW_LENGTH = 1000;
const DISCORD_TIMEOUT_MS = 10_000;
const DISCORD_MAX_CONTENT_LENGTH = 2000;
const DISCORD_MAX_EMBEDS = 10;
const DISCORD_MAX_EMBED_DESCRIPTION_LENGTH = 4096;
const DISCORD_MAX_EMBED_FIELD_NAME_LENGTH = 256;
const DISCORD_MAX_EMBED_FIELD_VALUE_LENGTH = 1024;
const DISCORD_EMBED_COLOR = 0x3f8cff;
const CONTENT_BASE_TEXT = "Notion sync completed.";

export type NotionSyncTrigger = "cron" | "rds-pull" | "dashboard-batch" | "manual";

type SendDiscordNotionSyncNotificationParams = {
  trigger: NotionSyncTrigger | string;
  application: ApplicationDetail;
  generatedResults: GeneratedAnswerQuestions[];
  notionPageUrl?: string | null;
};

type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  timestamp?: string;
};

type DiscordWebhookPayload = {
  content: string;
  embeds: DiscordEmbed[];
};

type TruncatedText = {
  text: string;
  isTruncated: boolean;
  omittedChars: number;
};

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string | null | undefined, maxLength: number): string {
  const normalized = compactWhitespace(value ?? "");
  if (!normalized) return "-";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatSubmittedAt(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", { hour12: false });
}

function buildTruncatedText(value: string | null | undefined, maxLength: number): TruncatedText {
  const normalized = compactWhitespace(value ?? "");
  if (!normalized) {
    return {
      text: "-",
      isTruncated: false,
      omittedChars: 0,
    };
  }

  if (normalized.length <= maxLength) {
    return {
      text: normalized,
      isTruncated: false,
      omittedChars: 0,
    };
  }

  const keepLength = Math.max(0, maxLength - 3);
  return {
    text: `${normalized.slice(0, keepLength)}...`,
    isTruncated: true,
    omittedChars: Math.max(0, normalized.length - keepLength),
  };
}

function escapeForSpoiler(value: string): string {
  return value.replace(/\|\|/g, "\\|\\|");
}

function buildContentWithSpoiler(fullAnswer: string | null | undefined): string {
  const normalized = compactWhitespace(fullAnswer ?? "");
  if (!normalized) return CONTENT_BASE_TEXT;

  const header = "Full Answer (Spoiler)";
  const escaped = escapeForSpoiler(normalized);
  const wrapperLength = `${CONTENT_BASE_TEXT}\n\n${header}\n||||`.length;
  const maxSpoilerBodyLength = Math.max(0, DISCORD_MAX_CONTENT_LENGTH - wrapperLength);

  if (escaped.length <= maxSpoilerBodyLength) {
    return `${CONTENT_BASE_TEXT}\n\n${header}\n||${escaped}||`;
  }

  const omittedTemplate = "\n(omitted 0 chars due to Discord content limit)";
  const noteReserved = omittedTemplate.length;
  const maxBodyWithNote = Math.max(0, maxSpoilerBodyLength - noteReserved);
  const keepLength = Math.max(0, maxBodyWithNote - 3);
  const preview = `${escaped.slice(0, keepLength)}...`;
  const omittedChars = Math.max(0, escaped.length - keepLength);
  const note = `\n(omitted ${omittedChars} chars due to Discord content limit)`;

  const content = `${CONTENT_BASE_TEXT}\n\n${header}\n||${preview}||${note}`;
  if (content.length <= DISCORD_MAX_CONTENT_LENGTH) return content;

  return `${CONTENT_BASE_TEXT}\n\n${header}\n||...||\n(omitted due to Discord content limit)`;
}

function toDiscordTimestamp(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function buildField(name: string, value: string, inline = false): DiscordEmbedField {
  return {
    name: truncate(name, DISCORD_MAX_EMBED_FIELD_NAME_LENGTH),
    value: truncate(value, DISCORD_MAX_EMBED_FIELD_VALUE_LENGTH),
    inline,
  };
}

function splitLinesForDescription(lines: string[], maxLength: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const lineRaw of lines) {
    const line = compactWhitespace(lineRaw) || "-";

    if (line.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      let remaining = line;
      while (remaining.length > maxLength) {
        chunks.push(`${remaining.slice(0, Math.max(0, maxLength - 3))}...`);
        remaining = remaining.slice(Math.max(0, maxLength - 3));
      }
      current = remaining;
      continue;
    }

    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= maxLength) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = line;
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : ["-"];
}

function buildMessagePayload(params: SendDiscordNotionSyncNotificationParams): DiscordWebhookPayload {
  const { application, generatedResults, notionPageUrl, trigger } = params;
  const answerMap = new Map(application.answers.map((answer) => [answer.answerId, answer]));
  const triggerLabel = String(trigger).toUpperCase();
  const embeds: DiscordEmbed[] = [
    {
      title: "Notion Sync Notification",
      color: DISCORD_EMBED_COLOR,
      timestamp: toDiscordTimestamp(application.submittedAt),
      fields: [
        buildField("Applicant", `${application.name ?? "-"} (${application.applicationId})`),
        buildField("Part", application.applicationPartType, true),
        buildField("Trigger", triggerLabel, true),
        buildField("Submitted At", formatSubmittedAt(application.submittedAt), true),
        buildField("School / Major", `${application.university ?? "-"} / ${application.major ?? "-"}`),
        buildField("Notion", notionPageUrl ?? "-"),
      ],
    },
  ];

  const previewResult = generatedResults.slice(0, MAX_PREVIEW_ITEMS)[0];
  if (!previewResult) {
    return {
      content: CONTENT_BASE_TEXT,
      embeds,
    };
  }

  const previewAnswer: ApplicationAnswer | undefined = answerMap.get(previewResult.answerId);
  const omittedCount = Math.max(0, generatedResults.length - MAX_PREVIEW_ITEMS);
  const questionTitle = truncate(previewAnswer?.questionContent ?? `question_id=${previewResult.questionId}`, 220);
  const answerPreview = buildTruncatedText(previewAnswer?.content ?? previewResult.answerContent, MAX_ANSWER_PREVIEW_LENGTH);
  const summaryPreview = truncate(previewResult.evaluationSummary, MAX_SUMMARY_PREVIEW_LENGTH);

  embeds.push({
    title: "Q1 Review",
    color: DISCORD_EMBED_COLOR,
    fields: [
      buildField("Question", questionTitle),
      buildField("Answer (Preview)", answerPreview.text),
      ...(answerPreview.isTruncated
        ? [buildField("Answer Omitted", `... ${answerPreview.omittedChars} chars omitted`)]
        : []),
      buildField("Summary", summaryPreview),
      ...(omittedCount > 0 ? [buildField("Other Q/A", `${omittedCount} more Q/A summaries omitted`)] : []),
    ],
  });

  const aiQuestionLines = previewResult.questions.length
    ? previewResult.questions.map((question, index) => `${index + 1}. ${compactWhitespace(question) || "-"}`)
    : ["-"];
  const aiQuestionChunks = splitLinesForDescription(aiQuestionLines, DISCORD_MAX_EMBED_DESCRIPTION_LENGTH);
  const availableEmbedSlots = Math.max(0, DISCORD_MAX_EMBEDS - embeds.length);
  const aiChunksToSend = aiQuestionChunks.slice(0, availableEmbedSlots);

  aiChunksToSend.forEach((chunk, index) => {
    embeds.push({
      title: aiChunksToSend.length > 1 ? `AI Questions (${index + 1}/${aiChunksToSend.length})` : "AI Questions",
      description: chunk,
      color: DISCORD_EMBED_COLOR,
    });
  });

  if (aiQuestionChunks.length > aiChunksToSend.length && embeds.length > 0) {
    const lastEmbed = embeds[embeds.length - 1];
    const omittedChunkCount = aiQuestionChunks.length - aiChunksToSend.length;
    const notice = `\n\n...${omittedChunkCount} more section(s) omitted due to Discord embed limit`;
    const nextDescription = `${lastEmbed.description ?? ""}${notice}`;
    lastEmbed.description = truncate(nextDescription, DISCORD_MAX_EMBED_DESCRIPTION_LENGTH);
  }

  return {
    content: buildContentWithSpoiler(previewAnswer?.content ?? previewResult.answerContent),
    embeds,
  };
}

async function postDiscordMessage(payload: DiscordWebhookPayload): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DISCORD_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: payload.content,
        embeds: payload.embeds,
        username: process.env.DISCORD_WEBHOOK_USERNAME?.trim() || "Recruitment Notifier",
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord webhook failed (${response.status}): ${errorText || "Unknown error"}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendDiscordNotionSyncNotification(
  params: SendDiscordNotionSyncNotificationParams,
): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return false;

  const payload = buildMessagePayload(params);
  await postDiscordMessage(payload);
  return true;
}

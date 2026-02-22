import { NextResponse } from "next/server";
import { z } from "zod";
import { sendDiscordNotionSyncNotification, type NotionSyncTrigger } from "@/discord";
import { generateInterviewQuestionsByAnswer, INTERVIEW_GENERATION_ERRORS } from "@/llm";
import { getApplicationById } from "@/lib/applications";
import { prisma } from "@/lib/prisma";
import { createNotionApplicationPage } from "@/notion";

type ParamsContext = {
  params: Promise<{ id: string }>;
};

const bodySchema = z.object({
  questionCount: z.number().int().min(1).max(3).optional(),
  syncTrigger: z.enum(["rds-pull", "dashboard-batch", "manual"]).optional(),
});

export const dynamic = "force-dynamic";
const LLM_GENERATION_TIMEOUT_MS = 300_000;
const NOTION_UPSERT_TIMEOUT_MS = 90_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function POST(request: Request, context: ParamsContext) {
  const { id } = await context.params;
  const requestId = `${id}-${Date.now()}`;
  const startedAt = Date.now();

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: "Invalid application_id." }, { status: 400 });
  }

  let questionCount = 3;
  let syncTrigger: NotionSyncTrigger = "manual";
  try {
    const body = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }
    if (parsed.data.questionCount) {
      questionCount = parsed.data.questionCount;
    }
    if (parsed.data.syncTrigger) {
      syncTrigger = parsed.data.syncTrigger;
    }
  } catch {
    // Keep defaults if no JSON body exists.
  }

  try {
    const application = await getApplicationById(BigInt(id));
    if (!application) {
      return NextResponse.json({ message: "Application not found." }, { status: 404 });
    }
    console.info("[api:notion] request started", {
      requestId,
      applicationId: id,
      part: application.applicationPartType,
      questionCount,
    });

    const llmStartedAt = Date.now();
    const results = await withTimeout(
      generateInterviewQuestionsByAnswer(application, { questionCount }),
      LLM_GENERATION_TIMEOUT_MS,
      "LLM interview question generation",
    );
    console.info("[api:notion] llm generation completed", {
      requestId,
      applicationId: id,
      resultCount: results.length,
      elapsedMs: Date.now() - llmStartedAt,
    });

    const notionStartedAt = Date.now();
    const notion = await withTimeout(
      createNotionApplicationPage(application, results),
      NOTION_UPSERT_TIMEOUT_MS,
      "Notion page upsert",
    );
    console.info("[api:notion] notion upsert completed", {
      requestId,
      applicationId: id,
      pageId: notion.pageId,
      elapsedMs: Date.now() - notionStartedAt,
    });
    console.info("[api:notion] request completed", {
      requestId,
      applicationId: id,
      elapsedMs: Date.now() - startedAt,
    });

    await prisma.application.update({
      where: { application_id: BigInt(id) },
      data: {
        is_synced_to_notion: true,
        notion_synced_at: new Date(),
      },
    });

    if (syncTrigger === "rds-pull") {
      try {
        await sendDiscordNotionSyncNotification({
          trigger: syncTrigger,
          application,
          generatedResults: results,
          notionPageUrl: notion.pageUrl,
        });
      } catch (discordError) {
        console.error("[api:notion] discord notification failed", {
          requestId,
          applicationId: id,
          error: discordError instanceof Error ? discordError.message : discordError,
        });
      }
    }

    return NextResponse.json({
      pageId: notion.pageId,
      pageUrl: notion.pageUrl,
      results,
    });
  } catch (error) {
    console.error("[api:notion] request failed", {
      requestId,
      applicationId: id,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : error,
    });
    if (error instanceof Error) {
      if (error.message === INTERVIEW_GENERATION_ERRORS.REQUESTED_ANSWER_NOT_FOUND) {
        return NextResponse.json({ message: error.message }, { status: 404 });
      }
      if (
        error.message === INTERVIEW_GENERATION_ERRORS.REQUESTED_ANSWER_EMPTY ||
        error.message === INTERVIEW_GENERATION_ERRORS.NO_NON_EMPTY_ANSWERS
      ) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to send to Notion." },
      { status: 500 },
    );
  }
}

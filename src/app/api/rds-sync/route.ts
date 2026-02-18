import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { getApplicationById } from "@/lib/applications";
import { sendDiscordNotionSyncNotification } from "@/discord";
import { prisma } from "@/lib/prisma";
import {
  completeRdsSyncRunLogFailure,
  completeRdsSyncRunLogSuccess,
  createRdsSyncRunLog,
  type RdsSyncSummary,
} from "@/lib/rds-sync-log";
import { generateInterviewQuestionsByAnswer } from "@/llm";
import { createNotionApplicationPage } from "@/notion";

const execFileAsync = promisify(execFile);
const SYNC_SCRIPT_PATH = path.join(process.cwd(), "scripts", "sync-rds-to-local.mjs");
const SYNC_TIMEOUT_MS = 25 * 60 * 1000;
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const LOG_TAIL_LINES = 20;
const STEP_SUMMARY_PREFIX = "__RDS_SYNC_STEP_SUMMARY__";
const LLM_GENERATION_TIMEOUT_MS = 300_000;
const NOTION_UPSERT_TIMEOUT_MS = 90_000;

type NotionAutoSyncSummary = {
  attempted: number;
  success: number;
  skipped: number;
  failed: number;
};

let runningSync:
  | {
      startedAt: number;
      trigger: string;
      runId: string | null;
    }
  | null = null;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 1700;

function tailLines(text: string | undefined, lineCount = LOG_TAIL_LINES): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-lineCount);
}

function getCronToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function ensureCronAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  return getCronToken(request) === expected;
}

function parseStepSummaryLine(line: string): { step: string; insertedCount: number; insertedIds: string[] } | null {
  const prefixIndex = line.indexOf(STEP_SUMMARY_PREFIX);
  if (prefixIndex < 0) return null;
  const payloadText = line.slice(prefixIndex + STEP_SUMMARY_PREFIX.length).trim();
  if (!payloadText) return null;

  try {
    const parsed = JSON.parse(payloadText) as {
      step?: string;
      insertedCount?: number;
      insertedIds?: unknown[];
    };

    if (!parsed.step || typeof parsed.step !== "string") return null;
    const insertedCount = Number.isFinite(parsed.insertedCount) ? Number(parsed.insertedCount) : 0;
    const insertedIds = Array.isArray(parsed.insertedIds) ? parsed.insertedIds.map((id) => String(id)) : [];

    return {
      step: parsed.step,
      insertedCount,
      insertedIds,
    };
  } catch {
    return null;
  }
}

function parseSyncSummary(stdout?: string, stderr?: string): RdsSyncSummary {
  const lines = `${stdout ?? ""}\n${stderr ?? ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const result: RdsSyncSummary = {
    applications: { count: 0, ids: [] },
    questions: { count: 0, ids: [] },
    answers: { count: 0, ids: [] },
  };

  for (const line of lines) {
    const parsed = parseStepSummaryLine(line);
    if (!parsed) continue;

    if (parsed.step === "applications") {
      result.applications = {
        count: parsed.insertedCount,
        ids: parsed.insertedIds,
      };
    }
    if (parsed.step === "questions") {
      result.questions = {
        count: parsed.insertedCount,
        ids: parsed.insertedIds,
      };
    }
    if (parsed.step === "answers") {
      result.answers = {
        count: parsed.insertedCount,
        ids: parsed.insertedIds,
      };
    }
  }

  return result;
}

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

function buildNotionAutoSyncMessage(summary: NotionAutoSyncSummary) {
  if (summary.attempted === 0) {
    return "Auto Notion sync skipped (no new applications).";
  }
  return `Auto Notion sync completed: ${summary.success} success, ${summary.skipped} skipped, ${summary.failed} failed (total ${summary.attempted}).`;
}

async function syncApplicationsToNotion(applicationIds: string[]): Promise<NotionAutoSyncSummary> {
  if (applicationIds.length === 0) {
    return { attempted: 0, success: 0, skipped: 0, failed: 0 };
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const applicationId of applicationIds) {
    const itemStartedAt = Date.now();
    console.info("[rds-sync:notion] item started", { applicationId });

    try {
      if (!/^\d+$/.test(applicationId)) {
        throw new Error("Invalid application_id.");
      }

      const application = await getApplicationById(BigInt(applicationId));
      if (!application) {
        throw new Error("Application not found.");
      }

      if (application.isSyncedToNotion) {
        skipped += 1;
        console.info("[rds-sync:notion] item skipped", {
          applicationId,
          elapsedMs: Date.now() - itemStartedAt,
        });
        continue;
      }

      const generated = await withTimeout(
        generateInterviewQuestionsByAnswer(application, { questionCount: 3 }),
        LLM_GENERATION_TIMEOUT_MS,
        "LLM interview question generation",
      );

      const notion = await withTimeout(
        createNotionApplicationPage(application, generated),
        NOTION_UPSERT_TIMEOUT_MS,
        "Notion page upsert",
      );

      await prisma.application.update({
        where: { application_id: BigInt(applicationId) },
        data: {
          is_synced_to_notion: true,
          notion_synced_at: new Date(),
        },
      });

      try {
        await sendDiscordNotionSyncNotification({
          trigger: "cron",
          application,
          generatedResults: generated,
          notionPageUrl: notion.pageUrl,
        });
      } catch (discordError) {
        console.error("[rds-sync:notion] discord notification failed", {
          applicationId,
          error: discordError instanceof Error ? discordError.message : discordError,
        });
      }

      success += 1;
      console.info("[rds-sync:notion] item succeeded", {
        applicationId,
        elapsedMs: Date.now() - itemStartedAt,
      });
    } catch (error) {
      failed += 1;
      console.error("[rds-sync:notion] item failed", {
        applicationId,
        elapsedMs: Date.now() - itemStartedAt,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  const summary: NotionAutoSyncSummary = {
    attempted: applicationIds.length,
    success,
    skipped,
    failed,
  };
  console.info("[rds-sync:notion] batch completed", summary);
  return summary;
}

async function runRdsSync(params: {
  trigger: string;
  requestedAt: Date;
  runId: string | null;
  enableNotionAutoSync: boolean;
}) {
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [SYNC_SCRIPT_PATH], {
      env: process.env,
      timeout: SYNC_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_BYTES,
    });
    const completedAt = new Date();
    const syncSummary = parseSyncSummary(stdout, stderr);
    const notionSyncSummary = params.enableNotionAutoSync
      ? await syncApplicationsToNotion(syncSummary.applications.ids)
      : undefined;
    if (notionSyncSummary) {
      console.info("[rds-sync:notion] summary", {
        ...notionSyncSummary,
        message: buildNotionAutoSyncMessage(notionSyncSummary),
      });
    }
    const stdoutTail = tailLines(stdout);
    const stderrTail = tailLines(stderr);
    const durationMs = Date.now() - startedAt;
    const message = "Production RDS pull completed.";

    if (params.runId) {
      try {
        await completeRdsSyncRunLogSuccess({
          runId: params.runId,
          completedAt,
          durationMs,
          message,
          syncSummary,
          stdoutTail,
          stderrTail,
        });
      } catch (logError) {
        console.error("[rds-sync] failed to update success log", logError);
      }
    }

    return NextResponse.json({
      message,
      trigger: params.trigger,
      runId: params.runId,
      requestedAt: params.requestedAt.toISOString(),
      startedAt: startedAtIso,
      completedAt: completedAt.toISOString(),
      durationMs,
      syncSummary,
      ...(notionSyncSummary ? { notionSyncSummary } : {}),
      stdoutTail,
      stderrTail,
    });
  } catch (error) {
    const err = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      signal?: NodeJS.Signals | null;
      code?: string | number | null;
      killed?: boolean;
    };
    const failedAt = new Date();
    const stdoutTail = tailLines(err.stdout);
    const stderrTail = tailLines(err.stderr);
    const durationMs = Date.now() - startedAt;
    const syncSummary = parseSyncSummary(err.stdout, err.stderr);
    const message = err.message || "Production RDS pull failed.";

    if (params.runId) {
      try {
        await completeRdsSyncRunLogFailure({
          runId: params.runId,
          completedAt: failedAt,
          durationMs,
          message,
          syncSummary,
          stdoutTail,
          stderrTail,
          errorCode: err.code ? String(err.code) : null,
          errorSignal: err.signal ?? null,
        });
      } catch (logError) {
        console.error("[rds-sync] failed to update failure log", logError);
      }
    }

    return NextResponse.json(
      {
        message,
        trigger: params.trigger,
        runId: params.runId,
        requestedAt: params.requestedAt.toISOString(),
        startedAt: startedAtIso,
        failedAt: failedAt.toISOString(),
        durationMs,
        syncSummary,
        code: err.code ?? null,
        signal: err.signal ?? null,
        killed: err.killed ?? false,
        stdoutTail,
        stderrTail,
      },
      { status: 500 },
    );
  }
}

async function handleSync(trigger: string, enableNotionAutoSync: boolean) {
  const requestedAt = new Date();

  if (runningSync) {
    return NextResponse.json(
      {
        message: "A sync job is already running.",
        trigger: runningSync.trigger,
        startedAt: new Date(runningSync.startedAt).toISOString(),
        runId: runningSync.runId,
      },
      { status: 409 },
    );
  }

  let runId: string | null = null;
  try {
    runId = await createRdsSyncRunLog({
      trigger,
      requestedAt,
      startedAt: requestedAt,
    });
  } catch (error) {
    console.error("[rds-sync] failed to create run log", error);
  }

  runningSync = {
    startedAt: requestedAt.getTime(),
    trigger,
    runId,
  };

  try {
    return await runRdsSync({
      trigger,
      requestedAt,
      runId,
      enableNotionAutoSync,
    });
  } finally {
    runningSync = null;
  }
}

export async function POST() {
  return handleSync("manual", false);
}

export async function GET(request: Request) {
  if (!ensureCronAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized cron request." }, { status: 401 });
  }
  return handleSync("cron", true);
}

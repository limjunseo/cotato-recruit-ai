import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import {
  completeRdsSyncRunLogFailure,
  completeRdsSyncRunLogSuccess,
  createRdsSyncRunLog,
  type RdsSyncSummary,
} from "@/lib/rds-sync-log";

const execFileAsync = promisify(execFile);
const SYNC_SCRIPT_PATH = path.join(process.cwd(), "scripts", "sync-rds-to-local.mjs");
const SYNC_TIMEOUT_MS = 25 * 60 * 1000;
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const LOG_TAIL_LINES = 20;
const STEP_SUMMARY_PREFIX = "__RDS_SYNC_STEP_SUMMARY__";

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

async function runRdsSync(params: { trigger: string; requestedAt: Date; runId: string | null }) {
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

async function handleSync(trigger: string) {
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
    });
  } finally {
    runningSync = null;
  }
}

export async function POST() {
  return handleSync("manual");
}

export async function GET(request: Request) {
  if (!ensureCronAuthorized(request)) {
    return NextResponse.json({ message: "Unauthorized cron request." }, { status: 401 });
  }
  return handleSync("cron");
}

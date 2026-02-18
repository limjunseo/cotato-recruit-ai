import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

type RdsSyncLogStatus = "RUNNING" | "SUCCESS" | "FAILED";

export type RdsSyncSummaryGroup = {
  count: number;
  ids: string[];
};

export type RdsSyncSummary = {
  applications: RdsSyncSummaryGroup;
  questions: RdsSyncSummaryGroup;
  answers: RdsSyncSummaryGroup;
};

export type RdsSyncLogItem = {
  runId: string;
  trigger: string;
  status: RdsSyncLogStatus | string;
  requestedAt: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  message: string | null;
  syncSummary: RdsSyncSummary;
  stdoutTail: string[];
  stderrTail: string[];
  errorCode: string | null;
  errorSignal: string | null;
};

type RdsSyncLogRawRow = {
  run_id: string;
  trigger: string;
  status: string;
  requested_at: Date | string;
  started_at: Date | string;
  completed_at: Date | string | null;
  duration_ms: number | null;
  message: string | null;
  inserted_applications_count: number;
  inserted_questions_count: number;
  inserted_answers_count: number;
  inserted_application_ids: string | null;
  inserted_question_ids: string | null;
  inserted_answer_ids: string | null;
  stdout_tail: string | null;
  stderr_tail: string | null;
  error_code: string | null;
  error_signal: string | null;
};

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS rds_sync_logs (
  run_id CHAR(36) NOT NULL PRIMARY KEY,
  \`trigger\` VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  requested_at DATETIME(6) NOT NULL,
  started_at DATETIME(6) NOT NULL,
  completed_at DATETIME(6) NULL,
  duration_ms INT NULL,
  message TEXT NULL,
  inserted_applications_count INT NOT NULL DEFAULT 0,
  inserted_questions_count INT NOT NULL DEFAULT 0,
  inserted_answers_count INT NOT NULL DEFAULT 0,
  inserted_application_ids LONGTEXT NULL,
  inserted_question_ids LONGTEXT NULL,
  inserted_answer_ids LONGTEXT NULL,
  stdout_tail LONGTEXT NULL,
  stderr_tail LONGTEXT NULL,
  error_code VARCHAR(64) NULL,
  error_signal VARCHAR(64) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_rds_sync_logs_requested_at (requested_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`;

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item));
  } catch {
    return [];
  }
}

function serializeStringArray(value: string[]): string {
  return JSON.stringify(value);
}

function normalizeSummary(summary?: Partial<RdsSyncSummary>): RdsSyncSummary {
  return {
    applications: {
      count: summary?.applications?.count ?? 0,
      ids: summary?.applications?.ids ?? [],
    },
    questions: {
      count: summary?.questions?.count ?? 0,
      ids: summary?.questions?.ids ?? [],
    },
    answers: {
      count: summary?.answers?.count ?? 0,
      ids: summary?.answers?.ids ?? [],
    },
  };
}

function mapRawRowToLogItem(row: RdsSyncLogRawRow): RdsSyncLogItem {
  return {
    runId: row.run_id,
    trigger: row.trigger,
    status: row.status,
    requestedAt: toIsoString(row.requested_at) ?? new Date(0).toISOString(),
    startedAt: toIsoString(row.started_at) ?? new Date(0).toISOString(),
    completedAt: toIsoString(row.completed_at),
    durationMs: row.duration_ms,
    message: row.message,
    syncSummary: normalizeSummary({
      applications: {
        count: row.inserted_applications_count ?? 0,
        ids: parseStringArray(row.inserted_application_ids),
      },
      questions: {
        count: row.inserted_questions_count ?? 0,
        ids: parseStringArray(row.inserted_question_ids),
      },
      answers: {
        count: row.inserted_answers_count ?? 0,
        ids: parseStringArray(row.inserted_answer_ids),
      },
    }),
    stdoutTail: parseStringArray(row.stdout_tail),
    stderrTail: parseStringArray(row.stderr_tail),
    errorCode: row.error_code,
    errorSignal: row.error_signal,
  };
}

export async function ensureRdsSyncLogTable() {
  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
}

export async function createRdsSyncRunLog(params: { trigger: string; requestedAt: Date; startedAt: Date }) {
  await ensureRdsSyncLogTable();
  const runId = randomUUID();
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO rds_sync_logs (
      run_id,
      \`trigger\`,
      status,
      requested_at,
      started_at
    ) VALUES (?, ?, ?, ?, ?)
    `,
    runId,
    params.trigger,
    "RUNNING",
    params.requestedAt,
    params.startedAt,
  );
  return runId;
}

export async function completeRdsSyncRunLogSuccess(params: {
  runId: string;
  completedAt: Date;
  durationMs: number;
  message: string;
  syncSummary: RdsSyncSummary;
  stdoutTail: string[];
  stderrTail: string[];
}) {
  const summary = normalizeSummary(params.syncSummary);
  await prisma.$executeRawUnsafe(
    `
    UPDATE rds_sync_logs
    SET
      status = ?,
      completed_at = ?,
      duration_ms = ?,
      message = ?,
      inserted_applications_count = ?,
      inserted_questions_count = ?,
      inserted_answers_count = ?,
      inserted_application_ids = ?,
      inserted_question_ids = ?,
      inserted_answer_ids = ?,
      stdout_tail = ?,
      stderr_tail = ?,
      error_code = NULL,
      error_signal = NULL
    WHERE run_id = ?
    `,
    "SUCCESS",
    params.completedAt,
    params.durationMs,
    params.message,
    summary.applications.count,
    summary.questions.count,
    summary.answers.count,
    serializeStringArray(summary.applications.ids),
    serializeStringArray(summary.questions.ids),
    serializeStringArray(summary.answers.ids),
    serializeStringArray(params.stdoutTail),
    serializeStringArray(params.stderrTail),
    params.runId,
  );
}

export async function completeRdsSyncRunLogFailure(params: {
  runId: string;
  completedAt: Date;
  durationMs: number;
  message: string;
  syncSummary: RdsSyncSummary;
  stdoutTail: string[];
  stderrTail: string[];
  errorCode: string | null;
  errorSignal: string | null;
}) {
  const summary = normalizeSummary(params.syncSummary);
  await prisma.$executeRawUnsafe(
    `
    UPDATE rds_sync_logs
    SET
      status = ?,
      completed_at = ?,
      duration_ms = ?,
      message = ?,
      inserted_applications_count = ?,
      inserted_questions_count = ?,
      inserted_answers_count = ?,
      inserted_application_ids = ?,
      inserted_question_ids = ?,
      inserted_answer_ids = ?,
      stdout_tail = ?,
      stderr_tail = ?,
      error_code = ?,
      error_signal = ?
    WHERE run_id = ?
    `,
    "FAILED",
    params.completedAt,
    params.durationMs,
    params.message,
    summary.applications.count,
    summary.questions.count,
    summary.answers.count,
    serializeStringArray(summary.applications.ids),
    serializeStringArray(summary.questions.ids),
    serializeStringArray(summary.answers.ids),
    serializeStringArray(params.stdoutTail),
    serializeStringArray(params.stderrTail),
    params.errorCode,
    params.errorSignal,
    params.runId,
  );
}

export async function listRdsSyncRunLogs(limit = 10): Promise<RdsSyncLogItem[]> {
  await ensureRdsSyncLogTable();
  const safeLimit = Math.max(1, Math.min(100, limit));
  const rows = await prisma.$queryRawUnsafe<RdsSyncLogRawRow[]>(
    `
    SELECT
      run_id,
      \`trigger\` AS \`trigger\`,
      status,
      requested_at,
      started_at,
      completed_at,
      duration_ms,
      message,
      inserted_applications_count,
      inserted_questions_count,
      inserted_answers_count,
      inserted_application_ids,
      inserted_question_ids,
      inserted_answer_ids,
      stdout_tail,
      stderr_tail,
      error_code,
      error_signal
    FROM rds_sync_logs
    ORDER BY requested_at DESC
    LIMIT ${safeLimit}
    `,
  );
  return rows.map(mapRawRowToLogItem);
}

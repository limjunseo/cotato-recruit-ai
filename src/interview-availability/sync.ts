import { prisma } from "@/lib/prisma";
import { createStrictAvailabilityLlmNormalizer, isInterviewAvailabilityLlmEnabled } from "@/interview-availability/llm-normalizer";
import { ensureInterviewAvailabilityNormalizationTable } from "@/interview-availability/normalization-table";
import {
  buildTextPropertyValue,
  findPropertyByAliases,
  getDatabaseSchema,
  notionRequest,
} from "@/notion/api";
import { getInterviewNotionConfig } from "@/notion/config";
import type { NotionDatabase } from "@/notion/types";
import type { PartType, PassStatus } from "@/types/application";

type SyncInterviewAvailabilityOptions = {
  generationId?: string;
  useLlm?: boolean;
};

const TARGET_PASS_STATUSES: PassStatus[] = ["PASS", "WAITLISTED"];
type AvailabilityTextNormalizer = (rawText: string) => Promise<string>;

type SyncInterviewAvailabilityLogLevel = "INFO" | "SUCCESS" | "ERROR";

export type SyncInterviewAvailabilityLog = {
  timestamp: string;
  level: SyncInterviewAvailabilityLogLevel;
  message: string;
  applicationId: string | null;
  part: PartType | null;
  name: string | null;
};

export type SyncInterviewAvailabilityResult = {
  message: string;
  generationId: string | null;
  llmEnabled: boolean;
  totalApplicants: number;
  candidates: number;
  skippedAlreadySynced: number;
  success: number;
  failed: number;
  logs: SyncInterviewAvailabilityLog[];
};

export type SyncInterviewAvailabilityStatsResult = {
  generationId: string | null;
  totalApplicants: number;
  candidates: number;
  alreadySynced: number;
  pendingSync: number;
};

type NotionPropertyRef = {
  key: string;
  type: string;
};

type NotionSchemaCacheItem = {
  token: string;
  databaseId: string;
  properties: NotionDatabase["properties"];
  titlePropertyName: string;
  phoneProperty: NotionPropertyRef | null;
  passStatusProperty: NotionPropertyRef | null;
  unavailableTimeProperty: NotionPropertyRef;
  llmFilteredUnavailableTimeProperty: NotionPropertyRef | null;
};

type SyncCandidate = {
  applicationId: bigint;
  part: PartType;
  name: string;
  phoneNumber: string | null;
  passStatus: PassStatus | null;
  sourceText: string;
  existing: {
    source_text: string;
    normalized_text: string | null;
    status: "PENDING" | "SUCCESS" | "FAILED";
    synced_at: Date | null;
  } | null;
};

const PHONE_PROPERTY_ALIASES = [
  "연락처",
  "전화번호",
  "휴대폰",
  "phone",
  "phonenumber",
  "contact",
];

const PASS_STATUS_PROPERTY_ALIASES = [
  "합격여부",
  "합격상태",
  "passstatus",
  "status",
];

const UNAVAILABLE_TIME_PROPERTY_ALIASES = [
  "불가능한 시간",
  "불가능한시간",
  "면접불가능시간",
  "unavailableinterviewtimes",
  "unavailabletime",
  "unavailable",
];

const LLM_FILTERED_UNAVAILABLE_TIME_PROPERTY_ALIASES = [
  "llm 불가능한 시간 필터링",
  "llm불가능한시간필터링",
  "llm 불가능한 시간",
  "llm불가능한시간",
  "llm unavailable",
];

const PASS_STATUS_LOCALIZED_MAP: Record<PassStatus, string[]> = {
  PASS: ["합격", "최종합격"],
  FAIL: ["불합격"],
  PENDING: ["대기", "보류"],
  WAITLISTED: ["예비합격", "예비", "후보"],
};

function normalizeSourceText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeName(value: string | null | undefined, applicationId: bigint) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : `Applicant #${applicationId.toString()}`;
}

function normalizeGenerationId(value?: string) {
  const generationId = value?.trim() ?? "";
  return generationId && /^\d+$/.test(generationId) ? generationId : "";
}

function hasReusableLlmNormalization(candidate: SyncCandidate) {
  const existing = candidate.existing;
  return Boolean(
    existing &&
      existing.status === "SUCCESS" &&
      existing.source_text === candidate.sourceText &&
      existing.normalized_text !== null,
  );
}

async function applyLlmNormalization(candidate: SyncCandidate, normalizeByLlm: AvailabilityTextNormalizer) {
  if (hasReusableLlmNormalization(candidate)) {
    return candidate;
  }

  const normalized = await normalizeByLlm(candidate.sourceText);
  const nextSyncedAt = candidate.existing?.synced_at ?? null;

  await prisma.interviewAvailabilityNormalization.upsert({
    where: { application_id: candidate.applicationId },
    update: {
      source_text: candidate.sourceText,
      normalized_text: normalized,
      status: "SUCCESS",
      synced_at: nextSyncedAt,
      last_error: null,
    },
    create: {
      application_id: candidate.applicationId,
      source_text: candidate.sourceText,
      normalized_text: normalized,
      status: "SUCCESS",
      synced_at: nextSyncedAt,
      last_error: null,
    },
  });

  return {
    ...candidate,
    existing: {
      source_text: candidate.sourceText,
      normalized_text: normalized,
      status: "SUCCESS",
      synced_at: nextSyncedAt,
    },
  };
}

function buildSyncLog(
  level: SyncInterviewAvailabilityLogLevel,
  message: string,
  candidate?: Pick<SyncCandidate, "applicationId" | "part" | "name">,
): SyncInterviewAvailabilityLog {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    applicationId: candidate ? candidate.applicationId.toString() : null,
    part: candidate?.part ?? null,
    name: candidate?.name?.trim() || null,
  };
}

function candidateLabel(candidate: Pick<SyncCandidate, "applicationId" | "part" | "name">) {
  const normalizedName = normalizeName(candidate.name, candidate.applicationId);
  return `#${candidate.applicationId.toString()} ${normalizedName} (${candidate.part})`;
}

function extractOptionNames(
  property: NotionDatabase["properties"][string],
  type: "status" | "select",
) {
  const container = (property as { status?: unknown; select?: unknown })[type] as
    | { options?: Array<{ name?: unknown }> }
    | undefined;

  if (!container || !Array.isArray(container.options)) {
    return [];
  }

  return container.options
    .map((option) => (typeof option?.name === "string" ? option.name : ""))
    .filter((name) => name.length > 0);
}

function buildPassStatusCandidates(passStatus: PassStatus | null) {
  if (!passStatus) return [];
  const localized = PASS_STATUS_LOCALIZED_MAP[passStatus] ?? [];
  return [passStatus, ...localized];
}

function findMatchingOptionName(candidates: string[], options: string[]) {
  const normalized = new Map(options.map((option) => [option.trim().toLowerCase(), option]));
  for (const candidate of candidates) {
    const matched = normalized.get(candidate.trim().toLowerCase());
    if (matched) return matched;
  }
  return null;
}

function resolvePassStatusText(
  passStatus: PassStatus | null,
  propertyRef: NotionPropertyRef,
  properties: NotionDatabase["properties"],
) {
  const candidates = buildPassStatusCandidates(passStatus);
  if (candidates.length === 0) return null;

  const property = properties[propertyRef.key];
  if (!property) return passStatus;

  if (propertyRef.type === "status") {
    const options = extractOptionNames(property, "status");
    const matched = findMatchingOptionName(candidates, options);
    return matched;
  }

  if (propertyRef.type === "select") {
    const options = extractOptionNames(property, "select");
    const matched = findMatchingOptionName(candidates, options);
    return matched ?? candidates[0];
  }

  return candidates[0];
}

function buildNotionProperties(candidate: SyncCandidate, schema: NotionSchemaCacheItem) {
  const properties: Record<string, unknown> = {};

  properties[schema.titlePropertyName] = {
    title: [{ type: "text", text: { content: normalizeName(candidate.name, candidate.applicationId) } }],
  };

  if (schema.phoneProperty && schema.phoneProperty.key !== schema.titlePropertyName) {
    const value = buildTextPropertyValue(schema.phoneProperty.type, normalizePhone(candidate.phoneNumber));
    if (value) {
      properties[schema.phoneProperty.key] = value;
    }
  }

  if (schema.passStatusProperty && schema.passStatusProperty.key !== schema.titlePropertyName) {
    const passStatusText = resolvePassStatusText(candidate.passStatus, schema.passStatusProperty, schema.properties);
    const value = buildTextPropertyValue(schema.passStatusProperty.type, passStatusText);
    if (value) {
      properties[schema.passStatusProperty.key] = value;
    }
  }

  const unavailableValue = buildTextPropertyValue(schema.unavailableTimeProperty.type, candidate.sourceText);
  if (!unavailableValue) {
    throw new Error(
      `Unsupported Notion property type for unavailable interview time: ${schema.unavailableTimeProperty.type}`,
    );
  }
  properties[schema.unavailableTimeProperty.key] = unavailableValue;

  if (
    schema.llmFilteredUnavailableTimeProperty &&
    schema.llmFilteredUnavailableTimeProperty.key !== schema.titlePropertyName
  ) {
    const llmValue = buildTextPropertyValue(
      schema.llmFilteredUnavailableTimeProperty.type,
      candidate.existing?.normalized_text ?? null,
    );
    if (llmValue) {
      properties[schema.llmFilteredUnavailableTimeProperty.key] = llmValue;
    }
  }

  return properties;
}

const notionSchemaCache = new Map<PartType, Promise<NotionSchemaCacheItem>>();

async function getNotionSchema(part: PartType): Promise<NotionSchemaCacheItem> {
  const cached = notionSchemaCache.get(part);
  if (cached) {
    return cached;
  }

  const loading = (async () => {
    const notionConfig = getInterviewNotionConfig(part);
    const database = await getDatabaseSchema(notionConfig.token, notionConfig.databaseId);
    const titleProperty = Object.entries(database.properties).find(([, value]) => value.type === "title");

    if (!titleProperty) {
      throw new Error(`No title property found in Notion database for part=${part}.`);
    }

    const [titlePropertyName] = titleProperty;
    const unavailableTimeProperty = findPropertyByAliases(database.properties, UNAVAILABLE_TIME_PROPERTY_ALIASES);

    if (!unavailableTimeProperty) {
      throw new Error(`Unavailable interview time property not found in Notion database for part=${part}.`);
    }

    return {
      token: notionConfig.token,
      databaseId: notionConfig.databaseId,
      properties: database.properties,
      titlePropertyName,
      phoneProperty: findPropertyByAliases(database.properties, PHONE_PROPERTY_ALIASES),
      passStatusProperty: findPropertyByAliases(database.properties, PASS_STATUS_PROPERTY_ALIASES),
      unavailableTimeProperty,
      llmFilteredUnavailableTimeProperty: findPropertyByAliases(
        database.properties,
        LLM_FILTERED_UNAVAILABLE_TIME_PROPERTY_ALIASES,
      ),
    };
  })();

  notionSchemaCache.set(part, loading);
  return loading;
}

async function markSyncSuccess(candidate: SyncCandidate, syncedAt: Date) {
  const hasExisting = Boolean(candidate.existing);
  const hasLlmNormalizedText = hasExisting && candidate.existing?.normalized_text !== null;

  if (!hasExisting) {
    await prisma.interviewAvailabilityNormalization.create({
      data: {
        application_id: candidate.applicationId,
        source_text: candidate.sourceText,
        normalized_text: null,
        status: "SUCCESS",
        synced_at: syncedAt,
        last_error: null,
      },
    });
    return;
  }

  await prisma.interviewAvailabilityNormalization.update({
    where: { application_id: candidate.applicationId },
    data: hasLlmNormalizedText
      ? {
          synced_at: syncedAt,
          last_error: null,
        }
      : {
          source_text: candidate.sourceText,
          status: "SUCCESS",
          synced_at: syncedAt,
          last_error: null,
        },
  });
}

async function markSyncFailure(candidate: SyncCandidate, message: string) {
  const hasExisting = Boolean(candidate.existing);
  const hasLlmNormalizedText = hasExisting && candidate.existing?.normalized_text !== null;

  if (!hasExisting) {
    await prisma.interviewAvailabilityNormalization.create({
      data: {
        application_id: candidate.applicationId,
        source_text: candidate.sourceText,
        normalized_text: null,
        status: "FAILED",
        synced_at: null,
        last_error: message,
      },
    });
    return;
  }

  await prisma.interviewAvailabilityNormalization.update({
    where: { application_id: candidate.applicationId },
    data: hasLlmNormalizedText
      ? {
          synced_at: null,
          last_error: message,
        }
      : {
          source_text: candidate.sourceText,
          status: "FAILED",
          synced_at: null,
          last_error: message,
        },
  });
}

async function syncCandidateToNotion(candidate: SyncCandidate) {
  const schema = await getNotionSchema(candidate.part);
  const properties = buildNotionProperties(candidate, schema);

  await notionRequest<{ id: string; url: string }>(schema.token, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: schema.databaseId },
      properties,
    }),
  });
}

async function loadSyncRows(normalizedGenerationId: string) {
  return prisma.application.findMany({
    where: {
      pass_status: { in: TARGET_PASS_STATUSES },
      ...(normalizedGenerationId ? { generation_id: BigInt(normalizedGenerationId) } : {}),
    },
    select: {
      application_id: true,
      application_part_type: true,
      name: true,
      phone_number: true,
      pass_status: true,
      unavailable_interview_times: true,
      interview_availability_normalization: {
        select: {
          source_text: true,
          normalized_text: true,
          status: true,
          synced_at: true,
        },
      },
    },
    orderBy: [{ generation_id: "asc" }, { application_id: "asc" }],
  });
}

async function loadSyncRowByApplicationId(applicationId: bigint) {
  return prisma.application.findUnique({
    where: { application_id: applicationId },
    select: {
      application_id: true,
      application_part_type: true,
      name: true,
      phone_number: true,
      pass_status: true,
      unavailable_interview_times: true,
      interview_availability_normalization: {
        select: {
          source_text: true,
          normalized_text: true,
          status: true,
          synced_at: true,
        },
      },
    },
  });
}

function buildSyncCandidates(rows: Awaited<ReturnType<typeof loadSyncRows>>): SyncCandidate[] {
  return rows
    .map((row) => ({
      applicationId: row.application_id,
      part: row.application_part_type as PartType,
      name: row.name,
      phoneNumber: row.phone_number,
      passStatus: (row.pass_status as PassStatus | null) ?? null,
      sourceText: normalizeSourceText(row.unavailable_interview_times),
      existing: row.interview_availability_normalization,
    }))
    .filter((row): row is SyncCandidate => row.sourceText !== null);
}

export async function syncInterviewAvailabilityCandidateByApplicationId(applicationId: bigint): Promise<{
  syncedAt: string;
}> {
  await ensureInterviewAvailabilityNormalizationTable();

  const row = await loadSyncRowByApplicationId(applicationId);
  if (!row) {
    throw new Error("Application not found.");
  }

  const sourceText = normalizeSourceText(row.unavailable_interview_times);
  if (!sourceText) {
    throw new Error("No unavailable interview times text found for this applicant.");
  }

  const candidate: SyncCandidate = {
    applicationId: row.application_id,
    part: row.application_part_type as PartType,
    name: row.name,
    phoneNumber: row.phone_number,
    passStatus: (row.pass_status as PassStatus | null) ?? null,
    sourceText,
    existing: row.interview_availability_normalization,
  };

  try {
    await syncCandidateToNotion(candidate);
    const syncedAt = new Date();
    await markSyncSuccess(candidate, syncedAt);
    return { syncedAt: syncedAt.toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markSyncFailure(candidate, message);
    throw new Error(message);
  }
}

export async function getInterviewAvailabilitySyncStats(
  options: SyncInterviewAvailabilityOptions = {},
): Promise<SyncInterviewAvailabilityStatsResult> {
  await ensureInterviewAvailabilityNormalizationTable();

  const normalizedGenerationId = normalizeGenerationId(options.generationId);
  const rows = await loadSyncRows(normalizedGenerationId);
  const candidates = buildSyncCandidates(rows);
  const alreadySynced = candidates.filter((candidate) => Boolean(candidate.existing?.synced_at)).length;
  const pendingSync = candidates.length - alreadySynced;

  return {
    generationId: normalizedGenerationId || null,
    totalApplicants: rows.length,
    candidates: candidates.length,
    alreadySynced,
    pendingSync,
  };
}

export async function syncInterviewAvailability(options: SyncInterviewAvailabilityOptions = {}): Promise<SyncInterviewAvailabilityResult> {
  await ensureInterviewAvailabilityNormalizationTable();

  const normalizedGenerationId = normalizeGenerationId(options.generationId);
  const useLlm = Boolean(options.useLlm);
  const logs: SyncInterviewAvailabilityLog[] = [];

  logs.push(
    buildSyncLog(
      "INFO",
      `Interview time sync started. generationId=${normalizedGenerationId || "ALL"}, llm=${useLlm ? "ON" : "OFF"}`,
    ),
  );

  let normalizeByLlm: AvailabilityTextNormalizer | null = null;
  if (useLlm) {
    if (!isInterviewAvailabilityLlmEnabled()) {
      throw new Error("Interview availability LLM normalizer is disabled by environment flag.");
    }
    normalizeByLlm = createStrictAvailabilityLlmNormalizer();
    logs.push(buildSyncLog("INFO", "LLM normalization enabled for this sync run."));
  }

  const rows = await loadSyncRows(normalizedGenerationId);
  const candidates = buildSyncCandidates(rows);

  const targets = candidates.filter((row) => !row.existing?.synced_at);

  const skippedAlreadySynced = candidates.length - targets.length;
  let success = 0;
  let failed = 0;

  logs.push(buildSyncLog("INFO", `Loaded ${rows.length} applicants from DB.`));
  logs.push(buildSyncLog("INFO", `Candidates with unavailable interview text: ${candidates.length}.`));
  logs.push(
    buildSyncLog(
      "INFO",
      `Sync targets: ${targets.length}, skipped(already synced): ${skippedAlreadySynced}.`,
    ),
  );

  if (targets.length === 0) {
    logs.push(buildSyncLog("INFO", "No targets to sync."));
  }

  for (const target of targets) {
    let preparedTarget = target;
    logs.push(buildSyncLog("INFO", `Syncing ${candidateLabel(preparedTarget)} to Notion...`, preparedTarget));

    try {
      if (normalizeByLlm) {
        preparedTarget = await applyLlmNormalization(preparedTarget, normalizeByLlm);
      }

      await syncCandidateToNotion(preparedTarget);
      await markSyncSuccess(preparedTarget, new Date());

      success += 1;
      logs.push(buildSyncLog("SUCCESS", `Synced ${candidateLabel(preparedTarget)}.`, preparedTarget));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markSyncFailure(preparedTarget, message);

      failed += 1;
      logs.push(buildSyncLog("ERROR", `Failed ${candidateLabel(preparedTarget)}: ${message}`, preparedTarget));
    }
  }

  logs.push(
    buildSyncLog(
      "INFO",
      `Sync completed. success=${success}, failed=${failed}, skipped=${skippedAlreadySynced}.`,
    ),
  );

  return {
    message: `Interview time sync to Notion completed: ${success} success, ${failed} failed, ${skippedAlreadySynced} skipped.`,
    generationId: normalizedGenerationId || null,
    llmEnabled: useLlm,
    totalApplicants: rows.length,
    candidates: candidates.length,
    skippedAlreadySynced,
    success,
    failed,
    logs,
  };
}

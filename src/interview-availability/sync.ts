import { prisma } from "@/lib/prisma";
import { createStrictAvailabilityLlmNormalizer, isInterviewAvailabilityLlmEnabled } from "@/interview-availability/llm-normalizer";
import { ensureInterviewAvailabilityNormalizationTable } from "@/interview-availability/normalization-table";

type SyncInterviewAvailabilityOptions = {
  generationId?: string;
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
};

function normalizeSourceText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function syncInterviewAvailability(options: SyncInterviewAvailabilityOptions = {}): Promise<SyncInterviewAvailabilityResult> {
  await ensureInterviewAvailabilityNormalizationTable();

  const generationId = options.generationId?.trim() ?? "";
  const normalizedGenerationId = generationId && /^\d+$/.test(generationId) ? generationId : "";
  const llmEnabled = isInterviewAvailabilityLlmEnabled();

  const rows = await prisma.application.findMany({
    where: {
      ...(normalizedGenerationId ? { generation_id: BigInt(normalizedGenerationId) } : {}),
    },
    select: {
      application_id: true,
      unavailable_interview_times: true,
      interview_availability_normalization: {
        select: {
          source_text: true,
          normalized_text: true,
          status: true,
        },
      },
    },
    orderBy: [{ generation_id: "asc" }, { application_id: "asc" }],
  });

  const candidates = rows
    .map((row) => ({
      applicationId: row.application_id,
      sourceText: normalizeSourceText(row.unavailable_interview_times),
      existing: row.interview_availability_normalization,
    }))
    .filter((row) => row.sourceText !== null);

  const targets = candidates.filter((row) => {
    if (!row.sourceText) return false;
    if (!row.existing) return true;

    const isAlreadySynced =
      row.existing.status === "SUCCESS" &&
      row.existing.source_text === row.sourceText &&
      row.existing.normalized_text !== null;

    return !isAlreadySynced;
  });

  const skippedAlreadySynced = candidates.length - targets.length;
  if (!llmEnabled) {
    return {
      message: "Interview time sync skipped. LLM normalizer is disabled.",
      generationId: normalizedGenerationId || null,
      llmEnabled: false,
      totalApplicants: rows.length,
      candidates: candidates.length,
      skippedAlreadySynced,
      success: 0,
      failed: 0,
    };
  }

  const normalizeByLlm = createStrictAvailabilityLlmNormalizer();
  let success = 0;
  let failed = 0;

  for (const target of targets) {
    if (!target.sourceText) continue;

    try {
      const normalizedText = await normalizeByLlm(target.sourceText);

      await prisma.interviewAvailabilityNormalization.upsert({
        where: { application_id: target.applicationId },
        update: {
          source_text: target.sourceText,
          normalized_text: normalizedText,
          status: "SUCCESS",
          synced_at: new Date(),
          last_error: null,
        },
        create: {
          application_id: target.applicationId,
          source_text: target.sourceText,
          normalized_text: normalizedText,
          status: "SUCCESS",
          synced_at: new Date(),
          last_error: null,
        },
      });

      success += 1;
    } catch (error) {
      await prisma.interviewAvailabilityNormalization.upsert({
        where: { application_id: target.applicationId },
        update: {
          source_text: target.sourceText,
          normalized_text: null,
          status: "FAILED",
          synced_at: null,
          last_error: error instanceof Error ? error.message : String(error),
        },
        create: {
          application_id: target.applicationId,
          source_text: target.sourceText,
          normalized_text: null,
          status: "FAILED",
          synced_at: null,
          last_error: error instanceof Error ? error.message : String(error),
        },
      });

      failed += 1;
    }
  }

  return {
    message: `Interview time sync completed: ${success} success, ${failed} failed, ${skippedAlreadySynced} skipped.`,
    generationId: normalizedGenerationId || null,
    llmEnabled: true,
    totalApplicants: rows.length,
    candidates: candidates.length,
    skippedAlreadySynced,
    success,
    failed,
  };
}

import { NextResponse } from "next/server";
import { createStrictAvailabilityLlmNormalizer, isInterviewAvailabilityLlmEnabled } from "@/interview-availability/llm-normalizer";
import { ensureInterviewAvailabilityNormalizationTable } from "@/interview-availability/normalization-table";
import { syncInterviewAvailabilityCandidateByApplicationId } from "@/interview-availability/sync";
import { prisma } from "@/lib/prisma";

type ParamsContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

function normalizeSourceText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(_: Request, context: ParamsContext) {
  const { id } = await context.params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: "Invalid application_id." }, { status: 400 });
  }

  await ensureInterviewAvailabilityNormalizationTable();

  const applicationId = BigInt(id);
  const row = await prisma.application.findUnique({
    where: { application_id: applicationId },
    select: {
      application_id: true,
      unavailable_interview_times: true,
      interview_availability_normalization: {
        select: {
          source_text: true,
          normalized_text: true,
          status: true,
          synced_at: true,
          last_error: true,
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ message: "Application not found." }, { status: 404 });
  }

  const input = normalizeSourceText(row.unavailable_interview_times);
  if (!input) {
    return NextResponse.json({ message: "No unavailable interview times text found for this applicant." }, { status: 400 });
  }

  const existing = row.interview_availability_normalization;
  const hasReusableNormalization =
    existing?.status === "SUCCESS" && existing.source_text === input && existing.normalized_text !== null;
  const isAlreadySyncedToNotion = hasReusableNormalization && existing.synced_at !== null;

  if (isAlreadySyncedToNotion) {
    return NextResponse.json({
      applicationId: row.application_id.toString(),
      input,
      output: existing.normalized_text,
      status: existing.status,
      syncedAt: existing.synced_at ? existing.synced_at.toISOString() : null,
      lastError: existing.last_error,
      skipped: true,
    });
  }

  let output = existing?.normalized_text ?? null;
  let skipped = false;

  if (hasReusableNormalization) {
    skipped = true;
  } else {
    if (!isInterviewAvailabilityLlmEnabled()) {
      return NextResponse.json(
        { message: "Interview availability LLM normalizer is disabled by environment flag." },
        { status: 400 },
      );
    }

    const normalizeByLlm = createStrictAvailabilityLlmNormalizer();

    try {
      output = await normalizeByLlm(input);

      await prisma.interviewAvailabilityNormalization.upsert({
        where: { application_id: applicationId },
        update: {
          source_text: input,
          normalized_text: output,
          status: "SUCCESS",
          synced_at: null,
          last_error: null,
        },
        create: {
          application_id: applicationId,
          source_text: input,
          normalized_text: output,
          status: "SUCCESS",
          synced_at: null,
          last_error: null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await prisma.interviewAvailabilityNormalization.upsert({
        where: { application_id: applicationId },
        update: {
          source_text: input,
          normalized_text: null,
          status: "FAILED",
          synced_at: null,
          last_error: message,
        },
        create: {
          application_id: applicationId,
          source_text: input,
          normalized_text: null,
          status: "FAILED",
          synced_at: null,
          last_error: message,
        },
      });

      return NextResponse.json(
        {
          message,
          applicationId: row.application_id.toString(),
          input,
          output: null,
          status: "FAILED",
          syncedAt: null,
          lastError: message,
          skipped: false,
        },
        { status: 500 },
      );
    }
  }

  try {
    const synced = await syncInterviewAvailabilityCandidateByApplicationId(applicationId);

    return NextResponse.json({
      applicationId: row.application_id.toString(),
      input,
      output,
      status: "SUCCESS",
      syncedAt: synced.syncedAt,
      lastError: null,
      skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        message,
        applicationId: row.application_id.toString(),
        input,
        output,
        status: "SUCCESS",
        syncedAt: null,
        lastError: message,
        skipped,
      },
      { status: 500 },
    );
  }
}

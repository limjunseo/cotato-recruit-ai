import { prisma } from "@/lib/prisma";
import { ensureInterviewAvailabilityNormalizationTable } from "@/interview-availability/normalization-table";
import type { PartType } from "@/types/application";

export type AvailabilityApplicantRecord = {
  applicationId: bigint;
  part: PartType;
  name: string | null;
  unavailableInterviewTimes: string | null;
};

export async function fetchAvailabilityApplicants(generationId?: string): Promise<AvailabilityApplicantRecord[]> {
  await ensureInterviewAvailabilityNormalizationTable();

  const rows = await prisma.application.findMany({
    where: {
      ...(generationId && /^\d+$/.test(generationId) ? { generation_id: BigInt(generationId) } : {}),
    },
    select: {
      application_id: true,
      application_part_type: true,
      name: true,
      unavailable_interview_times: true,
      interview_availability_normalization: {
        select: {
          source_text: true,
          normalized_text: true,
          status: true,
        },
      },
    },
    orderBy: [{ application_part_type: "asc" }, { application_id: "asc" }],
  });

  return rows.map((row) => ({
    // Use cached LLM-normalized text only when it is synced from the current source text.
    applicationId: row.application_id,
    part: row.application_part_type as PartType,
    name: row.name,
    unavailableInterviewTimes:
      row.interview_availability_normalization?.status === "SUCCESS" &&
      row.interview_availability_normalization.source_text === (row.unavailable_interview_times?.trim() ?? "") &&
      row.interview_availability_normalization.normalized_text !== null
        ? row.interview_availability_normalization.normalized_text
        : row.unavailable_interview_times ?? null,
  }));
}

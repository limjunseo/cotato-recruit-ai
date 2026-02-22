import { prisma } from "@/lib/prisma";
import type { PartType } from "@/types/application";

export type AvailabilityApplicantRecord = {
  applicationId: bigint;
  part: PartType;
  name: string | null;
  unavailableInterviewTimes: string | null;
};

export async function fetchAvailabilityApplicants(generationId?: string): Promise<AvailabilityApplicantRecord[]> {
  const rows = await prisma.application.findMany({
    where: {
      ...(generationId && /^\d+$/.test(generationId) ? { generation_id: BigInt(generationId) } : {}),
    },
    select: {
      application_id: true,
      application_part_type: true,
      name: true,
      unavailable_interview_times: true,
    },
    orderBy: [{ application_part_type: "asc" }, { application_id: "asc" }],
  });

  return rows.map((row) => ({
    applicationId: row.application_id,
    part: row.application_part_type as PartType,
    name: row.name,
    unavailableInterviewTimes: row.unavailable_interview_times ?? null,
  }));
}

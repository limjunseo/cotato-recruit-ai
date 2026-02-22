import { BOARD_SLOT_INDICES, INTERVIEW_DAYS, SLOT_MINUTES } from "@/interview-availability/constants";
import { parseTextToUnavailableSlots } from "@/interview-availability/parser";
import { fetchAvailabilityApplicants } from "@/interview-availability/repository";
import { slotKey, buildSlots } from "@/interview-availability/slots";
import { createInitialPartStateMap } from "@/interview-availability/state";
import { buildPartTable, normalizeApplicantName } from "@/interview-availability/table-builder";
import { PART_TYPES, type PartType } from "@/types/application";
import type { InterviewAvailabilityPartTable, InterviewAvailabilityResponse } from "@/types/interview-availability";

type AvailabilityQueryOptions = {
  generationId?: string;
};

export async function getInterviewAvailability(options: AvailabilityQueryOptions = {}): Promise<InterviewAvailabilityResponse> {
  const generationId = options.generationId?.trim() ?? "";
  const applicants = await fetchAvailabilityApplicants(generationId);

  const partStateMap = createInitialPartStateMap();
  let unavailabilityDetectedCount = 0;

  for (const applicant of applicants) {
    const applicantName = normalizeApplicantName(applicant.name, applicant.applicationId);
    const unavailableSlots = new Set<string>();
    const unavailableInterviewTimes = applicant.unavailableInterviewTimes?.trim() ?? "";

    if (unavailableInterviewTimes.length > 0) {
      parseTextToUnavailableSlots(unavailableInterviewTimes, unavailableSlots);
    }

    if (unavailableSlots.size > 0) {
      unavailabilityDetectedCount += 1;
    }

    const partState = partStateMap[applicant.part];
    partState.applicantCount += 1;

    for (const day of INTERVIEW_DAYS) {
      const dayCells = partState.dayCellNames[day.key];
      for (let displaySlotIndex = 0; displaySlotIndex < BOARD_SLOT_INDICES.length; displaySlotIndex += 1) {
        const absoluteSlotIndex = BOARD_SLOT_INDICES[displaySlotIndex];
        if (!unavailableSlots.has(slotKey(day.key, absoluteSlotIndex))) {
          dayCells[displaySlotIndex].push(applicantName);
        }
      }
    }
  }

  const parts = PART_TYPES.reduce<Record<PartType, InterviewAvailabilityPartTable>>((acc, part) => {
    acc[part] = buildPartTable(part, partStateMap[part]);
    return acc;
  }, {} as Record<PartType, InterviewAvailabilityPartTable>);

  return {
    generatedAt: new Date().toISOString(),
    slotMinutes: SLOT_MINUTES,
    totalApplicantCount: applicants.length,
    unavailabilityDetectedCount,
    days: INTERVIEW_DAYS.map((day) => ({ key: day.key, label: day.label, weekday: day.weekday })),
    slots: buildSlots(),
    parts,
  };
}

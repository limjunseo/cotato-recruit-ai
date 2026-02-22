import { INTERVIEW_DAYS } from "@/interview-availability/constants";
import type { MutablePartState } from "@/interview-availability/state";
import type { PartType } from "@/types/application";
import type {
  InterviewAvailabilityCell,
  InterviewAvailabilityDayColumn,
  InterviewAvailabilityPartTable,
} from "@/types/interview-availability";

export function buildPartTable(part: PartType, state: MutablePartState): InterviewAvailabilityPartTable {
  const dayColumns: InterviewAvailabilityDayColumn[] = INTERVIEW_DAYS.map((day) => {
    const cells: InterviewAvailabilityCell[] = state.dayCellNames[day.key].map((names) => {
      const sortedNames = [...names].sort((left, right) => left.localeCompare(right, "ko-KR"));
      return {
        availableCount: sortedNames.length,
        availableNames: sortedNames,
      };
    });
    return {
      dayKey: day.key,
      cells,
    };
  });

  const maxAvailableCount = dayColumns.reduce((maxCount, dayColumn) => {
    const dayMax = dayColumn.cells.reduce((innerMax, cell) => Math.max(innerMax, cell.availableCount), 0);
    return Math.max(maxCount, dayMax);
  }, 0);

  return {
    part,
    applicantCount: state.applicantCount,
    maxAvailableCount,
    dayColumns,
  };
}

export function normalizeApplicantName(name: string | null, applicationId: bigint) {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  return `지원자 #${applicationId.toString()}`;
}

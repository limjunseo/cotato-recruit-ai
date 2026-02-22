import { PART_TYPES, type PartType } from "@/types/application";
import { BOARD_SLOT_INDICES, INTERVIEW_DAYS } from "@/interview-availability/constants";

export type MutablePartState = {
  applicantCount: number;
  dayCellNames: Record<string, string[][]>;
};

function createInitialPartState(): MutablePartState {
  const dayCellNames = Object.fromEntries(
    INTERVIEW_DAYS.map((day) => [day.key, Array.from({ length: BOARD_SLOT_INDICES.length }, () => [] as string[])]),
  );

  return {
    applicantCount: 0,
    dayCellNames,
  };
}

export function createInitialPartStateMap() {
  return PART_TYPES.reduce<Record<PartType, MutablePartState>>((acc, part) => {
    acc[part] = createInitialPartState();
    return acc;
  }, {} as Record<PartType, MutablePartState>);
}

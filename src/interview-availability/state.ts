import { PART_TYPES, type PartType } from "@/types/application";
import { INTERVIEW_DAYS, SLOTS_PER_DAY } from "@/interview-availability/constants";

export type MutablePartState = {
  applicantCount: number;
  dayCellNames: Record<string, string[][]>;
};

function createInitialPartState(): MutablePartState {
  const dayCellNames = Object.fromEntries(
    INTERVIEW_DAYS.map((day) => [day.key, Array.from({ length: SLOTS_PER_DAY }, () => [] as string[])]),
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

import type { PartType } from "@/types/application";

export type InterviewDay = {
  key: string;
  label: string;
  weekday: string;
};

export type InterviewTimeSlot = {
  slotIndex: number;
  label: string;
  startMinute: number;
  endMinute: number;
};

export type InterviewAvailabilityCell = {
  availableCount: number;
  availableNames: string[];
};

export type InterviewAvailabilityDayColumn = {
  dayKey: string;
  cells: InterviewAvailabilityCell[];
};

export type InterviewAvailabilityPartTable = {
  part: PartType;
  applicantCount: number;
  maxAvailableCount: number;
  dayColumns: InterviewAvailabilityDayColumn[];
};

export type InterviewAvailabilityResponse = {
  generatedAt: string;
  slotMinutes: number;
  totalApplicantCount: number;
  unavailabilityDetectedCount: number;
  days: InterviewDay[];
  slots: InterviewTimeSlot[];
  parts: Record<PartType, InterviewAvailabilityPartTable>;
};

export const INTERVIEW_PART_TAB_ORDER: readonly PartType[] = ["PM", "DE", "BE", "FE"];

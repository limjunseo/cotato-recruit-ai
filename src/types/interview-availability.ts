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

export type InterviewAvailabilitySyncResponse = {
  logs: InterviewAvailabilitySyncLog[];
  message: string;
  generationId: string | null;
  llmEnabled: boolean;
  totalApplicants: number;
  candidates: number;
  skippedAlreadySynced: number;
  success: number;
  failed: number;
};

export type InterviewAvailabilitySyncStatsResponse = {
  generationId: string | null;
  totalApplicants: number;
  candidates: number;
  alreadySynced: number;
  pendingSync: number;
};

export type InterviewAvailabilitySyncLog = {
  timestamp: string;
  level: "INFO" | "SUCCESS" | "ERROR";
  message: string;
  applicationId: string | null;
  part: PartType | null;
  name: string | null;
};

export const INTERVIEW_PART_TAB_ORDER: readonly PartType[] = ["PM", "DE", "BE", "FE"];

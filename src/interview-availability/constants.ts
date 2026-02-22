import type { InterviewDay } from "@/types/interview-availability";

export const SLOT_MINUTES = 20;
export const MINUTES_PER_DAY = 24 * 60;
export const SLOTS_PER_DAY = MINUTES_PER_DAY / SLOT_MINUTES;

export type InterviewScheduleDay = InterviewDay & { month: number; day: number };

export const INTERVIEW_DAYS: InterviewScheduleDay[] = [
  { key: "2026-02-28", label: "2/28", weekday: "토", month: 2, day: 28 },
  { key: "2026-03-01", label: "3/1", weekday: "일", month: 3, day: 1 },
  { key: "2026-03-02", label: "3/2", weekday: "월", month: 3, day: 2 },
];

export const DAY_KEY_TO_INDEX = new Map(INTERVIEW_DAYS.map((day, index) => [day.key, index]));
export const MONTH_DAY_TO_KEY = new Map(INTERVIEW_DAYS.map((day) => [`${day.month}-${day.day}`, day.key]));

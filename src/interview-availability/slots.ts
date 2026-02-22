import {
  BOARD_SLOT_INDICES,
  INTERVIEW_DAYS,
  MINUTES_PER_DAY,
  SLOT_MINUTES,
  SLOTS_PER_DAY,
  DAY_KEY_TO_INDEX,
} from "@/interview-availability/constants";
import type { InterviewTimeSlot } from "@/types/interview-availability";

function formatMinuteLabel(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minute = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

export function buildSlots(): InterviewTimeSlot[] {
  return BOARD_SLOT_INDICES.map((absoluteSlotIndex, slotIndex) => {
    const startMinute = absoluteSlotIndex * SLOT_MINUTES;
    return {
      slotIndex,
      label: formatMinuteLabel(startMinute),
      startMinute,
      endMinute: startMinute + SLOT_MINUTES,
    };
  });
}

export function slotKey(dayKey: string, slotIndex: number) {
  return `${dayKey}:${slotIndex}`;
}

export function markMinuteRange(unavailableSlots: Set<string>, dayKey: string, startMinute: number, endMinute: number) {
  const clampedStart = Math.max(0, Math.min(startMinute, MINUTES_PER_DAY));
  const clampedEnd = Math.max(0, Math.min(endMinute, MINUTES_PER_DAY));

  if (clampedStart >= clampedEnd) return;

  for (let slotIndex = 0; slotIndex < SLOTS_PER_DAY; slotIndex += 1) {
    const slotStart = slotIndex * SLOT_MINUTES;
    const slotEnd = slotStart + SLOT_MINUTES;
    if (slotStart < clampedEnd && slotEnd > clampedStart) {
      unavailableSlots.add(slotKey(dayKey, slotIndex));
    }
  }
}

export function markIntervalWithMidnightSupport(
  unavailableSlots: Set<string>,
  dayKey: string,
  startMinute: number,
  endMinute: number,
) {
  if (endMinute > startMinute) {
    markMinuteRange(unavailableSlots, dayKey, startMinute, endMinute);
    return;
  }

  if (endMinute === startMinute) return;

  markMinuteRange(unavailableSlots, dayKey, startMinute, MINUTES_PER_DAY);

  if (endMinute <= 0) return;
  const currentDayIndex = DAY_KEY_TO_INDEX.get(dayKey);
  if (currentDayIndex === undefined) return;

  const nextDay = INTERVIEW_DAYS[currentDayIndex + 1];
  if (!nextDay) return;

  markMinuteRange(unavailableSlots, nextDay.key, 0, endMinute);
}

import { MINUTES_PER_DAY, MONTH_DAY_TO_KEY } from "@/interview-availability/constants";
import { markIntervalWithMidnightSupport, markMinuteRange } from "@/interview-availability/slots";

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, " ")
    .replace(/(\d{1,2})\s*시\s*([0-5]?\d)?\s*분?/g, (_, hour: string, minute?: string) => {
      const normalizedMinute = minute ? minute.padStart(2, "0") : "00";
      return `${hour}:${normalizedMinute}`;
    })
    .replace(/[∼〜～\-–—]/g, "~")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMinuteToken(token: string): number | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  const [hourRaw, minuteRaw] = trimmed.split(":");
  const hour = Number(hourRaw);
  const minute = minuteRaw === undefined ? 0 : Number(minuteRaw);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 24) return null;
  if (minute < 0 || minute > 59) return null;
  if (hour === 24 && minute !== 0) return null;

  return Math.min(hour * 60 + minute, MINUTES_PER_DAY);
}

export function parseTextToUnavailableSlots(rawText: string, unavailableSlots: Set<string>) {
  const text = normalizeText(rawText);
  if (!text) return false;

  const dateRegex = /(\d{1,2})\s*\/\s*(\d{1,2})|(\d{1,2})\s*월\s*(\d{1,2})\s*일?/g;
  const dateMatches: Array<{ index: number; raw: string; dayKey: string }> = [];

  let dateMatch: RegExpExecArray | null = dateRegex.exec(text);
  while (dateMatch) {
    const month = Number(dateMatch[1] ?? dateMatch[3]);
    const day = Number(dateMatch[2] ?? dateMatch[4]);
    const dayKey = MONTH_DAY_TO_KEY.get(`${month}-${day}`);
    if (dayKey && dateMatch.index !== undefined) {
      dateMatches.push({
        index: dateMatch.index,
        raw: dateMatch[0],
        dayKey,
      });
    }
    dateMatch = dateRegex.exec(text);
  }

  if (dateMatches.length === 0) {
    return false;
  }

  let hasUnavailable = false;
  const timeRangeRegex = /((?:[01]?\d|2[0-4])(?::[0-5]\d)?)\s*~\s*((?:[01]?\d|2[0-4])(?::[0-5]\d)?)/g;
  const hasNegativeKeyword = /(불가|불가능|불참|어려움|안됨|안돼|안되)/;
  const hasPositiveKeyword = /(가능|참석 가능|괜찮)/;

  for (let index = 0; index < dateMatches.length; index += 1) {
    const current = dateMatches[index];
    const next = dateMatches[index + 1];
    const segmentStart = current.index + current.raw.length;
    const segmentEnd = next ? next.index : text.length;
    const segment = text.slice(segmentStart, segmentEnd);

    timeRangeRegex.lastIndex = 0;
    let matchedRangeCount = 0;
    let rangeMatch: RegExpExecArray | null = timeRangeRegex.exec(segment);

    while (rangeMatch) {
      const startMinute = parseMinuteToken(rangeMatch[1]);
      const endMinute = parseMinuteToken(rangeMatch[2]);
      if (startMinute !== null && endMinute !== null) {
        markIntervalWithMidnightSupport(unavailableSlots, current.dayKey, startMinute, endMinute);
        hasUnavailable = true;
      }
      matchedRangeCount += 1;
      rangeMatch = timeRangeRegex.exec(segment);
    }

    if (matchedRangeCount === 0) {
      const segmentHasNegative = hasNegativeKeyword.test(segment);
      const segmentHasPositive = hasPositiveKeyword.test(segment);
      const compactSegment = segment.replace(/[,\.\s]/g, "");
      const isShortDirectNote = compactSegment.length <= 12;

      if (segmentHasNegative || (!segmentHasPositive && isShortDirectNote)) {
        markMinuteRange(unavailableSlots, current.dayKey, 0, MINUTES_PER_DAY);
        hasUnavailable = true;
      }
    }
  }

  return hasUnavailable;
}

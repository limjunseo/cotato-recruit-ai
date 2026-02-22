export const AVAILABILITY_NORMALIZER_SYSTEM_PROMPT = `
You normalize interview unavailability text.
Return JSON only, with no explanation and no markdown.
`.trim();

export function buildAvailabilityNormalizerUserPrompt(rawText: string) {
  return `
Normalize the user's text into this schema:

{
  "entries": [
    {
      "date": "2/28 | 3/1 | 3/2",
      "allDay": true | false,
      "ranges": [{"start":"HH:mm","end":"HH:mm"}]
    }
  ]
}

Rules:
1) Allowed dates are only: 2/28, 3/1, 3/2.
2) Keep only unavailable times. Ignore available times.
3) If unavailable info is missing, return {"entries":[]}.
4) If all-day unavailable, set allDay=true and ranges=[].
5) If partial unavailable, set allDay=false and include one or more ranges.
6) Use 24-hour HH:mm (for example 09:00, 17:20, 00:00, 24:00).
7) Overnight ranges are allowed (for example 15:00~00:00).
8) Merge duplicates and keep only valid ranges.

Input:
${rawText}
`.trim();
}

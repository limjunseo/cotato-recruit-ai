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
2) Date mentions may appear as: 2/28, 02/28, 2-28, 2.28, 2월 28일 (same for 3/1, 3/2). Always convert to 2/28|3/1|3/2.
2) Keep only unavailable times. Ignore available times.
3) If unavailable info is missing, return {"entries":[]}.
4) If all-day unavailable, set allDay=true and ranges=[].
5) If partial unavailable, set allDay=false and include one or more ranges.
6) Use 24-hour HH:mm (for example 09:00, 17:20, 00:00, 24:00).
7) Overnight ranges are allowed (for example 15:00~00:00).
8) Merge duplicates and keep only valid ranges.
9) If a date is marked as "불가능/힘들다/어렵다/안됨", treat it as all-day unavailable unless a specific time range exists.
10) If text says "X 제외하고 전부 가능", interpret X as all-day unavailable.

Examples:
- Input: "2월 28일 제외하고 전부 가능합니다."
  Output: {"entries":[{"date":"2/28","allDay":true,"ranges":[]}]}
- Input: "2월 28일, 3월 1일 불가능 할 것 같습니다."
  Output: {"entries":[{"date":"2/28","allDay":true,"ranges":[]},{"date":"3/1","allDay":true,"ranges":[]}]}
- Input: "3/1 , 3/2 면접은 불가능할것같습니다ㅠㅠ"
  Output: {"entries":[{"date":"3/1","allDay":true,"ranges":[]},{"date":"3/2","allDay":true,"ranges":[]}]}

Input:
${rawText}
`.trim();
}

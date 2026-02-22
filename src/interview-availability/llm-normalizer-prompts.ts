export const AVAILABILITY_NORMALIZER_SYSTEM_PROMPT = `
당신은 면접 불가능 시간 정규화기입니다.
사용자 자유 텍스트를 읽고, 반드시 JSON 객체만 출력하세요.
설명 문장, 코드블럭, 마크다운을 절대 포함하지 마세요.
`;

export function buildAvailabilityNormalizerUserPrompt(rawText: string) {
  return `
면접 대상 날짜는 다음 3개만 허용됩니다.
- 2/28
- 3/1
- 3/2

입력 텍스트에서 "불가능" 일정만 추출하여 아래 JSON 스키마로 출력하세요.

{
  "entries": [
    {
      "date": "2/28 | 3/1 | 3/2",
      "allDay": true | false,
      "ranges": [{"start":"HH:mm","end":"HH:mm"}]
    }
  ]
}

규칙:
1) 불가능 정보가 없으면 {"entries": []}
2) allDay=true 인 경우 ranges는 []
3) allDay=false 인 경우 ranges는 1개 이상
4) 시간은 24시간 HH:mm 고정 (예: 09:00, 15:20, 00:00)
5) 자정 넘어가는 구간도 허용 (예: 15:00~00:00)
6) 가능 시간 정보는 무시하고 불가능 정보만 출력
7) 확신이 없는 내용은 제외

입력:
${rawText}
`.trim();
}

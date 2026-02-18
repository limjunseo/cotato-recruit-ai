import type { ApplicationAnswer, ApplicationDetail } from "@/types/application";

export const INTERVIEW_QUESTION_SYSTEM_PROMPT =
  "당신은 한국 개발 동아리 면접관 보조입니다. 모든 출력은 한국어로만 작성하고, 반드시 JSON 객체만 반환하세요.";

export function buildInterviewQuestionUserPrompt(
  application: ApplicationDetail,
  answer: ApplicationAnswer,
  questionCount: number,
) {
  return `지원자 프로필:
- 지원 파트: ${application.applicationPartType}
- 전공: ${application.major ?? "미기재"}

자기소개서 답변(answer.content):
${answer.content}

요청사항:
1) 답변을 평가해 20~150자 한국어 요약을 작성하세요.
2) evaluationSummary는 간결하게 작성하고 가능하면 "~함" 또는 "~임" 형태로 끝내세요.
3) "~습니다/~니다" 같은 존댓말 종결은 사용하지 마세요.
4) 질문과 답변을 근거로, 한국어 꼬리질문을 1~${questionCount}개 작성하세요.
5) 질문은 행동/의사결정/트레이드오프/결과/지표/회고를 검증할 수 있도록 구체적으로 작성하세요.
6) 중복 질문, 성향만 묻는 질문, 빈 문자열은 금지합니다.
7) 답변이 짧아도 빈 값으로 두지 말고, 추가 확인이 필요한 핵심 맥락을 중심으로 작성하세요.
8) JSON 객체만 출력하고, 코드블록/설명문/접두어는 금지합니다.

출력 스키마(JSON):
{
  "evaluationSummary": "20~150자 한국어 평가 요약",
  "questions": ["질문1", "질문2"]
}`;
}

export function buildInterviewQuestionRepairPrompt(
  questionCount: number,
  previousOutput: string,
  reason: string,
) {
  return `이전 응답이 유효하지 않습니다.
문제 사유: ${reason}

이전 응답:
${previousOutput}

아래 조건으로 다시 작성하세요:
1) 한국어만 사용
2) JSON 객체만 반환
3) "evaluationSummary"는 20~150자, 빈 문자열 금지
4) "evaluationSummary"는 한 문장으로 작성하고 가능하면 "~함" 또는 "~임" 형태 사용
5) "evaluationSummary"에서 "~습니다/~니다" 종결 금지
6) "questions"는 1~${questionCount}개, 각 항목은 빈 문자열 금지
7) 코드블록/마크다운/설명문 금지

출력 스키마(JSON):
{
  "evaluationSummary": "20~150자 한국어 평가 요약",
  "questions": ["질문1", "질문2"]
}`;
}

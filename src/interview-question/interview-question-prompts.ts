import type { ApplicationAnswer, ApplicationDetail } from "@/types/application";

export const INTERVIEW_QUESTION_SYSTEM_PROMPT =
  "당신은 한국 개발 동아리 면접관 보조입니다. 모든 출력은 한국어로만 작성하고, 반드시 JSON 객체만 반환하세요.";

export function buildInterviewQuestionUserPrompt(
  application: ApplicationDetail,
  answer: ApplicationAnswer,
  questionCount: number,
) {
  const questionContent = answer.questionContent?.trim() || "(질문 원문 없음)";
  const answerContent = answer.content.trim();

  return `지원자 프로필:
- 지원 파트: ${application.applicationPartType}
- 전공: ${application.major ?? "미기재"}

자기소개서 질문(question.content):
${questionContent}

자기소개서 답변(answer.content):
${answerContent}

요청사항:
1) 답변을 평가해 20~150자 한국어 요약을 작성하세요.
2) 면접질문은 위 "자기소개서 질문"과 "자기소개서 답변"을 함께 참고해 정확히 ${questionCount}개 작성하세요.
3) 각 질문은 "자기소개서 질문"의 주제를 유지하면서 "자기소개서 답변"의 사례를 검증해야 합니다.
4) "자기소개서 질문" 재진술 금지, "자기소개서 답변"에 없는 사실 단정 금지.
5) 답변 근거가 부족하면 추측하지 말고 "questions"를 빈 배열([])로 반환해도 됩니다.
6) JSON 객체만 출력하고, 코드블록/마크다운/설명문/접두어는 금지합니다.

출력 스키마(JSON):
{
  "evaluationSummary": "20~150자 한국어 평가 요약",
  "questions": ["질문1", "질문2"]
}`;
}

export function buildInterviewQuestionRepairPrompt(
  application: ApplicationDetail,
  answer: ApplicationAnswer,
  questionCount: number,
  previousOutput: string,
  reason: string,
) {
  const questionContent = answer.questionContent?.trim() || "(질문 원문 없음)";
  const answerContent = answer.content.trim();

  return `이전 응답이 유효하지 않습니다.
문제 사유: ${reason}

지원자 프로필:
- 지원 파트: ${application.applicationPartType}
- 전공: ${application.major ?? "미기재"}

자기소개서 질문(question.content):
${questionContent}

자기소개서 답변(answer.content):
${answerContent}

이전 응답:
${previousOutput}

아래 조건으로 다시 작성하세요:
1) 한국어만 사용
2) JSON 객체만 반환
3) "evaluationSummary"는 20~150자, 빈 문자열 금지
4) "questions"는 위 "자기소개서 질문"과 "자기소개서 답변"을 함께 참고해 정확히 ${questionCount}개 작성
5) "자기소개서 질문" 재진술 금지, "자기소개서 답변"에 없는 사실 단정 금지
6) 답변 근거가 부족하면 추측하지 말고 "questions"를 빈 배열([])로 반환 가능
7) 코드블록/마크다운/설명문 금지

출력 스키마(JSON):
{
  "evaluationSummary": "20~150자 한국어 평가 요약",
  "questions": ["질문1", "질문2"]
}`;
}

import type { NotionSendResponse, QuestionsResponse } from "@/components/dashboard/application-detail/types";

async function parseApiError(response: Response, fallbackMessage: string) {
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    // Keep fallback message.
  }
  return fallbackMessage;
}

export async function requestGenerateInterviewQuestions(params: {
  applicationId: string;
  questionCount: number;
  answerId?: string;
}): Promise<QuestionsResponse> {
  const response = await fetch(`/api/applications/${params.applicationId}/interview-questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      questionCount: params.questionCount,
      ...(params.answerId ? { answerId: params.answerId } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to generate interview questions."));
  }

  return (await response.json()) as QuestionsResponse;
}

export async function requestSendToNotion(params: {
  applicationId: string;
  questionCount: number;
}): Promise<NotionSendResponse> {
  const response = await fetch(`/api/applications/${params.applicationId}/notion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ questionCount: params.questionCount }),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to send to Notion."));
  }

  return (await response.json()) as NotionSendResponse;
}

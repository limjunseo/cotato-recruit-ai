import { useState } from "react";
import { requestGenerateInterviewQuestions, requestSendToNotion } from "@/components/dashboard/application-detail/api";
import type { GeneratedAnswerQuestions } from "@/types/application";

type Params = {
  applicationId: string;
};

export function useApplicationDetailAi({ applicationId }: Params) {
  const [questionCount, setQuestionCount] = useState(3);
  const [generatedByAnswer, setGeneratedByAnswer] = useState<Record<string, GeneratedAnswerQuestions>>({});
  const [loadingTarget, setLoadingTarget] = useState<string | null>(null);
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionPageUrl, setNotionPageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upsertGeneratedResults = (results: GeneratedAnswerQuestions[]) => {
    setGeneratedByAnswer((prev) => {
      const next = { ...prev };
      for (const result of results) {
        next[result.answerId] = result;
      }
      return next;
    });
  };

  const handleGenerateQuestions = async (answerId?: string) => {
    setLoadingTarget(answerId ?? "all");
    setError(null);

    try {
      const payload = await requestGenerateInterviewQuestions({
        applicationId,
        questionCount,
        answerId,
      });
      upsertGeneratedResults(payload.results);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unknown error occurred.");
    } finally {
      setLoadingTarget(null);
    }
  };

  const handleSendToNotion = async () => {
    setNotionLoading(true);
    setError(null);
    setNotionPageUrl(null);

    try {
      const payload = await requestSendToNotion({
        applicationId,
        questionCount,
      });

      upsertGeneratedResults(payload.results);
      setNotionPageUrl(payload.pageUrl);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unknown error occurred.");
    } finally {
      setNotionLoading(false);
    }
  };

  return {
    questionCount,
    setQuestionCount,
    generatedByAnswer,
    loadingTarget,
    notionLoading,
    notionPageUrl,
    error,
    handleGenerateQuestions,
    handleSendToNotion,
  };
}

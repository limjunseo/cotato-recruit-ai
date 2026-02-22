import { ExternalLink, Send, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ApplicationDetail, GeneratedAnswerQuestions } from "@/types/application";

type Props = {
  application: ApplicationDetail;
  questionCount: number;
  setQuestionCount: (count: number) => void;
  generatedByAnswer: Record<string, GeneratedAnswerQuestions>;
  loadingTarget: string | null;
  notionLoading: boolean;
  notionPageUrl: string | null;
  error: string | null;
  onGenerateQuestions: (answerId?: string) => Promise<void> | void;
  onSendToNotion: () => Promise<void> | void;
};

export function AnswerGenerationCard({
  application,
  questionCount,
  setQuestionCount,
  generatedByAnswer,
  loadingTarget,
  notionLoading,
  notionPageUrl,
  error,
  onGenerateQuestions,
  onSendToNotion,
}: Props) {
  const hasAnswers = application.answers.some((answer) => answer.content.trim().length > 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-xl">Answer-Based AI Interview Questions</CardTitle>
          <CardDescription>Generate follow-up questions from each answer independently.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-44"
            value={String(questionCount)}
            onChange={(event) => setQuestionCount(Number(event.target.value))}
          >
            <option value="1">1 question / answer</option>
            <option value="2">2 questions / answer</option>
            <option value="3">3 questions / answer</option>
          </Select>
          <Button
            onClick={() => onGenerateQuestions()}
            disabled={loadingTarget !== null || notionLoading || !hasAnswers}
            type="button"
          >
            <Sparkles className="h-4 w-4" />
            {loadingTarget === "all" ? "Generating..." : "Generate for all answers"}
          </Button>
          <Button
            variant="secondary"
            onClick={onSendToNotion}
            disabled={loadingTarget !== null || notionLoading || !hasAnswers}
            type="button"
          >
            <Send className="h-4 w-4" />
            {notionLoading ? "Sending to Notion..." : "노션으로 보내기"}
          </Button>
        </div>

        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notionPageUrl && (
          <a
            href={notionPageUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "inline-flex")}
          >
            노션 페이지 열기
            <ExternalLink className="h-4 w-4" />
          </a>
        )}

        {!hasAnswers && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            No non-empty answers found for this application.
          </p>
        )}

        {application.answers.map((answer) => {
          const generated = generatedByAnswer[answer.answerId];
          const isLoadingThis = loadingTarget === answer.answerId;

          return (
            <section key={answer.answerId} className="rounded-xl border border-white/70 bg-white/75 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[color:var(--muted-foreground)]">
                  answer_id: {answer.answerId} | question_id: {answer.questionId}
                  {answer.questionType ? ` | question_type: ${answer.questionType}` : ""}
                </p>
                <Button
                  size="sm"
                  type="button"
                  disabled={loadingTarget !== null || notionLoading}
                  onClick={() => onGenerateQuestions(answer.answerId)}
                >
                  <Sparkles className="h-4 w-4" />
                  {isLoadingThis ? "Generating..." : "Generate for this answer"}
                </Button>
              </div>

              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-600">Question</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-900">
                  {answer.questionContent ?? "(question content unavailable)"}
                </p>
              </div>

              <div className="mt-2 rounded-lg border border-white/80 bg-white p-3">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">Answer</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{answer.content}</p>
              </div>

              {generated && (
                <div className="mt-3">
                  <p className="text-xs text-[color:var(--muted-foreground)]">생성 방식: AI 모델</p>
                  <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/70 p-3">
                    <p className="text-xs font-medium text-blue-700">자기소개서 평가 요약 (100~150자)</p>
                    <p className="mt-1 text-sm leading-relaxed text-blue-900">{generated.evaluationSummary}</p>
                  </div>
                  <ol className="mt-2 space-y-2">
                    {generated.questions.map((question, index) => (
                      <li
                        key={`${generated.answerId}-${index}-${question}`}
                        className="rounded-lg border border-white/70 bg-white p-3 text-sm leading-relaxed"
                      >
                        <span className="mr-1 font-semibold text-[color:var(--accent)]">{index + 1}.</span> {question}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

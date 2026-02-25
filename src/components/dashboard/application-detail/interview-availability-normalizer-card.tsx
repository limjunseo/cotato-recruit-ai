"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { requestNormalizeInterviewAvailability } from "@/components/dashboard/application-detail/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApplicationDetail } from "@/types/application";

type Props = {
  application: ApplicationDetail;
};

type NormalizeState = {
  input: string;
  output: string | null;
  status: "PENDING" | "SUCCESS" | "FAILED";
  syncedAt: string | null;
  lastError: string | null;
  skipped: boolean;
} | null;

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function InterviewAvailabilityNormalizerCard({ application }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rawInputText = application.unavailableInterviewTimes?.trim() ?? "";
  const [normalizeState, setNormalizeState] = useState<NormalizeState>(() => {
    const existing = application.interviewAvailabilityNormalization;
    if (!existing) return null;
    if (existing.sourceText.trim() !== rawInputText) return null;

    return {
      input: existing.sourceText,
      output: existing.normalizedText,
      status: existing.status,
      syncedAt: existing.syncedAt,
      lastError: existing.lastError,
      skipped: false,
    };
  });

  const inputText = useMemo(() => rawInputText, [rawInputText]);

  const handleNormalize = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const payload = await requestNormalizeInterviewAvailability({
        applicationId: application.applicationId,
      });

      setNormalizeState({
        input: payload.input,
        output: payload.output,
        status: payload.status,
        syncedAt: payload.syncedAt,
        lastError: payload.lastError,
        skipped: payload.skipped,
      });
    } catch (normalizeError) {
      setError(normalizeError instanceof Error ? normalizeError.message : "Failed to normalize interview availability.");
    } finally {
      setLoading(false);
    }
  };

  const displayedInput = normalizeState?.input ?? inputText;
  const displayedOutput = normalizeState?.output ?? null;
  const displayedStatus = normalizeState?.status ?? "PENDING";

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-xl">Interview Unavailability LLM Extractor</CardTitle>
          <CardDescription>Extract unavailable times with LLM, then sync this applicant to the interview Notion DB.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={handleNormalize} disabled={loading || displayedInput.length === 0}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Extracting + Syncing..." : "Run LLM Extract + Sync Notion"}
          </Button>
          <span className="text-xs text-[color:var(--muted-foreground)]">status: {displayedStatus}</span>
          <span className="text-xs text-[color:var(--muted-foreground)]">syncedAt: {formatDateTime(normalizeState?.syncedAt ?? null)}</span>
        </div>

        {normalizeState?.skipped ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
            Already synced SUCCESS data was reused (same input).
          </p>
        ) : null}

        {error ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {normalizeState?.lastError ? (
          <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{normalizeState.lastError}</p>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-600">Input (raw unavailable_interview_times)</p>
          <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-900">
            {displayedInput || "(empty)"}
          </pre>
        </section>

        <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <p className="text-xs font-medium text-emerald-700">Output (LLM normalized text)</p>
          <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-emerald-900">
            {displayedOutput ?? "(not generated yet)"}
          </pre>
        </section>
      </CardContent>
    </Card>
  );
}

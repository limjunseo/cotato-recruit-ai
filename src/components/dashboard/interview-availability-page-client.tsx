"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { InterviewAvailabilityCard } from "@/components/dashboard/applications/interview-availability-card";
import {
  fetchInterviewAvailabilitySyncStats,
  syncInterviewAvailability as requestInterviewAvailabilitySync,
} from "@/components/dashboard/applications/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  InterviewAvailabilitySyncLog,
  InterviewAvailabilitySyncResponse,
  InterviewAvailabilitySyncStatsResponse,
} from "@/types/interview-availability";

type Props = {
  initialGenerationId: string;
};

function formatSyncLogTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function syncLogTextClass(level: InterviewAvailabilitySyncLog["level"]) {
  if (level === "SUCCESS") return "text-emerald-700";
  if (level === "ERROR") return "text-rose-700";
  return "text-slate-700";
}

export function InterviewAvailabilityPageClient({ initialGenerationId }: Props) {
  const [inputGenerationId, setInputGenerationId] = useState(initialGenerationId);
  const [appliedGenerationId, setAppliedGenerationId] = useState(initialGenerationId);
  const [useLlmForSync, setUseLlmForSync] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<InterviewAvailabilitySyncLog[]>([]);
  const [currentSyncStats, setCurrentSyncStats] = useState<InterviewAvailabilitySyncStatsResponse | null>(null);
  const [isCurrentSyncStatsLoading, setIsCurrentSyncStatsLoading] = useState(false);
  const [currentSyncStatsError, setCurrentSyncStatsError] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState<Pick<
    InterviewAvailabilitySyncResponse,
    "totalApplicants" | "candidates" | "success" | "failed" | "skippedAlreadySynced"
  > | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadSyncStats = async () => {
      setIsCurrentSyncStatsLoading(true);
      setCurrentSyncStatsError(null);

      try {
        const payload = await fetchInterviewAvailabilitySyncStats(appliedGenerationId, controller.signal);
        setCurrentSyncStats(payload);
      } catch (error) {
        if (controller.signal.aborted) return;
        setCurrentSyncStatsError(
          error instanceof Error ? error.message : "Failed to load interview availability sync stats.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsCurrentSyncStatsLoading(false);
        }
      }
    };

    void loadSyncStats();
    return () => controller.abort();
  }, [appliedGenerationId, refreshKey]);

  const applyGenerationFilter = () => {
    const trimmed = inputGenerationId.trim();
    if (!trimmed) {
      setAppliedGenerationId("");
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      return;
    }
    setAppliedGenerationId(trimmed);
  };

  const clearGenerationFilter = () => {
    setInputGenerationId("");
    setAppliedGenerationId("");
  };

  const runInterviewTimeSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncMessage(null);
    setSyncError(null);
    setSyncStats(null);
    setSyncLogs([
      {
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: `Sync request sent. generationId=${appliedGenerationId || "ALL"}, llm=${useLlmForSync ? "ON" : "OFF"}`,
        applicationId: null,
        part: null,
        name: null,
      },
    ]);

    try {
      const result = await requestInterviewAvailabilitySync(appliedGenerationId, useLlmForSync);
      setSyncMessage(result.message);
      setSyncStats({
        totalApplicants: result.totalApplicants,
        candidates: result.candidates,
        success: result.success,
        failed: result.failed,
        skippedAlreadySynced: result.skippedAlreadySynced,
      });
      setSyncLogs(result.logs);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync interview times.";
      setSyncError(message);
      setSyncLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          level: "ERROR",
          message,
          applicationId: null,
          part: null,
          name: null,
        },
      ]);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">Generation Filter (optional)</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            className="w-44"
            inputMode="numeric"
            placeholder="e.g. 13"
            value={inputGenerationId}
            onChange={(event) => setInputGenerationId(event.target.value)}
          />
          <Button type="button" size="sm" onClick={applyGenerationFilter}>
            Apply
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={clearGenerationFilter}>
            Clear
          </Button>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-600"
              checked={useLlmForSync}
              disabled={isSyncing}
              onChange={(event) => setUseLlmForSync(event.target.checked)}
            />
            Use LLM
          </label>
          <Button type="button" size="sm" variant="primary" disabled={isSyncing} onClick={runInterviewTimeSync}>
            {isSyncing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isSyncing ? "Syncing Interview Time..." : "Sync Interview Time"}
          </Button>
        </div>

        {isCurrentSyncStatsLoading ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <LoaderCircle className="h-3 w-3 animate-spin" />
            Loading current sync stats...
          </p>
        ) : null}
        {!isCurrentSyncStatsLoading && currentSyncStatsError ? (
          <p className="mt-2 text-xs text-rose-700">{currentSyncStatsError}</p>
        ) : null}
        {!isCurrentSyncStatsLoading && !currentSyncStatsError && currentSyncStats ? (
          <p className="mt-2 text-xs text-slate-700">
            Current Sync:{" "}
            <span className="font-semibold text-emerald-700">
              {currentSyncStats.alreadySynced}/{currentSyncStats.candidates}
            </span>{" "}
            synced, pending {currentSyncStats.pendingSync}, total applicants {currentSyncStats.totalApplicants}.
          </p>
        ) : null}

        {syncMessage ? <p className="mt-2 text-xs text-emerald-700">{syncMessage}</p> : null}
        {syncError ? <p className="mt-2 text-xs text-rose-700">{syncError}</p> : null}
        {syncStats ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              Total Applicants: <span className="font-semibold text-slate-900">{syncStats.totalApplicants}</span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              Sync Candidates: <span className="font-semibold text-slate-900">{syncStats.candidates}</span>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Success: <span className="font-semibold">{syncStats.success}</span>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Failed: <span className="font-semibold">{syncStats.failed}</span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              Skipped: <span className="font-semibold text-slate-900">{syncStats.skippedAlreadySynced}</span>
            </div>
          </div>
        ) : null}

        {syncLogs.length > 0 ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold text-slate-700">Sync Logs</p>
            <div className="mt-2 max-h-56 space-y-1 overflow-auto pr-1">
              {syncLogs.map((log, index) => (
                <p key={`${log.timestamp}-${index}`} className={`text-xs ${syncLogTextClass(log.level)}`}>
                  [{formatSyncLogTime(log.timestamp)}] [{log.level}] {log.message}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <InterviewAvailabilityCard generationId={appliedGenerationId} refreshKey={refreshKey} />
    </section>
  );
}

"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { InterviewAvailabilityCard } from "@/components/dashboard/applications/interview-availability-card";
import { syncInterviewAvailability as requestInterviewAvailabilitySync } from "@/components/dashboard/applications/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  initialGenerationId: string;
};

export function InterviewAvailabilityPageClient({ initialGenerationId }: Props) {
  const [inputGenerationId, setInputGenerationId] = useState(initialGenerationId);
  const [appliedGenerationId, setAppliedGenerationId] = useState(initialGenerationId);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

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

    try {
      const result = await requestInterviewAvailabilitySync(appliedGenerationId);
      setSyncMessage(result.message);
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Failed to sync interview times.");
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
          <Button type="button" size="sm" variant="primary" disabled={isSyncing} onClick={runInterviewTimeSync}>
            {isSyncing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isSyncing ? "Syncing Interview Time..." : "Sync Interview Time"}
          </Button>
        </div>

        {syncMessage ? <p className="mt-2 text-xs text-emerald-700">{syncMessage}</p> : null}
        {syncError ? <p className="mt-2 text-xs text-rose-700">{syncError}</p> : null}
      </div>

      <InterviewAvailabilityCard generationId={appliedGenerationId} refreshKey={refreshKey} />
    </section>
  );
}

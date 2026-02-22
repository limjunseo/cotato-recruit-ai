"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { fetchRdsSyncLogs } from "@/components/dashboard/applications/services";
import type { RdsSyncLogItem } from "@/components/dashboard/applications/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const LOG_LIMIT = 1000;

function formatDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatSyncIdPreview(ids: string[], previewLimit = 20) {
  if (ids.length === 0) return "-";
  if (ids.length <= previewLimit) return ids.join(", ");
  return `${ids.slice(0, previewLimit).join(", ")}, ... (+${ids.length - previewLimit})`;
}

export function SyncLogsClient() {
  const [items, setItems] = useState<RdsSyncLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await fetchRdsSyncLogs(LOG_LIMIT, signal);
      setItems(payload.items);
    } catch (fetchError) {
      if (signal?.aborted) return;
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load RDS sync logs.");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadLogs(controller.signal);
    return () => controller.abort();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xl">RDS Sync Logs</CardTitle>
            <CardDescription>Saved in local DB. Showing latest {LOG_LIMIT} runs.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="secondary" disabled={isLoading} onClick={() => void loadLogs()}>
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading logs...
          </p>
        )}

        {!isLoading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-sm text-[color:var(--muted-foreground)]">
            No sync logs yet.
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <div className="space-y-3">
            {items.map((log) => (
              <article key={log.runId} className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">
                  {formatDateTime(log.requestedAt)} | {log.trigger} | {log.status} |{" "}
                  {log.durationMs !== null ? formatDuration(log.durationMs) : "-"}
                </p>
                <p className="mt-2">
                  applications {log.syncSummary.applications.count}, questions {log.syncSummary.questions.count}, answers{" "}
                  {log.syncSummary.answers.count}
                </p>
                <p className="mt-1">application IDs: {formatSyncIdPreview(log.syncSummary.applications.ids, 30)}</p>
                {log.message && <p className="mt-1">message: {log.message}</p>}
                {log.errorCode && <p className="mt-1 text-rose-700">error: {log.errorCode}</p>}
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

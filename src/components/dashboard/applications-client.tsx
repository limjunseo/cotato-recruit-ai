"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { BatchSendPanel } from "@/components/dashboard/applications/batch-send-panel";
import { ApplicationsFiltersCard } from "@/components/dashboard/applications/applications-filters-card";
import { ApplicationsListCard } from "@/components/dashboard/applications/applications-list-card";
import { NotionSyncStatsCard } from "@/components/dashboard/applications/notion-sync-stats-card";
import { fetchNotionSyncStats, triggerProdRdsPull } from "@/components/dashboard/applications/services";
import type { NotionSyncStatsResponse, RdsSyncSummary } from "@/components/dashboard/applications/types";
import { buildSelectionScopeKey } from "@/components/dashboard/applications/utils";
import { useApplicationSelection } from "@/components/dashboard/applications/use-application-selection";
import { useApplicationsData } from "@/components/dashboard/applications/use-applications-data";
import { useNotionBatch } from "@/components/dashboard/applications/use-notion-batch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ApplicationsClient() {
  const { filters, setFilters, items, total, isLoading, error } = useApplicationsData();
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState<NotionSyncStatsResponse | null>(null);
  const [syncStatsLoading, setSyncStatsLoading] = useState(true);
  const [syncStatsError, setSyncStatsError] = useState<string | null>(null);
  const [rdsPullLoading, setRdsPullLoading] = useState(false);
  const [rdsPullMessage, setRdsPullMessage] = useState<string | null>(null);
  const [rdsPullError, setRdsPullError] = useState<string | null>(null);
  const [latestSyncSummary, setLatestSyncSummary] = useState<RdsSyncSummary | null>(null);
  const [lastRdsPullAt, setLastRdsPullAt] = useState<string | null>(null);

  const scopeKey = useMemo(() => buildSelectionScopeKey(filters), [filters]);
  const {
    selectedMap,
    selectedCount,
    clearSelection,
    replaceSelection,
    toggleSelection,
    isAllCurrentPageSelected,
    toggleCurrentPageSelection,
  } = useApplicationSelection({ scopeKey });

  const { isSelectingFiltered, batchProgress, progressPercent, selectAllFiltered, sendSelectedToNotion } = useNotionBatch();
  const totalLabel = `${total.toLocaleString()}명`;
  const hasItems = items.length > 0;
  const allCurrentPageSelected = isAllCurrentPageSelected(items);
  const isPullDisabled = rdsPullLoading || batchProgress.isRunning || isSelectingFiltered;

  const formatDuration = (durationMs: number) => `${(durationMs / 1000).toFixed(1)}s`;
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  const formatSyncIdPreview = (ids: string[], previewLimit = 20) => {
    if (ids.length === 0) return "-";
    if (ids.length <= previewLimit) return ids.join(", ");
    return `${ids.slice(0, previewLimit).join(", ")}, ... (+${ids.length - previewLimit})`;
  };
  const formatSyncCounts = (summary: RdsSyncSummary) =>
    `applications ${summary.applications.count}, questions ${summary.questions.count}, answers ${summary.answers.count}`;

  useEffect(() => {
    const controller = new AbortController();

    const loadStats = async () => {
      setSyncStatsLoading(true);
      setSyncStatsError(null);

      try {
        const payload = await fetchNotionSyncStats(controller.signal);
        setSyncStats(payload);
      } catch (statsError) {
        if (controller.signal.aborted) return;
        setSyncStatsError(statsError instanceof Error ? statsError.message : "Failed to load stats.");
      } finally {
        if (!controller.signal.aborted) {
          setSyncStatsLoading(false);
        }
      }
    };

    void loadStats();
    return () => controller.abort();
  }, []);

  const handleSelectFiltered = async () => {
    if (isSelectingFiltered || isLoading || batchProgress.isRunning) return;

    setActionError(null);
    try {
      const nextSelection = await selectAllFiltered(filters);
      replaceSelection(nextSelection);
    } catch (selectionError) {
      setActionError(selectionError instanceof Error ? selectionError.message : "Failed to select filtered applications.");
    }
  };

  const handleBatchSendToNotion = async () => {
    if (selectedCount === 0 || batchProgress.isRunning) return;

    setActionError(null);
    try {
      await sendSelectedToNotion(selectedMap, { syncTrigger: "dashboard-batch" });
    } catch (sendError) {
      setActionError(sendError instanceof Error ? sendError.message : "Failed to send selected applications.");
    }
  };

  const handleProdRdsPull = async () => {
    if (isPullDisabled) return;

    setRdsPullLoading(true);
    setRdsPullError(null);
    setRdsPullMessage(null);
    setLatestSyncSummary(null);

    try {
      const payload = await triggerProdRdsPull();
      const completedAt = payload.completedAt ?? new Date().toISOString();
      const syncSummary = payload.syncSummary ?? null;
      const pulledApplicationIds = syncSummary?.applications.ids ?? [];
      setLastRdsPullAt(completedAt);
      setLatestSyncSummary(syncSummary);
      const baseMessage = syncSummary
        ? `${payload.message} (${formatDuration(payload.durationMs)}) | ${formatSyncCounts(syncSummary)}`
        : `${payload.message} (${formatDuration(payload.durationMs)})`;

      let autoSendMessage = "Auto Notion sync skipped (no new applications).";

      if (pulledApplicationIds.length > 0) {
        const autoSelectedMap = pulledApplicationIds.reduce<typeof selectedMap>((acc, applicationId) => {
          acc[applicationId] = {
            applicationId,
            name: `Application #${applicationId}`,
          };
          return acc;
        }, {});
        const autoSendResult = await sendSelectedToNotion(autoSelectedMap, { syncTrigger: "rds-pull" });
        autoSendMessage = `Auto Notion sync completed: ${autoSendResult.success} success, ${autoSendResult.skipped} skipped, ${autoSendResult.failed} failed (total ${autoSendResult.total}).`;
      }

      setRdsPullMessage(`${baseMessage} | ${autoSendMessage}`);

      setFilters((prev) => ({ ...prev }));

      try {
        setSyncStatsLoading(true);
        setSyncStatsError(null);
        const stats = await fetchNotionSyncStats();
        setSyncStats(stats);
      } catch (statsError) {
        setSyncStatsError(statsError instanceof Error ? statsError.message : "Failed to refresh stats.");
      } finally {
        setSyncStatsLoading(false);
      }
    } catch (pullError) {
      setRdsPullError(pullError instanceof Error ? pullError.message : "Failed to pull from production RDS.");
    } finally {
      setRdsPullLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <NotionSyncStatsCard
        totalApplicants={syncStats?.totalApplicants ?? null}
        notionSyncedApplicants={syncStats?.notionSyncedApplicants ?? null}
        isLoading={syncStatsLoading}
        error={syncStatsError}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-xl">Prod RDS Pull</CardTitle>
            <CardDescription>Manually pull latest submitted applications from production RDS.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={isPullDisabled} onClick={handleProdRdsPull}>
              {rdsPullLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {rdsPullLoading ? "Pulling..." : "Pull From Prod RDS"}
            </Button>

            {lastRdsPullAt && (
              <span className="text-xs text-[color:var(--muted-foreground)]">
                Last success: {formatDateTime(lastRdsPullAt)}
              </span>
            )}
          </div>

          <p className="text-xs text-[color:var(--muted-foreground)]">Auto cron runs every 30 minutes.</p>

          {rdsPullMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {rdsPullMessage}
            </div>
          )}

          {rdsPullError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{rdsPullError}</div>
          )}

          {batchProgress.isRunning && (
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
              <p className="font-semibold">Auto Notion Sync Progress</p>
              <p className="mt-1">
                {batchProgress.processed}/{batchProgress.total} ({progressPercent}%)
              </p>
              <p className="mt-1">
                success {batchProgress.success}, skipped {batchProgress.skipped}, failed {batchProgress.failed}
              </p>
              {batchProgress.currentName && <p className="mt-1">current: {batchProgress.currentName}</p>}
            </div>
          )}

          {latestSyncSummary && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">Last pull inserted IDs</p>
              <p className="mt-1">
                applications ({latestSyncSummary.applications.count}):{" "}
                {formatSyncIdPreview(latestSyncSummary.applications.ids)}
              </p>
              <p className="mt-1">
                questions ({latestSyncSummary.questions.count}): {formatSyncIdPreview(latestSyncSummary.questions.ids)}
              </p>
              <p className="mt-1">
                answers ({latestSyncSummary.answers.count}): {formatSyncIdPreview(latestSyncSummary.answers.ids)}
              </p>
            </div>
          )}

        </CardContent>
      </Card>

      <ApplicationsFiltersCard filters={filters} totalLabel={totalLabel} onChangeFilters={setFilters} />

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-xl">Batch Send</CardTitle>
            <CardDescription>
              Select filtered applicants and send to Notion in batch. Already synced applicants are excluded automatically.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <BatchSendPanel
            hasItems={hasItems}
            selectedCount={selectedCount}
            allCurrentPageSelected={allCurrentPageSelected}
            isLoading={isLoading}
            isSelectingFiltered={isSelectingFiltered}
            batchProgress={batchProgress}
            progressPercent={progressPercent}
            onToggleCurrentPageSelection={() => toggleCurrentPageSelection(items)}
            onSelectFiltered={handleSelectFiltered}
            onClearSelection={clearSelection}
            onSendSelected={handleBatchSendToNotion}
          />

          {actionError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{actionError}</div>
          )}
        </CardContent>
      </Card>

      <ApplicationsListCard
        items={items}
        total={total}
        filters={filters}
        isLoading={isLoading}
        error={error}
        isBatchRunning={batchProgress.isRunning}
        selectedMap={selectedMap}
        onToggleSelection={toggleSelection}
        onPrevPage={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
        onNextPage={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
      />

      {(isLoading || isSelectingFiltered) && (
        <div className="flex items-center justify-center gap-2 text-sm text-[color:var(--muted-foreground)]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {isSelectingFiltered ? "Selecting filtered applications..." : "Loading data..."}
        </div>
      )}
    </section>
  );
}

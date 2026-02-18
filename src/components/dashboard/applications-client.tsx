"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { BatchSendPanel } from "@/components/dashboard/applications/batch-send-panel";
import { ApplicationsFiltersCard } from "@/components/dashboard/applications/applications-filters-card";
import { ApplicationsListCard } from "@/components/dashboard/applications/applications-list-card";
import { NotionSyncStatsCard } from "@/components/dashboard/applications/notion-sync-stats-card";
import { fetchNotionSyncStats } from "@/components/dashboard/applications/services";
import type { NotionSyncStatsResponse } from "@/components/dashboard/applications/types";
import { buildSelectionScopeKey } from "@/components/dashboard/applications/utils";
import { useApplicationSelection } from "@/components/dashboard/applications/use-application-selection";
import { useApplicationsData } from "@/components/dashboard/applications/use-applications-data";
import { useNotionBatch } from "@/components/dashboard/applications/use-notion-batch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ApplicationsClient() {
  const { filters, setFilters, items, total, isLoading, error } = useApplicationsData();
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState<NotionSyncStatsResponse | null>(null);
  const [syncStatsLoading, setSyncStatsLoading] = useState(true);
  const [syncStatsError, setSyncStatsError] = useState<string | null>(null);

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
      await sendSelectedToNotion(selectedMap);
    } catch (sendError) {
      setActionError(sendError instanceof Error ? sendError.message : "Failed to send selected applications.");
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

      <ApplicationsFiltersCard filters={filters} totalLabel={totalLabel} onChangeFilters={setFilters} />

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-xl">Batch Send</CardTitle>
            <CardDescription>
              Select filtered applicants and send to Notion in batch. Existing Notion contacts are excluded automatically.
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

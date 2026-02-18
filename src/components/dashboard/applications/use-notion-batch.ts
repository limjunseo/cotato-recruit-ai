import { useMemo, useState } from "react";
import { INITIAL_BATCH_PROGRESS } from "@/components/dashboard/applications/constants";
import { fetchAllFilteredApplications, sendApplicationToNotion } from "@/components/dashboard/applications/services";
import { displayName } from "@/components/dashboard/applications/utils";
import type { BatchItemResult, BatchProgress, SelectedApplicationMap } from "@/components/dashboard/applications/types";
import type { ApplicationFilters } from "@/types/application";

export function useNotionBatch() {
  const [isSelectingFiltered, setIsSelectingFiltered] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress>(INITIAL_BATCH_PROGRESS);

  const progressPercent = useMemo(() => {
    if (batchProgress.total <= 0) return 0;
    return Math.round((batchProgress.processed / batchProgress.total) * 100);
  }, [batchProgress.total, batchProgress.processed]);

  const selectAllFiltered = async (filters: ApplicationFilters): Promise<SelectedApplicationMap> => {
    setIsSelectingFiltered(true);

    try {
      const allFiltered = await fetchAllFilteredApplications({
        ...filters,
        notionExists: "no",
      });
      const nextSelection: SelectedApplicationMap = {};

      for (const item of allFiltered) {
        nextSelection[item.applicationId] = {
          applicationId: item.applicationId,
          name: displayName(item),
        };
      }

      return nextSelection;
    } finally {
      setIsSelectingFiltered(false);
    }
  };

  const sendSelectedToNotion = async (
    selectedMap: SelectedApplicationMap,
  ): Promise<{ total: number; success: number; skipped: number; failed: number }> => {
    const targets = Object.values(selectedMap);
    if (targets.length === 0 || batchProgress.isRunning) {
      return {
        total: targets.length,
        success: 0,
        skipped: 0,
        failed: 0,
      };
    }
    const batchStartedAt = Date.now();
    console.info("[batch-send] batch started", { total: targets.length });

    setBatchProgress({
      isRunning: true,
      total: targets.length,
      processed: 0,
      success: 0,
      skipped: 0,
      failed: 0,
      currentName: null,
      batchStartedAt,
      currentItemStartedAt: null,
      batchElapsedMs: 0,
      results: [],
    });

    let processed = 0;
    let success = 0;
    let skipped = 0;
    let failed = 0;
    const results: BatchItemResult[] = [];

    for (const target of targets) {
      setBatchProgress((prev) => ({
        ...prev,
        currentName: target.name,
        currentItemStartedAt: Date.now(),
      }));
      const itemStartedAt = Date.now();
      console.info("[batch-send] item started", {
        applicationId: target.applicationId,
        name: target.name,
      });

      try {
        const payload = await sendApplicationToNotion(target.applicationId);
        if (payload.skipped) {
          console.info("[batch-send] item skipped", {
            applicationId: target.applicationId,
            elapsedMs: Date.now() - itemStartedAt,
          });
          skipped += 1;
          results.push({
            applicationId: target.applicationId,
            name: target.name,
            status: "skipped",
            pageUrl: payload.pageUrl,
            message: "Already synced to Notion.",
            elapsedMs: Date.now() - itemStartedAt,
          });
        } else {
          console.info("[batch-send] item succeeded", {
            applicationId: target.applicationId,
            elapsedMs: Date.now() - itemStartedAt,
          });
          success += 1;
          results.push({
            applicationId: target.applicationId,
            name: target.name,
            status: "success",
            pageUrl: payload.pageUrl,
            elapsedMs: Date.now() - itemStartedAt,
          });
        }
      } catch (sendError) {
        console.error("[batch-send] item failed", {
          applicationId: target.applicationId,
          elapsedMs: Date.now() - itemStartedAt,
          error: sendError instanceof Error ? sendError.message : sendError,
        });
        failed += 1;
        results.push({
          applicationId: target.applicationId,
          name: target.name,
          status: "failed",
          message: sendError instanceof Error ? sendError.message : "Unknown error occurred.",
          elapsedMs: Date.now() - itemStartedAt,
        });
      } finally {
        processed += 1;
        setBatchProgress({
          isRunning: true,
          total: targets.length,
          processed,
          success,
          skipped,
          failed,
          currentName: target.name,
          batchStartedAt,
          currentItemStartedAt: itemStartedAt,
          batchElapsedMs: Date.now() - batchStartedAt,
          results: [...results],
        });
      }
    }

    setBatchProgress((prev) => ({
      ...prev,
      isRunning: false,
      currentName: null,
      currentItemStartedAt: null,
      batchElapsedMs: Date.now() - batchStartedAt,
    }));
    console.info("[batch-send] batch completed", {
      total: targets.length,
      processed,
      success,
      skipped,
      failed,
      elapsedMs: Date.now() - batchStartedAt,
    });

    return {
      total: targets.length,
      success,
      skipped,
      failed,
    };
  };

  return {
    isSelectingFiltered,
    batchProgress,
    progressPercent,
    selectAllFiltered,
    sendSelectedToNotion,
  };
}

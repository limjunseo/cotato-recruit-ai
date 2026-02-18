import { useEffect, useState } from "react";
import { AlertCircle, CheckSquare, LoaderCircle, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BatchProgress } from "@/components/dashboard/applications/types";

type Props = {
  hasItems: boolean;
  selectedCount: number;
  allCurrentPageSelected: boolean;
  isLoading: boolean;
  isSelectingFiltered: boolean;
  batchProgress: BatchProgress;
  progressPercent: number;
  onToggleCurrentPageSelection: () => void;
  onSelectFiltered: () => Promise<void> | void;
  onClearSelection: () => void;
  onSendSelected: () => Promise<void> | void;
};

export function BatchSendPanel({
  hasItems,
  selectedCount,
  allCurrentPageSelected,
  isLoading,
  isSelectingFiltered,
  batchProgress,
  progressPercent,
  onToggleCurrentPageSelection,
  onSelectFiltered,
  onClearSelection,
  onSendSelected,
}: Props) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!batchProgress.isRunning) return;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [batchProgress.isRunning]);

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  };

  const totalElapsedMs =
    batchProgress.isRunning && batchProgress.batchStartedAt
      ? now - batchProgress.batchStartedAt
      : batchProgress.batchElapsedMs;
  const currentItemElapsedMs =
    batchProgress.isRunning && batchProgress.currentItemStartedAt
      ? now - batchProgress.currentItemStartedAt
      : 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/70 bg-white/70 p-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isLoading || batchProgress.isRunning || !hasItems}
          onClick={onToggleCurrentPageSelection}
        >
          {allCurrentPageSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
          {allCurrentPageSelected ? "Unselect Current Page" : "Select Current Page"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isLoading || batchProgress.isRunning || isSelectingFiltered}
          onClick={onSelectFiltered}
        >
          {isSelectingFiltered ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
          {isSelectingFiltered ? "Selecting Filtered..." : "Select All Filtered"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={selectedCount === 0 || batchProgress.isRunning}
          onClick={onClearSelection}
        >
          Clear Selection
        </Button>

        <Button type="button" size="sm" disabled={selectedCount === 0 || batchProgress.isRunning} onClick={onSendSelected}>
          {batchProgress.isRunning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {batchProgress.isRunning ? "Sending..." : `Send Selected to Notion (${selectedCount})`}
        </Button>
      </div>

      {batchProgress.total > 0 && (
        <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-cyan-900">
              Progress: {batchProgress.processed}/{batchProgress.total} ({progressPercent}%)
            </p>
            <div className="text-right text-xs text-cyan-800">
              <p>Success {batchProgress.success} / Skipped {batchProgress.skipped} / Failed {batchProgress.failed}</p>
              <p>Elapsed {formatDuration(totalElapsedMs)}</p>
            </div>
          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-cyan-100">
            <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>

          {batchProgress.currentName && (
            <p className="mt-2 text-xs text-cyan-900">
              Current: {batchProgress.currentName}
              {batchProgress.isRunning ? ` (${formatDuration(currentItemElapsedMs)})` : ""}
            </p>
          )}

          {batchProgress.results.length > 0 && (
            <ul className="mt-3 max-h-52 space-y-1 overflow-auto rounded-lg border border-cyan-100 bg-white/80 p-2">
              {batchProgress.results.map((result) => (
                <li key={`${result.applicationId}-${result.status}`} className="text-xs">
                  <span
                    className={
                      result.status === "success"
                        ? "text-emerald-700"
                        : result.status === "skipped"
                          ? "text-amber-700"
                          : "text-rose-700"
                    }
                  >
                    [{result.status.toUpperCase()}]
                  </span>{" "}
                  {result.name}
                  {typeof result.elapsedMs === "number" ? ` (${formatDuration(result.elapsedMs)})` : ""}
                  {result.pageUrl && (
                    <>
                      {" "}
                      -{" "}
                      <a href={result.pageUrl} target="_blank" rel="noreferrer" className="text-cyan-700 underline">
                        Open
                      </a>
                    </>
                  )}
                  {result.message && <span className="text-rose-700"> - {result.message}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!batchProgress.isRunning && batchProgress.failed > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          <AlertCircle className="h-4 w-4" />
          Some applications failed to send. Check the progress panel for details.
        </div>
      )}
    </>
  );
}

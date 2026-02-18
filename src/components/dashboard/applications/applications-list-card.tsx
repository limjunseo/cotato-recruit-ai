import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, UserRound } from "lucide-react";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, toKoreanDateTime } from "@/lib/utils";
import type { SelectedApplicationMap } from "@/components/dashboard/applications/types";
import type { ApplicationFilters, ApplicationListItem } from "@/types/application";

type Props = {
  items: ApplicationListItem[];
  total: number;
  filters: ApplicationFilters;
  isLoading: boolean;
  error: string | null;
  isBatchRunning: boolean;
  selectedMap: SelectedApplicationMap;
  onToggleSelection: (item: ApplicationListItem) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function ApplicationsListCard({
  items,
  total,
  filters,
  isLoading,
  error,
  isBatchRunning,
  selectedMap,
  onToggleSelection,
  onPrevPage,
  onNextPage,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-xl">Applications</CardTitle>
          <CardDescription>Select applicants and review details or run batch Notion send.</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        )}

        {!isLoading && !error && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
            <UserRound className="mx-auto mb-3 h-6 w-6 text-[color:var(--muted-foreground)]" />
            <p className="text-sm text-[color:var(--muted-foreground)]">No applications match your filters.</p>
          </div>
        )}

        {!isLoading && !error && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item, index) => {
              const isSelected = Boolean(selectedMap[item.applicationId]);
              const name = item.name?.trim() || `Application ${item.applicationId}`;

              return (
                <motion.div
                  key={item.applicationId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.2), duration: 0.25 }}
                  className={cn(
                    "rounded-xl border p-4 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.6)]",
                    isSelected ? "border-cyan-200 bg-cyan-50/65" : "border-white/60 bg-white/85",
                    "grid gap-3 md:grid-cols-[auto_1.1fr_0.6fr_0.9fr_0.8fr_0.6fr_auto] md:items-center",
                  )}
                >
                  <label className="inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={isSelected}
                      onChange={() => onToggleSelection(item)}
                      disabled={isBatchRunning}
                    />
                  </label>

                  <div>
                    <div className="font-semibold text-[color:var(--foreground)]">{name}</div>
                    <div className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                      {item.university ?? "Unknown university"} · {item.major ?? "Unknown major"}
                    </div>
                  </div>

                  <div className="text-sm font-medium text-[color:var(--foreground)]">{item.applicationPartType}</div>
                  <StatusPill status={item.passStatus} />
                  <div className="text-xs text-[color:var(--muted-foreground)]">{toKoreanDateTime(item.submittedAt)}</div>
                  <div className="text-xs text-[color:var(--muted-foreground)]">Gen {item.generationId ?? "-"}</div>

                  <Link
                    href={`/applications/${item.applicationId}`}
                    className={cn(buttonVariants({ size: "sm" }), "justify-self-start md:justify-self-end")}
                  >
                    Detail
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}

        {!isLoading && !error && total > filters.pageSize && (
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={filters.page <= 1 || isBatchRunning}
              onClick={onPrevPage}
              type="button"
            >
              Prev
            </Button>
            <span className="text-xs text-[color:var(--muted-foreground)]">Page {filters.page}</span>
            <Button
              variant="secondary"
              size="sm"
              disabled={filters.page * filters.pageSize >= total || isBatchRunning}
              onClick={onNextPage}
              type="button"
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { BarChart3, CloudCheck, LoaderCircle, UsersRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  totalApplicants: number | null;
  notionSyncedApplicants: number | null;
  isLoading: boolean;
  error: string | null;
};

function formatCount(value: number | null) {
  if (value === null) return "-";
  return value.toLocaleString();
}

export function NotionSyncStatsCard({ totalApplicants, notionSyncedApplicants, isLoading, error }: Props) {
  const safeTotal = totalApplicants ?? 0;
  const safeSynced = notionSyncedApplicants ?? 0;
  const syncedRate = safeTotal > 0 ? Math.round((safeSynced / safeTotal) * 100) : 0;

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-0 shadow-[0_28px_80px_-55px_rgba(14,116,144,0.65)]">
      <div className="pointer-events-none absolute -top-14 -right-10 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-emerald-300/20 blur-2xl" />

      <CardHeader className="relative z-10 p-5 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-5 w-5 text-cyan-700" />
            Notion Sync Overview
          </CardTitle>
          <CardDescription>Live sync status across all applicants</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="relative z-10 grid gap-3 p-5 pt-2 md:grid-cols-2">
        <div className="rounded-2xl border border-sky-100 bg-white/85 p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
            <UsersRound className="h-3.5 w-3.5 text-sky-700" />
            Total applicants
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="text-3xl font-semibold tracking-tight text-slate-900">{formatCount(totalApplicants)}</p>
          )}
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white/85 p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
            <CloudCheck className="h-3.5 w-3.5 text-emerald-700" />
            Synced to Notion
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <p className="text-3xl font-semibold tracking-tight text-slate-900">{formatCount(notionSyncedApplicants)}</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/80 bg-white/80 p-4 md:col-span-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Calculating sync stats...
            </div>
          ) : error ? (
            <div className="text-sm text-rose-600">{error}</div>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Sync rate</span>
                <span>{syncedRate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-[width] duration-700"
                  style={{ width: `${syncedRate}%` }}
                />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

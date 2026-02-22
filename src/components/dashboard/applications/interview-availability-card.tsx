"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { fetchInterviewAvailability } from "@/components/dashboard/applications/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PartType } from "@/types/application";
import { INTERVIEW_PART_TAB_ORDER, type InterviewAvailabilityResponse } from "@/types/interview-availability";

type Props = {
  generationId: string;
  refreshKey?: number;
};

function cellBackgroundColor(availableCount: number, maxAvailableCount: number) {
  if (availableCount === 0) {
    return "rgba(148, 163, 184, 0.08)";
  }

  if (maxAvailableCount <= 0) {
    return "rgba(15, 118, 110, 0.14)";
  }

  const ratio = availableCount / maxAvailableCount;
  const alpha = 0.1 + ratio * 0.48;
  return `rgba(15, 118, 110, ${alpha.toFixed(3)})`;
}

export function InterviewAvailabilityCard({ generationId, refreshKey = 0 }: Props) {
  const [selectedPart, setSelectedPart] = useState<PartType>("PM");
  const [payload, setPayload] = useState<InterviewAvailabilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchInterviewAvailability(generationId, controller.signal);
        setPayload(data);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load interview availability.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void run();
    return () => controller.abort();
  }, [generationId, refreshKey]);

  const selectedTable = useMemo(() => {
    if (!payload) return null;
    return payload.parts[selectedPart];
  }, [payload, selectedPart]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="text-xl">Interview Availability Board</CardTitle>
          <CardDescription>
            Applicants enter unavailable times in text. The board shows inferred available slots every 20 minutes (13:00-19:00).
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {INTERVIEW_PART_TAB_ORDER.map((part) => (
            <Button
              key={part}
              type="button"
              size="sm"
              variant={selectedPart === part ? "primary" : "secondary"}
              onClick={() => setSelectedPart(part)}
            >
              {part}
            </Button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading availability board...
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {!isLoading && !error && payload && selectedTable && (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--muted-foreground)]">
              <span>
                대상 일정:{" "}
                {payload.days
                  .map((day) => `${day.label} (${day.weekday})`)
                  .join(", ")}
              </span>
              <span>파트 지원자: {selectedTable.applicantCount}명</span>
              <span>전체 제출 지원자: {payload.totalApplicantCount}명</span>
              <span>불가능 시간 감지: {payload.unavailabilityDetectedCount}명</span>
            </div>

            <div className="text-xs text-[color:var(--muted-foreground)]">
              색이 진할수록 가능한 인원이 많습니다.
            </div>

            <div className="overflow-auto rounded-xl border border-slate-200">
              <div
                className="grid min-w-[860px]"
                style={{ gridTemplateColumns: `88px repeat(${payload.days.length}, minmax(250px, 1fr))` }}
              >
                <div className="sticky top-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-semibold text-slate-600">
                  Time
                </div>
                {payload.days.map((day) => (
                  <div
                    key={day.key}
                    className="sticky top-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs font-semibold text-slate-600 last:border-r-0"
                  >
                    {day.label} ({day.weekday})
                  </div>
                ))}

                {payload.slots.map((slot, slotIndex) => (
                  <Fragment key={slot.slotIndex}>
                    <div className="border-b border-r border-slate-100 bg-white px-2 py-2 text-center text-xs font-medium text-slate-600">
                      {slot.label}
                    </div>

                    {selectedTable.dayColumns.map((dayColumn) => {
                      const cell = dayColumn.cells[slotIndex];
                      return (
                        <div
                          key={`${dayColumn.dayKey}-${slot.slotIndex}`}
                          className="min-h-16 border-b border-r border-slate-100 px-2 py-2 text-[11px] leading-4 text-slate-800 last:border-r-0"
                          style={{ backgroundColor: cellBackgroundColor(cell.availableCount, selectedTable.maxAvailableCount) }}
                        >
                          <p className="mb-1 text-[10px] font-semibold text-slate-700">{cell.availableCount}명 가능</p>
                          <p className="break-words whitespace-pre-wrap">
                            {cell.availableNames.length > 0 ? cell.availableNames.join(", ") : "-"}
                          </p>
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

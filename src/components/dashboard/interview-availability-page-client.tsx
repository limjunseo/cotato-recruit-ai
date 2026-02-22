"use client";

import { useState } from "react";
import { InterviewAvailabilityCard } from "@/components/dashboard/applications/interview-availability-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  initialGenerationId: string;
};

export function InterviewAvailabilityPageClient({ initialGenerationId }: Props) {
  const [inputGenerationId, setInputGenerationId] = useState(initialGenerationId);
  const [appliedGenerationId, setAppliedGenerationId] = useState(initialGenerationId);

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
        </div>
      </div>

      <InterviewAvailabilityCard generationId={appliedGenerationId} />
    </section>
  );
}

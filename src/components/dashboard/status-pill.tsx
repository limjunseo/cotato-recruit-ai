import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PassStatus } from "@/types/application";

const statusLabels: Record<PassStatus, string> = {
  FAIL: "불합격",
  PASS: "합격",
  PENDING: "대기",
  WAITLISTED: "예비합격",
};

const statusClass: Record<PassStatus, string> = {
  FAIL: "border-rose-200 bg-rose-50 text-rose-700",
  PASS: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  WAITLISTED: "border-sky-200 bg-sky-50 text-sky-700",
};

export function StatusPill({ status }: { status: PassStatus | null }) {
  if (!status) {
    return <Badge className="text-[color:var(--muted-foreground)]">미정</Badge>;
  }
  return <Badge className={cn(statusClass[status])}>{statusLabels[status]}</Badge>;
}

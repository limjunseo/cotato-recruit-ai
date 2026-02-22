import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SyncLogsClient } from "@/components/dashboard/sync-logs-client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function SyncLogsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-6 rounded-3xl border border-white/50 bg-gradient-to-r from-sky-50/80 via-white/85 to-cyan-50/75 p-6 shadow-[0_30px_80px_-55px_rgba(14,116,144,0.45)]">
        <Link href="/applications" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mb-4 inline-flex")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-4xl">RDS Sync Logs</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--muted-foreground)]">
          Pull 실행 이력을 한 페이지에서 확인합니다.
        </p>
      </section>

      <SyncLogsClient />
    </main>
  );
}

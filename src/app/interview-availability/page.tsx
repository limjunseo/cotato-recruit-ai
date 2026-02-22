import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InterviewAvailabilityPageClient } from "@/components/dashboard/interview-availability-page-client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  searchParams: Promise<{
    generationId?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function InterviewAvailabilityPage({ searchParams }: Props) {
  const params = await searchParams;
  const generationId = params.generationId?.trim() ?? "";
  const initialGenerationId = /^\d+$/.test(generationId) ? generationId : "";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-6 rounded-3xl border border-white/50 bg-gradient-to-r from-emerald-50/80 via-white/85 to-teal-50/75 p-6 shadow-[0_30px_80px_-55px_rgba(5,150,105,0.4)]">
        <Link href="/applications" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mb-4 inline-flex")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-4xl">
          Interview Availability Board
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--muted-foreground)]">
          파트별 20분 단위 면접 가능 시간을 확인합니다.
        </p>
      </section>

      <InterviewAvailabilityPageClient initialGenerationId={initialGenerationId} />
    </main>
  );
}

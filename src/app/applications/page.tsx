import { ApplicationsClient } from "@/components/dashboard/applications-client";

export const dynamic = "force-dynamic";

export default function ApplicationsPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-7 rounded-3xl border border-white/50 bg-gradient-to-r from-cyan-50/80 via-white/85 to-emerald-50/75 p-6 shadow-[0_30px_80px_-55px_rgba(14,116,144,0.45)]">
        <p className="mb-2 inline-flex items-center rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-medium text-emerald-700">
          Club Recruitment Admin
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)] sm:text-4xl">
          지원서 운영 대시보드
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[color:var(--muted-foreground)]">
          AWS RDS(MySQL) 기반 지원서를 필터링하고 상세 확인 후 AI 면접 질문을 생성합니다. 노션 반영 전 검토 단계에 맞춘 MVP입니다.
        </p>
      </section>

      <ApplicationsClient />
    </main>
  );
}

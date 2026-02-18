import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-semibold text-[color:var(--foreground)]">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">지원서 ID가 올바른지 확인한 뒤 다시 시도해 주세요.</p>
      <Link href="/applications" className={`${buttonVariants({ variant: "secondary" })} mt-6`}>
        목록으로 이동
      </Link>
    </main>
  );
}

import { NextResponse } from "next/server";
import { getApplications } from "@/lib/applications";

export const dynamic = "force-dynamic";

function toRawParams(searchParams: URLSearchParams) {
  const entries = Array.from(searchParams.entries());
  return Object.fromEntries(entries) as Record<string, string | undefined>;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = await getApplications(toRawParams(searchParams));
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "지원서 목록 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}

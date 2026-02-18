import { NextResponse } from "next/server";
import { getApplicationById } from "@/lib/applications";

type ParamsContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: ParamsContext) {
  const { id } = await context.params;

  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ message: "유효하지 않은 application_id 입니다." }, { status: 400 });
  }

  try {
    const application = await getApplicationById(BigInt(id));
    if (!application) {
      return NextResponse.json({ message: "지원서를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(application);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "지원서 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

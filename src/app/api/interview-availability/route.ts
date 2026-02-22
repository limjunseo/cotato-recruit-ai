import { NextResponse } from "next/server";
import { getInterviewAvailability } from "@/interview-availability/interview-availability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get("generationId")?.trim();

    if (generationId && !/^\d+$/.test(generationId)) {
      return NextResponse.json({ message: "generationId must be numeric." }, { status: 400 });
    }

    const payload = await getInterviewAvailability({ generationId });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load interview availability." },
      { status: 500 },
    );
  }
}

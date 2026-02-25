import { NextResponse } from "next/server";
import { syncInterviewAvailability } from "@/interview-availability/sync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get("generationId")?.trim();
    const useLlmParam = searchParams.get("useLlm")?.trim().toLowerCase();

    if (generationId && !/^\d+$/.test(generationId)) {
      return NextResponse.json({ message: "generationId must be numeric." }, { status: 400 });
    }

    const validBooleanParams = new Set(["1", "0", "true", "false", "yes", "no", "on", "off"]);
    if (useLlmParam && !validBooleanParams.has(useLlmParam)) {
      return NextResponse.json({ message: "useLlm must be boolean-like (1/0/true/false)." }, { status: 400 });
    }

    const useLlm = Boolean(useLlmParam && ["1", "true", "yes", "on"].includes(useLlmParam));
    const payload = await syncInterviewAvailability({ generationId, useLlm });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to sync interview availability." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [totalApplicants, notionSyncedApplicants] = await prisma.$transaction([
      prisma.application.count(),
      prisma.application.count({
        where: { is_synced_to_notion: true },
      }),
    ]);

    return NextResponse.json({
      totalApplicants,
      notionSyncedApplicants,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load Notion sync stats." },
      { status: 500 },
    );
  }
}

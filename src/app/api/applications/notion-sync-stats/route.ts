import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findApplicationExistenceByContact } from "@/notion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await prisma.application.findMany({
      select: {
        application_id: true,
        application_part_type: true,
        phone_number: true,
      },
    });

    if (rows.length === 0) {
      return NextResponse.json({
        totalApplicants: 0,
        notionSyncedApplicants: 0,
      });
    }

    const existence = await findApplicationExistenceByContact(
      rows.map((row) => ({
        applicationId: row.application_id.toString(),
        applicationPartType: row.application_part_type,
        phoneNumber: row.phone_number,
      })),
    );

    const notionSyncedApplicants = existence.filter((item) => item.isExists).length;

    return NextResponse.json({
      totalApplicants: rows.length,
      notionSyncedApplicants,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load Notion sync stats." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { findApplicationExistenceByContact } from "@/notion";

const bodySchema = z.object({
  applicationIds: z.array(z.string().regex(/^\d+$/)).min(1).max(200),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    const uniqueIds = Array.from(new Set(parsed.data.applicationIds));
    const rows = await prisma.application.findMany({
      where: {
        application_id: {
          in: uniqueIds.map((id) => BigInt(id)),
        },
      },
      select: {
        application_id: true,
        application_part_type: true,
        phone_number: true,
      },
    });

    const existence = await findApplicationExistenceByContact(
      rows.map((row) => ({
        applicationId: row.application_id.toString(),
        applicationPartType: row.application_part_type,
        phoneNumber: row.phone_number,
      })),
    );

    return NextResponse.json({
      existence,
      existingApplicationIds: existence.filter((item) => item.isExists).map((item) => item.applicationId),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to check existing Notion contacts." },
      { status: 500 },
    );
  }
}

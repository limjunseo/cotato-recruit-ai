import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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
        is_synced_to_notion: true,
      },
      select: {
        application_id: true,
      },
    });

    const existingApplicationIds = rows.map((row) => row.application_id.toString());

    return NextResponse.json({
      existingApplicationIds,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to check synced applications." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { listRdsSyncRunLogs } from "@/lib/rds-sync-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const parsedLimit = Number.parseInt(limitParam ?? "10", 10);
  const limit = Number.isNaN(parsedLimit) ? 10 : parsedLimit;

  try {
    const items = await listRdsSyncRunLogs(limit);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[rds-sync] failed to load logs", error);
    return NextResponse.json({ message: "Failed to load RDS sync logs." }, { status: 500 });
  }
}

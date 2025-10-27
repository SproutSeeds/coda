import { NextResponse } from "next/server";
import { detectActiveDbEnvKey, hasDevJobsTable } from "@/lib/db/diagnostics";

export const runtime = "nodejs";

export async function GET() {
  const activeKey = detectActiveDbEnvKey();
  const devJobs = await hasDevJobsTable();
  return NextResponse.json({ activeKey, devJobs });
}


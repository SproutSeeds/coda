import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { reorderIdeas } from "@/lib/db/ideas";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const user = await requireUser();
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids : null;
  if (!ids || ids.some((id: unknown) => typeof id !== "string")) {
    return NextResponse.json({ error: "Valid ids array required" }, { status: 400 });
  }

  await reorderIdeas(user.id, ids as string[]);

  return NextResponse.json({ success: true });
}

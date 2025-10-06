import { NextResponse } from "next/server";

import { getTestInbox } from "@/lib/auth/email";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  if (process.env.EMAIL_SERVER !== "stream") {
    return NextResponse.json({ error: "Magic link inbox only available with EMAIL_SERVER=stream" }, { status: 404 });
  }

  const url = new URL(request.url);
  const emailParam = url.searchParams.get("email");
  const consume = url.searchParams.get("consume") === "true";
  if (!emailParam) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }
  const email = emailParam.toLowerCase();

  const inbox = getTestInbox();
  let recordIndex = -1;
  for (let i = inbox.length - 1; i >= 0; i -= 1) {
    if (inbox[i].email === email) {
      recordIndex = i;
      break;
    }
  }

  if (recordIndex === -1) {
    return NextResponse.json({ error: "Magic link not found" }, { status: 404 });
  }

  const record = inbox[recordIndex];
  if (consume) {
    inbox.splice(recordIndex, 1);
  }

  return NextResponse.json({ url: record.url, raw: record.raw });
}

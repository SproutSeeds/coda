import { NextResponse } from "next/server";
import { join } from "path";
import { readFile } from "fs/promises";

export const runtime = "nodejs";

export async function GET() {
  const filePath = join(process.cwd(), "public", "icon-192.png");
  const buffer = await readFile(filePath);
  const uint8 = new Uint8Array(buffer.byteLength);
  uint8.set(buffer);
  return new NextResponse(uint8.buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}

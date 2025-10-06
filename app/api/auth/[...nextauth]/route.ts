import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth/auth";

const handler = NextAuth(authOptions);

export const GET = handler;
export const POST = handler;

export const runtime = "nodejs";

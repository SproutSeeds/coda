import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/auth/session";

import { PublicLayoutFrame } from "./public-layout-frame";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return <PublicLayoutFrame isSignedIn={Boolean(user)}>{children}</PublicLayoutFrame>;
}

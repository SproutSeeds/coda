import { neonAdapter } from "@/lib/providers/neon";
import { vercelAdapter } from "@/lib/providers/vercel";
import { flyAdapter } from "@/lib/providers/fly";
import type { ProviderAdapter } from "@/lib/providers/types";

const registeredAdapters: ProviderAdapter[] = [neonAdapter, vercelAdapter, flyAdapter];

export function getProviderAdapters(): ProviderAdapter[] {
  return registeredAdapters;
}

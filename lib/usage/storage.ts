import type { StorageCategory, StorageCostProjection } from "@/lib/usage/types";
import { USAGE_PROJECTION_BUDGETS } from "@/lib/pricing/cost-model";

export const STORAGE_PRICING: Record<StorageCategory, { perGbMonth: number }> = {
  text: { perGbMonth: 0.02 },
  media: { perGbMonth: 0.05 },
  audio: { perGbMonth: 0.08 },
};

export const STORAGE_CATEGORY_METADATA: Record<
  StorageCategory,
  { label: string; description: string; color: string; unitLabel: string; unitCost: number; vendor: string }
> = {
  text: {
    label: "Rich Text & Docs",
    description: "Markdown, comments, and structured text stored in Neon.",
    color: "indigo",
    unitLabel: "GB-month",
    unitCost: STORAGE_PRICING.text.perGbMonth,
    vendor: "neon_postgres",
  },
  media: {
    label: "Images & Visuals",
    description: "Uploaded images, cover art, and lightweight diagrams.",
    color: "cyan",
    unitLabel: "GB-month",
    unitCost: STORAGE_PRICING.media.perGbMonth,
    vendor: "vercel_storage",
  },
  audio: {
    label: "Audio & Large Assets",
    description: "Audio captures, transcripts, and larger binary blobs.",
    color: "amber",
    unitLabel: "GB-month",
    unitCost: STORAGE_PRICING.audio.perGbMonth,
    vendor: "fly_relay",
  },
};

export const STORAGE_CATEGORY_LABELS: Record<StorageCategory, string> = {
  text: STORAGE_CATEGORY_METADATA.text.label,
  media: STORAGE_CATEGORY_METADATA.media.label,
  audio: STORAGE_CATEGORY_METADATA.audio.label,
};

export const STORAGE_CATEGORY_ORDER: StorageCategory[] = ["text", "media", "audio"];

export const STORAGE_FIELD_MAP: Record<StorageCategory, "textBytes" | "mediaBytes" | "audioBytes"> = {
  text: "textBytes",
  media: "mediaBytes",
  audio: "audioBytes",
};

export const STORAGE_ACTION_MAP: Record<string, StorageCategory> = {
  "idea.create": "text",
  "idea.export": "media",
  "feature.create": "text",
  "collaborator.invite": "text",
  "collaborator.add": "text",
  "join-request.create": "text",
  "analytics.event": "text",
  "devmode.minute": "audio",
  "devmode.byte": "audio",
};

const BYTES_PER_GIGABYTE = 1024 ** 3;
const DAYS_PER_MONTH = 30;

const gigabyteFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const budgetFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatBytes(value: number): string {
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const normalized = value / Math.pow(1024, index);
  return `${normalized.toFixed(normalized >= 10 ? 1 : 2)} ${units[index]}`;
}

export function calculateDailyStorageCost(bytes: number, category: StorageCategory): number {
  if (bytes <= 0) return 0;
  const gb = bytes / BYTES_PER_GIGABYTE;
  const rate = STORAGE_PRICING[category]?.perGbMonth ?? 0;
  return (gb * rate) / DAYS_PER_MONTH;
}

function formatStorageSummary(budgetUsd: number, gigabytes: number, category: StorageCategory): string {
  if (!Number.isFinite(gigabytes) || gigabytes <= 0) {
    return `${budgetFormatter.format(budgetUsd)} — insufficient data`;
  }

  const formattedGb =
    gigabytes >= 100 ? gigabyteFormatter.format(Math.round(gigabytes)) : gigabyteFormatter.format(gigabytes);

  return `${budgetFormatter.format(budgetUsd)} ≈ ${formattedGb} GB-month of ${STORAGE_CATEGORY_METADATA[category].label}`;
}

export function calculateStorageProjections(
  category: StorageCategory,
  budgets = USAGE_PROJECTION_BUDGETS,
): StorageCostProjection[] {
  const rate = STORAGE_PRICING[category]?.perGbMonth ?? 0;

  return budgets.map((budgetUsd) => {
    const gigabytes = rate > 0 ? budgetUsd / rate : Number.POSITIVE_INFINITY;

    return {
      budgetUsd,
      gigabytes,
      summary: formatStorageSummary(budgetUsd, gigabytes, category),
    };
  });
}

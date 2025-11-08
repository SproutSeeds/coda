import type { CategoryKey } from "@/lib/usage/types";

type CategoryMetadata = {
  label: string;
  color: string;
  icon: string;
  description: string;
};

export const CATEGORY_METADATA: Record<CategoryKey, CategoryMetadata> = {
  creation: {
    label: "Creation",
    color: "blue",
    icon: "Sparkles",
    description: "Idea + feature creation, covering Neon inserts and storage.",
  },
  collaboration: {
    label: "Collaboration",
    color: "purple",
    icon: "Users",
    description: "Invites, approvals, and join requests routed through email + Neon.",
  },
  delivery: {
    label: "Delivery",
    color: "green",
    icon: "Send",
    description: "Idea export bandwidth + compute on Vercel functions.",
  },
  authentication: {
    label: "Authentication",
    color: "orange",
    icon: "Mail",
    description: "Magic link + password reset emails via Resend.",
  },
  analytics: {
    label: "Analytics",
    color: "pink",
    icon: "LineChart",
    description: "Vercel Analytics ingestion per event.",
  },
  devmode: {
    label: "Dev Mode",
    color: "cyan",
    icon: "Terminal",
    description: "Fly.io relay minutes + terminal bandwidth.",
  },
};

export const ACTION_CATEGORY_MAP: Record<string, CategoryKey> = {
  "idea.create": "creation",
  "feature.create": "creation",
  "collaborator.invite": "collaboration",
  "collaborator.add": "collaboration",
  "join-request.create": "collaboration",
  "idea.export": "delivery",
  "auth.email": "authentication",
  "analytics.event": "analytics",
  "devmode.minute": "devmode",
  "devmode.byte": "devmode",
};

export const CATEGORY_ORDER: CategoryKey[] = [
  "creation",
  "collaboration",
  "delivery",
  "authentication",
  "analytics",
  "devmode",
];

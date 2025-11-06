"use server";

import { requireUser } from "@/lib/auth/session";
import { trackEvent } from "@/lib/utils/analytics";

type FilterEventPayload = {
  tab: string;
  category: string | null;
  vendor: string | null;
  plan: string | null;
};

type CtaEventPayload = {
  actionId: string;
  cta: string;
  href: string;
};

type RecordCostCatalogueEventInput =
  | { type: "filter"; payload: FilterEventPayload }
  | { type: "cta"; payload: CtaEventPayload };

export async function recordCostCatalogueEvent(input: RecordCostCatalogueEventInput): Promise<void> {
  const user = await requireUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  if (input.type === "filter") {
    await trackEvent({
      name: "costCatalogue.filter.changed",
      properties: {
        userId: user.id,
        tab: input.payload.tab,
        category: input.payload.category,
        vendor: input.payload.vendor,
        plan: input.payload.plan,
      },
    });
    return;
  }

  await trackEvent({
    name: "costCatalogue.cta.clicked",
    properties: {
      userId: user.id,
      actionId: input.payload.actionId,
      cta: input.payload.cta,
      href: input.payload.href,
    },
  });
}

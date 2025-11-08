"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type LimitDialogOptions = {
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  dismissLabel?: string;
  notes?: string[];
  onClose?: () => void;
};

const LimitDialogContext = createContext<{
  openLimitDialog: (options?: LimitDialogOptions) => void;
} | null>(null);

const DEFAULT_TITLE = "Upgrade to keep going";
const DEFAULT_DESCRIPTION =
  "You’ve hit the current limit for this action on your plan. Upgrade or request an override to continue in the cloud.";
const DEFAULT_CTA = "View plans";
const DEFAULT_CTA_HREF = "/dashboard/account";

export function LimitDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<LimitDialogOptions | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    options?.onClose?.();
  }, [options]);

  const openDialog = useCallback((opts?: LimitDialogOptions) => {
    setOptions(opts ?? null);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openLimitDialog: openDialog }), [openDialog]);

  const title = options?.title ?? DEFAULT_TITLE;
  const description = options?.description ?? DEFAULT_DESCRIPTION;
  const ctaLabel = options?.ctaLabel ?? DEFAULT_CTA;
  const ctaHref = options?.ctaHref ?? DEFAULT_CTA_HREF;
  const secondaryLabel = options?.secondaryCtaLabel ?? null;
  const secondaryHref = options?.secondaryCtaHref ?? null;
  const dismissLabel = options?.dismissLabel ?? "Not now";
  const notes = options?.notes ?? [];

  return (
    <LimitDialogContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : close())}>
        <DialogContent className="gap-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {notes.length > 0 ? (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {notes.map((note, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <DialogFooter className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              className="sm:order-2"
              onClick={() => close()}
            >
              {dismissLabel}
            </Button>
            <Button
              type="button"
              asChild
              className="sm:order-1"
            >
              <a href={ctaHref}>{ctaLabel}</a>
            </Button>
            {secondaryLabel && secondaryHref ? (
              <Button type="button" variant="outline" asChild className="sm:order-3">
                <a href={secondaryHref}>{secondaryLabel}</a>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LimitDialogContext.Provider>
  );
}

export function useLimitDialog() {
  const context = useContext(LimitDialogContext);
  if (!context) {
    throw new Error("useLimitDialog must be used within a LimitDialogProvider");
  }
  return context;
}

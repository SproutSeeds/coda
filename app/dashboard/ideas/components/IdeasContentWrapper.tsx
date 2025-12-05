"use client";

import { useSearchParams } from "next/navigation";
import { FadeContent } from "@/app/dashboard/components/FadeContent";
import { ReactNode } from "react";

interface IdeasContentWrapperProps {
  children: ReactNode;
}

/**
 * Client wrapper that controls Ideas content visibility based on URL param.
 * Reads ?show=ideas from URL - if present, Ideas is visible; if not, hidden.
 * Uses FadeContent for smooth fade in/out with full unmount when hidden.
 */
export function IdeasContentWrapper({ children }: IdeasContentWrapperProps) {
  const searchParams = useSearchParams();
  const visibleContent = searchParams.get("show")?.split(",").filter(Boolean) || [];
  const isVisible = visibleContent.includes("ideas");

  return (
    <FadeContent visible={isVisible}>
      {children}
    </FadeContent>
  );
}

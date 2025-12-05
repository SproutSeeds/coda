"use client";

import { useState, useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FadeContentProps {
  visible: boolean;
  children: ReactNode;
  className?: string;
  /** Duration of fade animation in ms (default: 300) */
  duration?: number;
}

/**
 * Performance-optimized content wrapper with fade in/out.
 *
 * - Fades content in/out with CSS transitions (not Framer Motion per-element)
 * - After fade-out completes, content is fully unmounted from DOM (frees memory)
 * - When toggled back on, content re-renders fresh
 */
export function FadeContent({
  visible,
  children,
  className,
  duration = 300
}: FadeContentProps) {
  const [shouldRender, setShouldRender] = useState(visible);
  const [showContent, setShowContent] = useState(visible);

  useEffect(() => {
    if (visible) {
      // First: mount the content (invisible)
      setShouldRender(true);
      // Then: after a frame, trigger the fade-in
      // Using double rAF to ensure the browser has painted the initial state
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShowContent(true);
        });
      });
    } else {
      // Start fade-out immediately
      setShowContent(false);
      // Wait for fade-out animation before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration]);

  // Don't render anything when hidden and animation complete
  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        "transition-opacity ease-out",
        showContent ? "opacity-100" : "opacity-0",
        className
      )}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SpeedHUDProps {
  speed: number;       // 0.0 to 5.0 multiplier
  isCruising: boolean; // Whether cruise mode is active
  visible: boolean;    // Controls fade in/out
}

/**
 * Glassy HUD overlay showing cruise speed percentage
 * Fades in over 1.5s, stays visible while active, fades out over 4s
 */
export function SpeedHUD({ speed, isCruising, visible }: SpeedHUDProps) {
  const [opacity, setOpacity] = useState(0);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // Small delay then fade in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOpacity(1);
        });
      });
    } else {
      setOpacity(0);
      // After fade out completes, stop rendering
      const timer = setTimeout(() => setShouldRender(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!shouldRender) return null;

  // Display text based on cruise state
  const displayText = !isCruising
    ? "CRUISE OFF"
    : speed <= 0
    ? "STOPPED"
    : `${Math.round(speed * 100)}%`;

  return (
    <div
      className={cn(
        "fixed top-20 right-6 z-50 px-4 py-3 rounded-xl",
        "bg-[#0a0b10]/70 backdrop-blur-xl border border-white/10",
        "shadow-[0_0_30px_rgba(0,255,255,0.1)]",
        "pointer-events-none select-none"
      )}
      style={{
        opacity,
        transition: `opacity ${visible ? "1500ms" : "4000ms"} ease-out`,
      }}
    >
      <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
        Cruise Speed
      </div>
      <div
        className={cn(
          "font-mono text-xl tabular-nums",
          isCruising ? "text-cyan-400/90" : "text-white/40"
        )}
      >
        {displayText}
      </div>
    </div>
  );
}

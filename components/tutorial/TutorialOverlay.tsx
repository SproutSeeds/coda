"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useTutorial } from "./TutorialProvider";
import { Spotlight } from "./Spotlight";
import { TooltipBubble } from "./TooltipBubble";

export function TutorialOverlay() {
  const { activeStep, hideTutorial } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!activeStep) return;

    const updateRect = () => {
      const element = document.querySelector(`[data-tutorial="${activeStep.targetId}"]`);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    const interval = setInterval(updateRect, 500);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [activeStep]);

  if (!activeStep || !targetRect) return null;

  return (
    <>
      <AnimatePresence>
        <Spotlight rect={targetRect} onDismiss={hideTutorial} />
      </AnimatePresence>
      
      <AnimatePresence mode="wait">
        <TooltipBubble
          key={activeStep.id}
          step={activeStep}
          rect={targetRect}
        />
      </AnimatePresence>
    </>
  );
}

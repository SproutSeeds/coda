"use client";

import { motion } from "framer-motion";
import { TutorialStep } from "@/lib/journey/tutorial-steps";

interface TooltipBubbleProps {
  step: TutorialStep;
  rect: DOMRect;
}

export function TooltipBubble({
  step,
  rect,
}: TooltipBubbleProps) {
  // Simple positioning logic
  let top = rect.bottom + 20;
  let left = rect.left + (rect.width / 2) - 150; // Center horizontally (width 300px)
  let transformOrigin = "top center";

  // Basic bounds checking
  if (left < 20) left = 20;
  if (left + 300 > window.innerWidth) left = window.innerWidth - 320;

  if (step.placement === "top" || (rect.bottom > window.innerHeight - 200)) {
    top = rect.top - 140; // Shift up
    transformOrigin = "bottom center";
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      style={{ top, left, transformOrigin }}
      className="fixed z-50 w-[300px] rounded-xl border border-purple-500/30 bg-[#0a0b10]/95 p-5 shadow-[0_0_40px_-10px_rgba(168,85,247,0.3)] backdrop-blur-xl text-white pointer-events-none"
    >
      {/* Content */}
      <h3 className="text-lg font-semibold mb-2 text-purple-100">{step.title}</h3>
      <p className="text-sm text-white/70 leading-relaxed">
        {step.description}
      </p>
    </motion.div>
  );
}

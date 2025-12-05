"use client";

import { motion } from "framer-motion";

interface SpotlightProps {
  rect: DOMRect;
  onDismiss: () => void;
}

export function Spotlight({ rect, onDismiss }: SpotlightProps) {
  const { innerWidth, innerHeight } = window;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40"
    >
      {/* 4-Part Backdrop to create a clickable hole */}
      
      {/* Top */}
      <div 
        className="absolute bg-black/70 cursor-pointer"
        style={{ top: 0, left: 0, width: "100%", height: rect.top }}
        onClick={onDismiss}
      />
      
      {/* Bottom */}
      <div 
        className="absolute bg-black/70 cursor-pointer"
        style={{ top: rect.bottom, left: 0, width: "100%", height: innerHeight - rect.bottom }}
        onClick={onDismiss}
      />

      {/* Left */}
      <div 
        className="absolute bg-black/70 cursor-pointer"
        style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }}
        onClick={onDismiss}
      />

      {/* Right */}
      <div 
        className="absolute bg-black/70 cursor-pointer"
        style={{ top: rect.top, left: rect.right, width: innerWidth - rect.right, height: rect.height }}
        onClick={onDismiss}
      />

      {/* Highlight Ring (Visual only) */}
      <div
        className="absolute pointer-events-none border-2 border-white/30 rounded-lg animate-pulse shadow-[0_0_20px_rgba(255,255,255,0.2)]"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
      />
    </motion.div>
  );
}

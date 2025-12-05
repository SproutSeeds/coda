"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface BillingCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "sorcerer" | "wanderer" | "danger" | "success";
  delay?: number;
}

export function BillingCard({ 
  children, 
  className, 
  variant = "default",
  delay = 0 
}: BillingCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["2deg", "-2deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-2deg", "2deg"]);

  const holoBackground = useTransform(
    mouseXSpring,
    [-0.5, 0.5],
    [
      "linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.0) 50%)",
      "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 60%, rgba(255,255,255,0.0) 70%)"
    ]
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "sorcerer":
        return "border-amber-500/30 bg-amber-900/10 hover:border-amber-500/50 shadow-[0_0_30px_-10px_rgba(245,158,11,0.15)]";
      case "wanderer":
        return "border-purple-500/30 bg-purple-900/10 hover:border-purple-500/50 shadow-[0_0_30px_-10px_rgba(168,85,247,0.15)]";
      case "danger":
        return "border-red-500/30 bg-red-900/10 hover:border-red-500/50";
      case "success":
        return "border-emerald-500/30 bg-emerald-900/10 hover:border-emerald-500/50";
      default:
        return "border-white/10 bg-white/5 hover:border-white/20";
    }
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className="perspective-1000"
    >
      <div
        className={cn(
          "relative rounded-xl border backdrop-blur-md transition-all duration-300 h-full",
          getVariantStyles(),
          className
        )}
      >
        {/* Holo Effect */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: holoBackground, backgroundSize: "200% 200%" }}
        />

        {/* Content */}
        <div className="relative z-20 p-6 h-full">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

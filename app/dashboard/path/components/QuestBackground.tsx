"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

type Particle = {
  id: number;
  size: number;
  left: string;
  duration: number;
  delay: number;
};

export function QuestBackground() {
  // Generate particles only on client to avoid hydration mismatch
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 20 }).map((_, i) => ({
        id: i,
        size: Math.random() * 3 + 1,
        left: `${Math.random() * 100}%`,
        duration: Math.random() * 10 + 10,
        delay: Math.random() * 5,
      }))
    );
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#050505]">
      {/* --- Background Effects --- */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,#000000_0%,transparent_50%)]" />

      {/* Subtle grid */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      {/* Particles - only render after client hydration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white/10 blur-[1px]"
            style={{
              width: p.size,
              height: p.size,
              left: p.left,
              bottom: -20,
            }}
            animate={{
              y: [0, -1000],
              x: [0, Math.sin(p.id) * 50],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "linear",
            }}
          />
        ))}
      </div>
    </div>
  );
}

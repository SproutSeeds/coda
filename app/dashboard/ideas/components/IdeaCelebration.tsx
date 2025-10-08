"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const PARTICLE_COLORS = ["#60a5fa", "#22d3ee", "#5eead4", "#c084fc", "#f472b6"];

const PARTICLES = Array.from({ length: 12 }).map((_, index) => ({
  id: index,
  color: PARTICLE_COLORS[index % PARTICLE_COLORS.length],
  originX: Math.cos((index / 12) * Math.PI * 2),
  originY: Math.sin((index / 12) * Math.PI * 2),
}));

export function IdeaCelebration({ active }: { active: boolean }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return null;
  }

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key="celebration"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="absolute size-36 rounded-full bg-gradient-to-br from-sky-400/70 via-fuchsia-400/60 to-teal-300/60 blur-2xl"
          />
          {PARTICLES.map((particle) => (
            <motion.span
              key={particle.id}
              initial={{
                x: 0,
                y: 0,
                scale: 0.4,
                opacity: 0,
              }}
              animate={{
                x: particle.originX * 80,
                y: particle.originY * 80,
                scale: [0.6, 1.05, 0.8],
                opacity: [0, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.9,
                ease: "easeOut",
              }}
              style={{
                background: particle.color,
              }}
              className="absolute size-5 rounded-full shadow-lg shadow-sky-500/30"
            />
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

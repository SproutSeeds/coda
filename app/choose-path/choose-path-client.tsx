"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { MorphingText } from "@/components/effects/MorphingText";
import { selectSorcererAnnualAction, selectSorcererMonthlyAction, startGauntletAction } from "./actions";

// --- Word Pair Cycling Animation ---
// Separate verbs and nouns that can combine in any pairing
const VERBS = [
  "DETECTING",
  "CHANNELING",
  "AWAKENING",
  "SENSING",
  "CALLING",
  "UNLOCKING",
  "TRACING",
  "ALIGNING",
  "SCANNING",
  "IGNITING",
  "WEAVING",
  "FORGING",
  "SEEKING",
  "INVOKING",
  "TUNING",
  "READING",
];

const NOUNS = [
  "RESONANCE",
  "ESSENCE",
  "POTENTIAL",
  "ENERGY",
  "SOURCE",
  "POWER",
  "PATHWAYS",
  "FREQUENCIES",
  "HORIZONS",
  "SPARK",
  "THREADS",
  "DESTINY",
  "SIGNAL",
  "FLOW",
  "ECHOES",
  "PULSE",
];

function CyclingWordPairs() {
  const [verbIndex, setVerbIndex] = useState(0);
  const [nounIndex, setNounIndex] = useState(0);
  const [changingColumn, setChangingColumn] = useState<"verb" | "noun" | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Mark as client-side to avoid hydration mismatch with shuffled arrays
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Shuffle arrays on mount for variety (only on client)
  const shuffledVerbs = useMemo(() => {
    if (!isClient) return VERBS;
    const verbs = [...VERBS];
    for (let i = verbs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [verbs[i], verbs[j]] = [verbs[j], verbs[i]];
    }
    return verbs;
  }, [isClient]);

  const shuffledNouns = useMemo(() => {
    if (!isClient) return NOUNS;
    const nouns = [...NOUNS];
    for (let i = nouns.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nouns[i], nouns[j]] = [nouns[j], nouns[i]];
    }
    return nouns;
  }, [isClient]);

  const displayedVerb = shuffledVerbs[verbIndex];
  const displayedNoun = shuffledNouns[nounIndex];

  // Alternate between changing verb and noun
  useEffect(() => {
    if (!isClient) return;

    let isVerbNext = true;

    const interval = setInterval(() => {
      if (isVerbNext) {
        // Change verb
        setChangingColumn("verb");
        setTimeout(() => {
          setVerbIndex((prev) => (prev + 1) % shuffledVerbs.length);
          setTimeout(() => setChangingColumn(null), 100);
        }, 800);
      } else {
        // Change noun
        setChangingColumn("noun");
        setTimeout(() => {
          setNounIndex((prev) => (prev + 1) % shuffledNouns.length);
          setTimeout(() => setChangingColumn(null), 100);
        }, 800);
      }
      isVerbNext = !isVerbNext;
    }, 4000);

    return () => clearInterval(interval);
  }, [isClient, shuffledVerbs.length, shuffledNouns.length]);

  return (
    <div className="mb-4 font-mono text-sm tracking-widest text-purple-300/60 flex items-center justify-center gap-1">
      <span>&gt;</span>
      <div className="relative overflow-hidden h-[1.4em]">
        <div
          style={{
            transition: 'all 1.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
            opacity: changingColumn === "verb" ? 0 : 1,
            transform: changingColumn === "verb" ? 'translateY(-100%)' : 'translateY(0)',
          }}
        >
          {displayedVerb}
        </div>
      </div>
      <span>_</span>
      <div className="relative overflow-hidden h-[1.4em]">
        <div
          style={{
            transition: 'all 1.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
            opacity: changingColumn === "noun" ? 0 : 1,
            transform: changingColumn === "noun" ? 'translateY(100%)' : 'translateY(0)',
          }}
        >
          {displayedNoun}
        </div>
      </div>
      <span className="animate-pulse">_</span>
    </div>
  );
}

// --- Glowing Edge Card ---
function GlassCard({
  children,
  className,
  opacity = 5,
}: {
  children: React.ReactNode;
  className?: string;
  opacity?: number; // 0-100 scale
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pointerAngle, setPointerAngle] = useState(45);
  const [targetAngle, setTargetAngle] = useState(45);
  const [pointerDistance, setPointerDistance] = useState(0);
  const [targetDistance, setTargetDistance] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  // Smoothly interpolate angle and distance for gradual edge glow movement
  useEffect(() => {
    let animationId: number;
    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

    // Handle angle wrapping (e.g., 350 -> 10 should go through 360, not backwards)
    const lerpAngle = (start: number, end: number, factor: number) => {
      let diff = end - start;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      let result = start + diff * factor;
      if (result < 0) result += 360;
      if (result >= 360) result -= 360;
      return result;
    };

    const animate = () => {
      setPointerAngle(prev => lerpAngle(prev, targetAngle, 0.08)); // Slow interpolation
      setPointerDistance(prev => lerp(prev, targetDistance, 0.06)); // Even slower for distance
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [targetAngle, targetDistance]);

  // Convert 0-100 to actual opacity values
  const bgOpacity = (opacity / 100) * 0.0375;
  const blur = 4 + (opacity / 100) * 3;

  // Use document-level mouse tracking for more reliable hover detection
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if mouse is within card bounds
      const isInside = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
      setIsHovering(isInside);

      if (!isInside) return;

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = x - cx;
      const dy = y - cy;

      // Calculate angle from center to pointer - this controls WHERE the glow appears on the edge
      let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;
      setTargetAngle(angle); // Set target, not direct value

      // Calculate closeness to edge (0 = center, 1 = edge)
      // Used to intensify the edge glow when cursor is near edges
      let kX = Infinity;
      let kY = Infinity;
      if (dx !== 0) kX = cx / Math.abs(dx);
      if (dy !== 0) kY = cy / Math.abs(dy);
      const edge = Math.min(Math.max(1 / Math.min(kX, kY), 0), 1);
      setTargetDistance(edge * 100); // Set target, not direct value
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Card stays fully lit when hovering - glow intensity increases near edges
  // Edge glow: subtle at center, brighter near edges
  const edgeGlowIntensity = 0.4 + (pointerDistance / 100) * 0.6; // 0.4 at center, 1.0 at edge

  return (
    <div
      ref={cardRef}
      className={cn("relative rounded-3xl isolate", className)}
      style={{
        ['--pointer-angle' as string]: `${pointerAngle}deg`,
        ['--edge-glow-intensity' as string]: isHovering ? edgeGlowIntensity : 0,
      }}
    >
      {/* Base glass background - stays lit when hovering */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          background: isHovering
            ? `rgba(255, 255, 255, ${bgOpacity + 0.02})`
            : `rgba(255, 255, 255, ${bgOpacity})`,
          backdropFilter: `blur(${blur}px)`,
          WebkitBackdropFilter: `blur(${blur}px)`,
          border: isHovering
            ? '1px solid rgba(255, 255, 255, 0.2)'
            : '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'all 1.5s cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      />

      {/* Subtle ambient glow when hovering - always visible */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          opacity: isHovering ? 0.15 : 0,
          background: `
            radial-gradient(ellipse at 50% 50%, rgba(200, 180, 255, 0.3) 0%, transparent 70%)
          `,
          transition: 'opacity 1.5s cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      />

      {/* Mesh gradient border - colored edges that follow cursor */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          opacity: isHovering ? 1 : 0,
          border: '1px solid transparent',
          background: `
            linear-gradient(rgba(5,5,5,1) 0 100%) padding-box,
            linear-gradient(rgba(255,255,255,0) 0% 100%) border-box,
            radial-gradient(at 80% 55%, hsla(268,100%,76%,1) 0px, transparent 50%) border-box,
            radial-gradient(at 69% 34%, hsla(349,100%,74%,1) 0px, transparent 50%) border-box,
            radial-gradient(at 8% 6%, hsla(136,100%,78%,1) 0px, transparent 50%) border-box,
            radial-gradient(at 41% 38%, hsla(192,100%,64%,1) 0px, transparent 50%) border-box,
            radial-gradient(at 86% 85%, hsla(186,100%,74%,1) 0px, transparent 50%) border-box,
            radial-gradient(at 82% 18%, hsla(52,100%,65%,1) 0px, transparent 50%) border-box,
            radial-gradient(at 51% 4%, hsla(12,100%,72%,1) 0px, transparent 50%) border-box,
            linear-gradient(#c299ff 0 100%) border-box
          `,
          maskImage: `conic-gradient(from var(--pointer-angle) at center, black 20%, transparent 35%, transparent 65%, black 80%)`,
          WebkitMaskImage: `conic-gradient(from var(--pointer-angle) at center, black 20%, transparent 35%, transparent 65%, black 80%)`,
          transition: 'opacity 1.2s cubic-bezier(0.25, 0.1, 0.25, 1), mask-image 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      />

      {/* Mesh gradient inner glow - follows cursor along edges */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          opacity: isHovering ? 0.6 : 0,
          mixBlendMode: 'soft-light',
          background: `
            radial-gradient(at 80% 55%, hsla(268,100%,76%,0.5) 0px, transparent 50%),
            radial-gradient(at 69% 34%, hsla(349,100%,74%,0.5) 0px, transparent 50%),
            radial-gradient(at 8% 6%, hsla(136,100%,78%,0.5) 0px, transparent 50%),
            radial-gradient(at 41% 38%, hsla(192,100%,64%,0.5) 0px, transparent 50%),
            radial-gradient(at 86% 85%, hsla(186,100%,74%,0.5) 0px, transparent 50%),
            radial-gradient(at 82% 18%, hsla(52,100%,65%,0.5) 0px, transparent 50%),
            radial-gradient(at 51% 4%, hsla(12,100%,72%,0.5) 0px, transparent 50%)
          `,
          maskImage: `
            radial-gradient(ellipse at 50% 50%, transparent 50%, black 100%),
            conic-gradient(from var(--pointer-angle) at center, transparent 5%, black 20%, black 80%, transparent 95%)
          `,
          WebkitMaskImage: `
            radial-gradient(ellipse at 50% 50%, transparent 50%, black 100%),
            conic-gradient(from var(--pointer-angle) at center, transparent 5%, black 20%, black 80%, transparent 95%)
          `,
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in',
          transition: 'opacity 1.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      />

      {/* Edge glow - outer shine that follows cursor, intensifies near edges */}
      <div
        className="absolute -inset-8 rounded-3xl pointer-events-none"
        style={{
          opacity: `var(--edge-glow-intensity)`,
          mixBlendMode: 'plus-lighter',
          maskImage: `conic-gradient(from var(--pointer-angle) at center, black 5%, transparent 15%, transparent 85%, black 95%)`,
          WebkitMaskImage: `conic-gradient(from var(--pointer-angle) at center, black 5%, transparent 15%, transparent 85%, black 95%)`,
          transition: 'opacity 1s cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      >
        <div
          className="absolute rounded-3xl"
          style={{
            inset: '32px',
            boxShadow: `
              inset 0 0 0 1px hsla(280, 80%, 75%, 0.8),
              inset 0 0 2px 0 hsla(280, 80%, 75%, 0.5),
              inset 0 0 6px 0 hsla(280, 80%, 75%, 0.4),
              inset 0 0 12px 0 hsla(280, 80%, 75%, 0.3),
              inset 0 0 20px 2px hsla(280, 80%, 75%, 0.2),
              0 0 2px 0 hsla(280, 80%, 75%, 0.5),
              0 0 6px 0 hsla(280, 80%, 75%, 0.4),
              0 0 12px 0 hsla(280, 80%, 75%, 0.3),
              0 0 20px 2px hsla(280, 80%, 75%, 0.2),
              0 0 35px 4px hsla(280, 80%, 75%, 0.1)
            `,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

type PlanLimits = {
  maxIdeas: number;
  maxFeaturesPerIdea: number;
  storageGb: number;
  monthlyMana: number;
};

type Pricing = {
  monthly: { usd: number };
  annual: { usd: number; monthlyEquivalent: number; savings: number };
};

interface ChoosePathClientProps {
  sorcererLimits: PlanLimits;
  pricing: Pricing;
}


// --- 3D Tilt Card Component ---
function TiltCard({
  children,
  className,
  onClick,
  isSelected,
  isOtherSelected,
  animationPhase
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  isSelected: boolean;
  isOtherSelected: boolean;
  animationPhase: "idle" | "fading-out" | "fading-in";
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Mouse position for tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth spring physics for the tilt
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  // Transform mouse position to rotation degrees
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7deg", "7deg"]);

  // Disable tilt when animating or selected
  const tiltDisabled = isSelected || isOtherSelected || animationPhase !== "idle";

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (tiltDisabled) return;

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

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        rotateX: tiltDisabled ? undefined : rotateX,
        rotateY: tiltDisabled ? undefined : rotateY,
        transformStyle: tiltDisabled ? "flat" : "preserve-3d",
        transform: tiltDisabled ? "none" : undefined,
      }}
      className={cn(
        "relative transform-gpu cursor-pointer pointer-events-auto",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

export function ChoosePathClient({ pricing }: ChoosePathClientProps) {
  const [selectedPath, setSelectedPath] = useState<"wanderer" | "sorcerer" | null>(null);
  const [selectedPricing, setSelectedPricing] = useState<"monthly" | "annual">("annual"); // Default to annual (best value)
  const [cardOpacity, setCardOpacity] = useState(15); // 0-100, default fairly transparent
  const [animationPhase, setAnimationPhase] = useState<"idle" | "fading-out" | "fading-in">("idle");
  const [isExiting, setIsExiting] = useState(false); // Track when user clicks final CTA button

  // Refs for particle effect positioning
  const headerRef = useRef<HTMLDivElement>(null);
  const wandererCardRef = useRef<HTMLDivElement>(null);
  const sorcererCardRef = useRef<HTMLDivElement>(null);

  // Handle card selection - two-phase fade animation
  const handleCardSelect = async (path: 'wanderer' | 'sorcerer') => {
    if (selectedPath || animationPhase !== "idle") return;

    // Phase 1: Fade out everything
    setAnimationPhase("fading-out");
    await new Promise(resolve => setTimeout(resolve, 400));

    // Phase 2: Set selection and fade in expanded card
    setSelectedPath(path);
    setAnimationPhase("fading-in");
    await new Promise(resolve => setTimeout(resolve, 400));

    // Return to idle
    setAnimationPhase("idle");
  };

  // Handle close - two-phase fade animation
  const handleClose = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!selectedPath || animationPhase !== "idle") return;

    // Phase 1: Fade out expanded card
    setAnimationPhase("fading-out");
    await new Promise(resolve => setTimeout(resolve, 400));

    // Phase 2: Clear selection and fade in original state
    setSelectedPath(null);
    setAnimationPhase("fading-in");
    await new Promise(resolve => setTimeout(resolve, 400));

    // Return to idle
    setAnimationPhase("idle");
  };

  // Load card opacity from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('choose-path-card-opacity');
    if (saved) {
      try {
        const opacity = parseInt(saved, 10);
        if (!isNaN(opacity)) setCardOpacity(opacity);
      } catch {
        // Invalid, use default
      }
    }
  }, []);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedPath) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [selectedPath]);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden text-white selection:bg-purple-500/30">

      {/* TubesEffect and QuestFlowControl now provided by GlobalVisualShell */}

      {/* --- Header --- */}
      <motion.div
        ref={headerRef}
        initial={{ opacity: 0 }}
        animate={{
          opacity: selectedPath || animationPhase === "fading-out" ? 0 : 1,
        }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-10 mb-12 text-center"
        style={{ pointerEvents: selectedPath || animationPhase !== "idle" ? 'none' : 'auto' }}
      >
        <CyclingWordPairs />
        <p className="text-lg text-white">
          The path is singular. The pace is yours. Will you drift as a Wanderer, or ascend as a Sorcerer?
        </p>
      </motion.div>

      {/* --- Click-away backdrop to close selected card --- */}
      <AnimatePresence>
        {selectedPath && animationPhase === "idle" && !isExiting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed inset-0 z-40 cursor-pointer"
            onClick={handleClose}
          />
        )}
      </AnimatePresence>

      {/* --- Small Cards Container (only when no selection) --- */}
      {!selectedPath && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: animationPhase === "fading-out" ? 0 : 1 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative flex w-full max-w-6xl flex-col items-center justify-center gap-8 px-4 md:flex-row z-30"
          style={{ perspective: "1000px" }}
        >
          {/* --- WANDERER SMALL CARD --- */}
          <div
            ref={wandererCardRef}
            className="relative w-full max-w-[400px]"
                      >
            <GlassCard opacity={cardOpacity}>
              <TiltCard
                isSelected={false}
                isOtherSelected={false}
                animationPhase={animationPhase}
                onClick={() => handleCardSelect("wanderer")}
                className="group overflow-hidden rounded-3xl"
              >
                <div className="flex flex-col p-8 sm:p-10 min-h-[220px]">
                  <div>
                    <h3 className="font-bold text-white text-2xl mb-1">
                      The Wanderer
                    </h3>
                    <div className="text-lg text-white">
                      <MorphingText
                        texts={["Earn your time.", "Discover the path.", "Explore freely.", "Begin the journey."]}
                        morphTime={3}
                        cooldownTime={5}
                      />
                    </div>
                  </div>
                  <div className="flex-grow flex items-end justify-end mt-6">
                    <div className="text-3xl font-light text-white">Free</div>
                  </div>
                </div>
              </TiltCard>
            </GlassCard>
          </div>

          {/* --- SORCERER SMALL CARD --- */}
          <div
            ref={sorcererCardRef}
            className="relative w-full max-w-[400px]"
                      >
            <GlassCard opacity={cardOpacity}>
              <TiltCard
                isSelected={false}
                isOtherSelected={false}
                animationPhase={animationPhase}
                onClick={() => handleCardSelect("sorcerer")}
                className="group rounded-3xl"
              >
                <div className="flex flex-col p-8 sm:p-10 min-h-[220px]">
                  <div>
                    <h3 className="font-bold text-white text-2xl mb-1">
                      The Sorcerer
                    </h3>
                    <div className="text-lg text-white">
                      <MorphingText
                        texts={["Earn your power.", "Channel the source.", "Ascend beyond.", "Master the flow."]}
                        morphTime={3}
                        cooldownTime={5}
                      />
                    </div>
                  </div>
                  <div className="flex-grow flex items-end justify-end mt-6">
                    <div className="text-3xl font-light text-white">
                      ${pricing.monthly.usd}<span className="text-lg opacity-60">/mo</span>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </GlassCard>
          </div>
        </motion.div>
      )}

      {/* === EXPANDED WANDERER CARD (fixed, above backdrop) === */}
      {selectedPath === "wanderer" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: animationPhase === "fading-out" || isExiting ? 0 : 1 }}
          transition={{ duration: isExiting ? 0.6 : 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none"
        >
          <div
            className="relative w-full max-w-2xl pointer-events-auto"
                      >
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 sm:right-6 sm:top-6 z-[60] rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/60 backdrop-blur-md transition hover:bg-white/15 hover:text-white cursor-pointer"
            >
              Close
            </button>
            <GlassCard opacity={cardOpacity}>
              <div className="flex flex-col p-6 sm:p-10">
                <div>
                  <h3 className="font-bold text-white text-4xl mb-3">
                    The Wanderer
                  </h3>
                  <div className="text-lg text-white">
                    <MorphingText
                      texts={["Earn your time.", "Discover the path.", "Explore freely.", "Begin the journey."]}
                      morphTime={3}
                      cooldownTime={5}
                    />
                  </div>
                </div>

                <div className="mt-10 space-y-8">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
                    <p className="text-lg leading-relaxed text-white/70">
                      Walk the path of discovery. Complete quests to earn trial days and mana rewards. Upgrade to Sorcerer anytime.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-6 sm:gap-8">
                      <div>
                        <div className="text-xl sm:text-2xl font-bold text-white">7 days</div>
                        <div className="text-xs text-purple-200/50 mt-1">to start</div>
                      </div>
                      <div className="hidden sm:block h-10 w-px bg-purple-500/20" />
                      <div>
                        <div className="text-xl sm:text-2xl font-bold text-white">30 days</div>
                        <div className="text-xs text-purple-200/50 mt-1">max earned</div>
                      </div>
                      <div className="hidden sm:block h-10 w-px bg-purple-500/20" />
                      <div>
                        <div className="text-xl sm:text-2xl font-bold text-white">3</div>
                        <div className="text-xs text-purple-200/50 mt-1">ideas</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 py-2">
                    {[
                      "Up to 3 ideas, 5 features each",
                      "AI access via quest rewards",
                      "Earn days by completing quests",
                      "Upgrade to Sorcerer anytime"
                    ].map((item, i) => (
                      <div key={i} className="text-sm text-white/50 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-purple-400/60" />
                        {item}
                      </div>
                    ))}
                  </div>

                  <div className="pt-8">
                    <form
                      action={startGauntletAction}
                      onSubmit={() => setIsExiting(true)}
                    >
                      <button
                        type="submit"
                        className="neon-button neon-button-green relative block w-full rounded-xl py-5 px-8 text-base sm:text-lg font-bold tracking-widest uppercase overflow-hidden transition-all duration-500 cursor-pointer"
                      >
                        <span className="neon-line-top" />
                        <span className="neon-line-right" />
                        <span className="neon-line-bottom" />
                        <span className="neon-line-left" />
                        <span className="relative z-10">Begin The Journey</span>
                      </button>
                    </form>
                    <p className="text-center text-sm text-white/40 mt-4">
                      Your trial awaits. Earn your days.
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </motion.div>
      )}

      {/* === EXPANDED SORCERER CARD (fixed, above backdrop) === */}
      {selectedPath === "sorcerer" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: animationPhase === "fading-out" || isExiting ? 0 : 1 }}
          transition={{ duration: isExiting ? 0.6 : 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none"
        >
          <div
            className="relative w-full max-w-2xl pointer-events-auto"
                      >
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 sm:right-6 sm:top-6 z-[60] rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/60 backdrop-blur-md transition hover:bg-white/15 hover:text-white cursor-pointer"
            >
              Close
            </button>
            <GlassCard opacity={cardOpacity}>
              <div className="flex flex-col p-6 sm:p-10">
                <div>
                  <h3 className="font-bold text-white text-4xl mb-3">
                    The Sorcerer
                  </h3>
                  <div className="text-lg text-white">
                    <MorphingText
                      texts={["Earn your power.", "Channel the source.", "Ascend beyond.", "Master the flow."]}
                      morphTime={3}
                      cooldownTime={5}
                    />
                  </div>
                </div>

                <div className="mt-10 space-y-8">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
                    <p className="text-lg leading-relaxed text-white/70">
                      Channel the infinite source. Your subscription unlocks the full flow of mana, unlimited ideas, and powerful DevMode tools.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-6 sm:gap-8">
                      <div>
                        <div className="text-xl sm:text-2xl font-bold text-white">200k</div>
                        <div className="text-xs text-violet-200/50 mt-1">mana / month</div>
                      </div>
                      <div className="hidden sm:block h-10 w-px bg-violet-500/20" />
                      <div>
                        <div className="text-xl sm:text-2xl font-bold text-white">10 GB</div>
                        <div className="text-xs text-violet-200/50 mt-1">storage</div>
                      </div>
                      <div className="hidden sm:block h-10 w-px bg-violet-500/20" />
                      <div>
                        <div className="text-xl sm:text-2xl font-bold text-white">∞</div>
                        <div className="text-xs text-violet-200/50 mt-1">ideas</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <button
                      type="button"
                      onClick={() => setSelectedPricing("monthly")}
                      className={cn(
                        "relative rounded-xl p-4 sm:p-5 text-left transition-all duration-500 cursor-pointer",
                        selectedPricing === "monthly"
                          ? "bg-black/80"
                          : "bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07]"
                      )}
                      style={selectedPricing === "monthly" ? {
                        boxShadow: `
                          0 0 0 2px rgba(251, 191, 36, 0.9),
                          0 0 15px 0 rgba(251, 191, 36, 0.5),
                          0 0 30px 0 rgba(251, 191, 36, 0.3),
                          inset 0 0 20px rgba(251, 191, 36, 0.1)
                        `,
                      } : undefined}
                    >
                      <div className="text-xs uppercase tracking-wider text-white/40">Monthly</div>
                      <div className="mt-2 text-xl sm:text-2xl font-light text-white">${pricing.monthly.usd}/mo</div>
                      <div className="text-xs text-white/30 mt-1">Billed monthly</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPricing("annual")}
                      className={cn(
                        "relative rounded-xl p-4 sm:p-5 text-left transition-all duration-500 cursor-pointer",
                        selectedPricing === "annual"
                          ? "bg-black/80"
                          : "bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07]"
                      )}
                      style={selectedPricing === "annual" ? {
                        boxShadow: `
                          0 0 0 2px rgba(251, 191, 36, 0.9),
                          0 0 15px 0 rgba(251, 191, 36, 0.5),
                          0 0 30px 0 rgba(251, 191, 36, 0.3),
                          inset 0 0 20px rgba(251, 191, 36, 0.1)
                        `,
                      } : undefined}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-wider text-white/40">Annual</div>
                          <div className="mt-2 text-xl sm:text-2xl font-light text-white">
                            ${pricing.annual.monthlyEquivalent}
                            <span className="text-sm opacity-50">/mo</span>
                          </div>
                          <div className="text-xs text-white/30 mt-1">${pricing.annual.usd} billed annually</div>
                        </div>
                        <div className="rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2 py-0.5 text-[10px] font-bold uppercase text-black shrink-0">
                          Save ${pricing.annual.savings}
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 py-2">
                    {[
                      "Unlimited ideas & features",
                      "Full AI assistant access",
                      "DevMode terminal & runner",
                      "200k mana refreshed monthly"
                    ].map((item, i) => (
                      <div key={i} className="text-sm text-white/50 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-violet-400/60" />
                        {item}
                      </div>
                    ))}
                  </div>

                  <div className="pt-8">
                    <form
                      action={selectedPricing === "annual" ? selectSorcererAnnualAction : selectSorcererMonthlyAction}
                      onSubmit={() => setIsExiting(true)}
                    >
                      <button
                        type="submit"
                        className="neon-button relative block w-full rounded-xl py-5 px-8 text-base sm:text-lg font-bold tracking-widest uppercase overflow-hidden transition-all duration-500 cursor-pointer text-[#a78bfa] hover:text-[#0f0a1e]"
                      >
                        <span className="neon-line-top" style={{ background: 'linear-gradient(90deg, transparent, #a78bfa)', animation: 'neon-border-top 5s linear infinite' }} />
                        <span className="neon-line-right" style={{ background: 'linear-gradient(180deg, transparent, #a78bfa)', animation: 'neon-border-right 5s linear infinite', animationDelay: '1.25s' }} />
                        <span className="neon-line-bottom" style={{ background: 'linear-gradient(270deg, transparent, #a78bfa)', animation: 'neon-border-bottom 5s linear infinite', animationDelay: '2.5s' }} />
                        <span className="neon-line-left" style={{ background: 'linear-gradient(0deg, transparent, #a78bfa)', animation: 'neon-border-left 5s linear infinite', animationDelay: '3.75s' }} />
                        <span className="relative z-10">
                          {selectedPricing === "annual"
                            ? `Seal Your Destiny — $${pricing.annual.usd}/year`
                            : `Step Into Power — $${pricing.monthly.usd}/month`}
                        </span>
                      </button>
                    </form>
                    <p className="text-center text-sm text-white/40 mt-4">
                      {selectedPricing === "annual"
                        ? "Commit to ascension. Your power awaits."
                        : "Begin the path. Upgrade or cancel anytime."}
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </motion.div>
      )}

      {/* Footer text - Only visible when a selection is made */}{/* ESC hint removed */}<AnimatePresence>{selectedPath && (<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed bottom-8 z-50 text-xs text-white/30 hidden">Press ESC to cancel selection</motion.div>)}</AnimatePresence>
    </div>
  );
}
"use client";

import { useEffect, useMemo, useRef } from "react";

const GOLD_COLOR = "#FACC15";
const PULSE_PURPLE = "#7C3AED";
const LOCK_COLOR = "#5B21B6";
const BACKGROUND_COLOR = "#0B1220";

const ASSEMBLE_DURATION = 4800;
const LOCK_DURATION = 3600;
const DISPERSE_DURATION = 3200;
const TOTAL_DURATION = ASSEMBLE_DURATION + LOCK_DURATION + DISPERSE_DURATION;
export const LOGIN_ANIMATION_CYCLE_MS = TOTAL_DURATION;

const SWIRL_AMPLITUDE = 28;
const SCAN_DECAY_MS = 1200;

type GlyphPoint = {
  x: number;
  y: number;
};

type Particle = {
  target: GlyphPoint;
  start: GlyphPoint;
  phaseSeed: number;
  lastScanTime: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

const easeInOutCubic = (t: number) => {
  const clamped = clamp(t, 0, 1);
  return clamped < 0.5 ? 4 * clamped * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
};

const blendHex = (a: string, b: string, t: number) => {
  const from = parseInt(a.slice(1), 16);
  const to = parseInt(b.slice(1), 16);
  const r = Math.round(((from >> 16) & 0xff) + (((to >> 16) & 0xff) - ((from >> 16) & 0xff)) * t);
  const g = Math.round(((from >> 8) & 0xff) + (((to >> 8) & 0xff) - ((from >> 8) & 0xff)) * t);
  const blue = Math.round((from & 0xff) + ((to & 0xff) - (from & 0xff)) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + blue).toString(16).slice(1)}`;
};

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const randomStart = (width: number, height: number, index: number, cycleSeed: number): GlyphPoint => {
  const seed = index * 101 + cycleSeed * 9973;
  const reach = Math.max(width, height) * (0.7 + seededRandom(seed) * 0.6);
  const angle = seededRandom(seed + 1) * Math.PI * 2;
  return {
    x: width / 2 + Math.cos(angle) * reach,
    y: height / 2 + Math.sin(angle) * reach,
  };
};

const buildWordPoints = (word: string, width: number, height: number): GlyphPoint[] => {
  const canvasWidth = Math.max(1, Math.floor(width));
  const canvasHeight = Math.max(1, Math.floor(height));
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvasWidth;
  tempCanvas.height = canvasHeight;
  const ctx = tempCanvas.getContext("2d");
  if (!ctx) {
    return [];
  }

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  const fontSize = Math.floor(canvasHeight * 0.82);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${fontSize}px "Inter", "DM Sans", "Helvetica Neue", sans-serif`;
  ctx.fillText(word, canvasWidth / 2, canvasHeight / 2, canvasWidth * 0.95);

  const data = ctx.getImageData(0, 0, canvasWidth, canvasHeight).data;
  const step = Math.max(2, Math.floor(Math.min(canvasWidth, canvasHeight) / 90));
  const points: GlyphPoint[] = [];
  for (let y = 0; y < canvasHeight; y += step) {
    for (let x = 0; x < canvasWidth; x += step) {
      const idx = (y * canvasWidth + x) * 4;
      if (data[idx + 3] > 170) {
        points.push({ x, y });
      }
    }
  }
  return points;
};

export function LoginHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const metaRef = useRef<{ width: number; height: number; radius: number; gradient: CanvasGradient | null } | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastCycleProgressRef = useRef<number>(0);
  const cycleSeedRef = useRef(0);
  const canonicalGlyphRef = useRef<{ normalized: GlyphPoint[] } | null>(null);

  const gradientStops = useMemo(
    () => [
      { stop: 0, color: "rgba(124, 58, 237, 0.18)" },
      { stop: 0.42, color: "rgba(56, 189, 248, 0.16)" },
      { stop: 1, color: "rgba(11, 18, 32, 0)" },
    ],
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(dpr, dpr);

      const width = rect.width;
      const height = rect.height;
      const textAreaWidth = Math.max(160, width * 0.7);
      const textAreaHeight = Math.max(140, height * 0.42);
      const wordPoints = buildWordPoints("CODA", textAreaWidth, textAreaHeight);
      const offsetX = (width - textAreaWidth) / 2;
      const maxYOffset = Math.max(0, height - textAreaHeight);
      const desiredOffsetY = (height - textAreaHeight) / 2 + height * 0.12;
      const offsetY = clamp(desiredOffsetY, 0, maxYOffset);
      if (!canonicalGlyphRef.current || canonicalGlyphRef.current.normalized.length === 0) {
        canonicalGlyphRef.current = {
          normalized: wordPoints.map((point) => ({
            x: point.x / Math.max(textAreaWidth, 1),
            y: point.y / Math.max(textAreaHeight, 1),
          })),
        };
      }
      const normalizedPoints = canonicalGlyphRef.current?.normalized ?? [];
      const targetPoints =
        normalizedPoints.length > 0
          ? normalizedPoints.map((point) => ({
              x: offsetX + point.x * textAreaWidth,
              y: offsetY + point.y * textAreaHeight,
            }))
          : [];

      let gradient: CanvasGradient | null = null;
      try {
        gradient = context.createRadialGradient(width / 2, height / 2, width * 0.12, width / 2, height / 2, width * 0.78);
        gradientStops.forEach(({ stop, color }) => gradient?.addColorStop(stop, color));
      } catch {
        gradient = null;
      }

      const previousMeta = metaRef.current;
      const previousStart = startTimeRef.current;
      const now = performance.now();
      const previousElapsed = previousStart ? now - previousStart : 0;
      const previousProgress = previousElapsed % TOTAL_DURATION;

      metaRef.current = {
        width,
        height,
        radius: Math.max(1.8, Math.min(width, height) * 0.01),
        gradient,
      };

      const cycleSeed = cycleSeedRef.current;
      if (previousMeta && previousMeta.width > 0 && previousMeta.height > 0 && particlesRef.current.length === targetPoints.length) {
        const widthRatio = width / previousMeta.width;
        const heightRatio = height / previousMeta.height;
        const previousParticles = particlesRef.current;
        particlesRef.current = previousParticles.map((particle, index) => ({
          target: targetPoints[index],
          start: {
            x: particle.start.x * widthRatio,
            y: particle.start.y * heightRatio,
          },
          phaseSeed: particle.phaseSeed,
          lastScanTime: particle.lastScanTime,
        }));
      } else if (targetPoints.length > 0) {
        particlesRef.current = targetPoints.map((point, index) => ({
          target: point,
          start: randomStart(width, height, index, cycleSeed),
          phaseSeed: seededRandom(index + 2 + cycleSeed * 0.1) * Math.PI * 2,
          lastScanTime: -Infinity,
        }));
      } else {
        particlesRef.current = [];
      }

      startTimeRef.current = previousStart ? previousStart : now;
      lastCycleProgressRef.current = previousProgress;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const draw = () => {
      const meta = metaRef.current;
      const particles = particlesRef.current;
      if (!meta || particles.length === 0) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const { width, height, radius, gradient } = meta;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const now = performance.now();
      const elapsed = now - startTimeRef.current;
      const cycleProgress = elapsed % TOTAL_DURATION;

      if (cycleProgress < lastCycleProgressRef.current) {
        const nextCycleSeed = cycleSeedRef.current + 1;
        cycleSeedRef.current = nextCycleSeed;
        particles.forEach((particle, index) => {
          particle.start = randomStart(width, height, index, nextCycleSeed);
          particle.phaseSeed = seededRandom(nextCycleSeed * 1000 + index * 13.37) * Math.PI * 2;
          particle.lastScanTime = -Infinity;
        });
      }
      lastCycleProgressRef.current = cycleProgress;

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = BACKGROUND_COLOR;
      ctx.fillRect(0, 0, width, height);
      if (gradient) {
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      let phase: "assemble" | "lock" | "disperse" = "disperse";
      let phaseElapsed = cycleProgress;
      if (cycleProgress < ASSEMBLE_DURATION) {
        phase = "assemble";
      } else if (cycleProgress < ASSEMBLE_DURATION + LOCK_DURATION) {
        phase = "lock";
        phaseElapsed -= ASSEMBLE_DURATION;
      } else {
        phase = "disperse";
        phaseElapsed -= ASSEMBLE_DURATION + LOCK_DURATION;
      }

      const scanSpan = height * 1.1;
      const scanSpeed = 1400;
      const lockProgress = cycleProgress - ASSEMBLE_DURATION;
      const scanProgress = lockProgress > 0 ? (lockProgress / scanSpeed) % 2 : 0;
      const scanPosition =
        scanSpan * (scanProgress <= 1 ? scanProgress : 2 - scanProgress) - height * 0.05;

      ctx.lineWidth = 1;
      particles.forEach((particle, index) => {
        let x = particle.target.x;
        let y = particle.target.y;
        let color = LOCK_COLOR;
        let size = radius;

        if (phase === "assemble") {
          const progress = easeInOutCubic(phaseElapsed / ASSEMBLE_DURATION);
          const swirlStrength = Math.pow(1 - progress, 0.85) * SWIRL_AMPLITUDE;
          const baseX = lerp(particle.start.x, particle.target.x, progress);
          const baseY = lerp(particle.start.y, particle.target.y, progress);
          const wobble = progress < 0.94 ? swirlStrength : swirlStrength * 0.35;
          x = baseX + Math.cos(now / 420 + particle.phaseSeed + index * 0.05) * wobble;
          y = baseY + Math.sin(now / 440 + particle.phaseSeed + index * 0.07) * wobble * 0.75;
          const pulse = (Math.sin(now / 260 + index * 0.42) + 1) / 2;
          color = blendHex(GOLD_COLOR, PULSE_PURPLE, pulse);
          size = radius * (1 + pulse * 0.4);
        } else if (phase === "lock") {
          const distanceToScan = Math.abs(particle.target.y - scanPosition);
          if (distanceToScan < radius * 5) {
            particle.lastScanTime = now;
          }
          const timeSinceScan = now - particle.lastScanTime;
          const highlight = Math.max(0, 1 - timeSinceScan / SCAN_DECAY_MS);
          const jitter = highlight > 0 ? Math.sin(now / 150 + particle.phaseSeed) * radius * 0.6 * highlight : 0;
          x = particle.target.x + Math.cos(now / 320 + particle.phaseSeed) * jitter;
          y = particle.target.y + Math.sin(now / 300 + particle.phaseSeed) * jitter;
          color = highlight > 0 ? blendHex(GOLD_COLOR, PULSE_PURPLE, highlight) : LOCK_COLOR;
          size = radius * (1 + highlight * 0.6);
        } else {
          const progress = easeInOutCubic(phaseElapsed / DISPERSE_DURATION);
          const swirlStrength = Math.pow(progress, 0.7) * SWIRL_AMPLITUDE * 0.8;
          const baseX = lerp(particle.target.x, particle.start.x, progress);
          const baseY = lerp(particle.target.y, particle.start.y, progress);
          x = baseX + Math.sin(now / 360 + particle.phaseSeed + index * 0.03) * swirlStrength;
          y = baseY + Math.cos(now / 380 + particle.phaseSeed + index * 0.04) * swirlStrength * 0.7;
          color = GOLD_COLOR;
          size = radius * (1 + Math.sin(now / 280 + index * 0.2) * 0.2);
        }

        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.92;
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(59, 1, 11, 0.12)";
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.38, 0, Math.PI * 2);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [gradientStops]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full bg-[#0b1220]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.22),transparent_55%),radial-gradient(circle_at_80%_20%,rgba(56,189,248,0.16),transparent_58%),radial-gradient(circle_at_50%_80%,rgba(251,191,36,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-slate-950/40" />
    </div>
  );
}

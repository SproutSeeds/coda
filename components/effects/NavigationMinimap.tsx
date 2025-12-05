"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface NavigationMinimapProps {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
  velocity: { x: number; y: number; z: number };
  axisLabels: string[];  // ['FWD', 'LEFT', 'UP'] etc.
  speedMultiplier: number;
  targetSpeed?: number;  // Target speed from +/- keys
  speedCeiling?: number;  // Max allowed speed (1.0 = no ceiling)
  isVisible: boolean;
  isCruising: boolean;
  isLocked?: boolean;  // Cruise lock status
}

/**
 * Neon Torus Speedometer - nested rings that light up with speed
 */
function NeonSpeedometer({
  speed,
  speedCeiling = 1,
  size = 80
}: {
  speed: number;
  speedCeiling?: number;
  size?: number;
}) {
  const rings = 5;
  const ringWidth = 4;
  const gap = 2;
  const baseRadius = 8;
  const litRings = Math.ceil(speed * rings);
  const pulseSpeed = speed > 0.5 ? 0.5 + (speed - 0.5) : 0;

  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      {/* Neon glow filters */}
      <defs>
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0  0.3 0.6 1 0 0  0.8 0.9 1 0 0  0 0 0 1 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="neonGlowIntense" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0  0.4 0.7 1 0 0  0.9 1 1 0 0  0 0 0 1.5 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Nested rings */}
      {Array.from({ length: rings }, (_, i) => {
        const radius = baseRadius + i * (ringWidth + gap);
        const isLit = i < litRings;
        return (
          <motion.circle
            key={i}
            cx={40}
            cy={40}
            r={radius}
            fill="none"
            strokeWidth={ringWidth}
            stroke={
              isLit
                ? `rgba(${50 + i * 30}, ${150 + i * 20}, 255, ${0.6 + speed * 0.4})`
                : "rgba(50, 70, 100, 0.2)"
            }
            filter={isLit ? (speed > 0.7 ? "url(#neonGlowIntense)" : "url(#neonGlow)") : undefined}
            initial={false}
            animate={{
              opacity: isLit && pulseSpeed > 0 ? [1, 0.7, 1] : isLit ? 1 : 0.3,
            }}
            transition={{
              opacity: {
                duration: pulseSpeed > 0 ? 1 / (1 + pulseSpeed) : 0,
                repeat: pulseSpeed > 0 ? Infinity : 0,
              },
            }}
          />
        );
      })}

      {/* Ceiling indicator (red dashed ring) */}
      {speedCeiling < 1 && (
        <circle
          cx={40}
          cy={40}
          r={baseRadius + (Math.ceil(speedCeiling * rings) - 1) * (ringWidth + gap)}
          fill="none"
          strokeWidth={1}
          stroke="rgba(255, 100, 100, 0.8)"
          strokeDasharray="3 2"
        />
      )}
    </svg>
  );
}

export function NavigationMinimap({
  position,
  quaternion,
  velocity,
  axisLabels,
  speedMultiplier,
  targetSpeed = 0,
  speedCeiling = 1,
  isVisible,
  isCruising,
  isLocked = false,
}: NavigationMinimapProps) {
  // Calculate distance from origin
  const distance = useMemo(() => {
    return Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
  }, [position.x, position.y, position.z]);

  // Calculate heading angle from quaternion (yaw in XZ plane)
  const headingAngle = useMemo(() => {
    // Extract yaw from quaternion (rotation around Y axis)
    const { x, y, z, w } = quaternion;
    // This gives us the forward direction projected onto XZ plane
    const siny_cosp = 2 * (w * y + z * x);
    const cosy_cosp = 1 - 2 * (x * x + y * y);
    return Math.atan2(siny_cosp, cosy_cosp);
  }, [quaternion]);

  // Dynamic scale based on distance
  const scale = useMemo(() => {
    return Math.min(10000, Math.max(100, distance * 1.5));
  }, [distance]);

  // Map position to minimap coordinates (200x200 SVG)
  const minimapSize = 200;
  const center = minimapSize / 2;

  // Player position on minimap (XZ plane, Y is up in 3D)
  const playerX = center + (position.x / scale) * (minimapSize / 2 - 20);
  const playerZ = center - (position.z / scale) * (minimapSize / 2 - 20); // Flip Z for screen coords

  // Calculate velocity arrow from velocity vector (XZ plane projection)
  const velLineLength = 20 * Math.min(speedMultiplier, 2);  // Scale with speed, cap at 2x
  const velEndX = playerX + velocity.x * velLineLength;
  const velEndZ = playerZ - velocity.z * velLineLength;  // Flip Z for screen coords
  const showVelocityArrow = isCruising && (velocity.x !== 0 || velocity.z !== 0);

  // Format axis labels for display
  const directionText = axisLabels.length > 0 ? axisLabels.join('+') : '---';

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="minimap"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-4 left-4 z-50 pointer-events-none"
      >
        <div
          className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-3"
          style={{
            boxShadow: isCruising
              ? "0 0 30px rgba(0, 255, 255, 0.2), inset 0 0 20px rgba(0, 255, 255, 0.05)"
              : "0 0 20px rgba(0, 0, 0, 0.5)",
          }}
        >
            {/* SVG Minimap Canvas */}
            <svg
              width={minimapSize}
              height={minimapSize}
              className="rounded-lg"
              style={{ background: "rgba(0, 0, 0, 0.3)" }}
            >
              {/* Grid lines */}
              <defs>
                <pattern
                  id="grid"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="0.5"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Origin marker (center cross) */}
              <g>
                <line
                  x1={center - 8}
                  y1={center}
                  x2={center + 8}
                  y2={center}
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth="1"
                />
                <line
                  x1={center}
                  y1={center - 8}
                  x2={center}
                  y2={center + 8}
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth="1"
                />
                <circle
                  cx={center}
                  cy={center}
                  r="3"
                  fill="rgba(255, 255, 255, 0.2)"
                  stroke="rgba(255, 255, 255, 0.4)"
                  strokeWidth="1"
                />
              </g>

              {/* Distance rings */}
              {[0.25, 0.5, 0.75].map((r) => (
                <circle
                  key={r}
                  cx={center}
                  cy={center}
                  r={(minimapSize / 2 - 20) * r}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
              ))}

              {/* Line from origin to player */}
              <line
                x1={center}
                y1={center}
                x2={playerX}
                y2={playerZ}
                stroke="rgba(100, 200, 255, 0.3)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Velocity vector line - shows cruise direction */}
              {showVelocityArrow && (
                <line
                  x1={playerX}
                  y1={playerZ}
                  x2={velEndX}
                  y2={velEndZ}
                  stroke="rgba(0, 255, 200, 0.8)"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
              )}

              {/* Arrow marker for velocity */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 6 3, 0 6"
                    fill="rgba(0, 255, 200, 0.8)"
                  />
                </marker>
              </defs>

              {/* Player dot with heading indicator */}
              <g transform={`translate(${playerX}, ${playerZ})`}>
                {/* Outer glow when cruising */}
                {isCruising && (
                  <circle
                    cx="0"
                    cy="0"
                    r="8"
                    fill="none"
                    stroke="rgba(0, 255, 255, 0.3)"
                    strokeWidth="2"
                  >
                    <animate
                      attributeName="r"
                      values="6;10;6"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.5;0.2;0.5"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Player dot */}
                <circle
                  cx="0"
                  cy="0"
                  r="4"
                  fill={isCruising ? "#00ffff" : "#ffffff"}
                  stroke="rgba(255, 255, 255, 0.5)"
                  strokeWidth="1"
                />

                {/* Heading triangle (points in camera look direction) */}
                <polygon
                  points="0,-10 -4,-2 4,-2"
                  fill={isCruising ? "#00ffff" : "rgba(255, 255, 255, 0.8)"}
                  transform={`rotate(${(headingAngle * 180) / Math.PI + 180})`}
                />
              </g>

              {/* Scale indicator */}
              <text
                x="10"
                y={minimapSize - 8}
                fill="rgba(255, 255, 255, 0.4)"
                fontSize="9"
                fontFamily="monospace"
              >
                {scale >= 1000 ? `${(scale / 1000).toFixed(1)}km` : `${Math.round(scale)}m`}
              </text>
            </svg>

            {/* Stats panel */}
            <div className="mt-2 space-y-1 font-mono text-[10px]">
              {/* Distance */}
              <div className="flex justify-between text-white/60">
                <span>DIST</span>
                <span className="text-white/90">
                  {distance >= 1000
                    ? `${(distance / 1000).toFixed(2)}km`
                    : `${Math.round(distance)}m`}
                </span>
              </div>

              {/* Neon Torus Speedometer */}
              <div className="flex flex-col items-center">
                <NeonSpeedometer speed={speedMultiplier} speedCeiling={speedCeiling} />
                <div className="flex justify-between w-full text-white/60 mt-1">
                  <span>SPEED</span>
                  <span className={isCruising ? "text-cyan-400" : "text-white/90"}>
                    {Math.round(speedMultiplier * 100)}%
                    {isLocked && " [LOCK]"}
                  </span>
                </div>
                {/* Ceiling indicator */}
                {speedCeiling < 1 && (
                  <div className="text-[9px] text-orange-400/70 text-center mt-0.5">
                    CEILING: {Math.round(speedCeiling * 100)}%
                  </div>
                )}
              </div>

              {/* Direction (when moving) */}
              {isCruising && (
                <div className="flex justify-between text-cyan-400/80">
                  <span>{isLocked ? "LOCKED" : "DIR"}</span>
                  <span className="text-cyan-300">
                    {directionText}
                  </span>
                </div>
              )}

              {/* Coordinates */}
              <div className="flex justify-between text-white/40">
                <span>X</span>
                <span>{Math.round(position.x)}</span>
              </div>
              <div className="flex justify-between text-white/40">
                <span>Y</span>
                <span>{Math.round(position.y)}</span>
              </div>
              <div className="flex justify-between text-white/40">
                <span>Z</span>
                <span>{Math.round(position.z)}</span>
              </div>
            </div>

          {/* Hint */}
          <div className="mt-2 text-[8px] text-white/30 text-center">
            Press M to toggle
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

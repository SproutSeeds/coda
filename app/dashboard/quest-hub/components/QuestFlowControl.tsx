"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { type ParticleShape, is3DShape } from "@/components/effects/TubesEffect";

interface QuestFlowControlProps {
  tubeSpeed: number;
  onTubeSpeedChange: (speed: number) => void;
  particleSpeed: number;
  onParticleSpeedChange: (speed: number) => void;
  tubesOpacity: number;
  onTubesOpacityChange: (opacity: number) => void;
  particlesOpacity: number;
  onParticlesOpacityChange: (opacity: number) => void;
  panelOpacity: number;
  onPanelOpacityChange: (opacity: number) => void;
  colorIntensity: number;
  onColorIntensityChange: (intensity: number) => void;
  mouseFollow: boolean;
  onMouseFollowChange: (enabled: boolean) => void;
  onPulse: () => void;
  isPulsing: boolean;
  enableCollision: boolean;
  onCollisionChange: (enabled: boolean) => void;
  collisionRadius: number;
  onCollisionRadiusChange: (radius: number) => void;
  collisionStrength: number;
  onCollisionStrengthChange: (strength: number) => void;
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
  tubeColors: string[];
  onTubeColorsChange: (colors: string[]) => void;
  idleTimeout: number;
  onIdleTimeoutChange: (timeout: number) => void;
  tubeRadius: number;
  onTubeRadiusChange: (radius: number) => void;
  particleCount: number;
  onParticleCountChange: (count: number) => void;
  isZenMode?: boolean;
  onZenModeChange?: (enabled: boolean) => void;
  pulseOnClick?: boolean;
  onPulseOnClickChange?: (enabled: boolean) => void;
  fogIntensity: number;
  onFogIntensityChange: (intensity: number) => void;
  particleShape?: ParticleShape;
  onParticleShapeChange?: (shape: ParticleShape) => void;
  particleRotation?: number;
  onParticleRotationChange?: (rotation: number) => void;
  /** Current mode: "flow" (pure animation) or "focus" (content visible) */
  currentMode?: "flow" | "focus";
  /** Enable WASD spaceship camera controls */
  enableFlightControls?: boolean;
  onFlightControlsChange?: (enabled: boolean) => void;
  /** Flight movement speed */
  flightSpeed?: number;
  onFlightSpeedChange?: (speed: number) => void;
  /** Mouse look sensitivity */
  lookSensitivity?: number;
  onLookSensitivityChange?: (sensitivity: number) => void;
  /** Auto-forward cruise control */
  autoForward?: boolean;
  onAutoForwardChange?: (enabled: boolean) => void;
  /** Open snapshot manager modal */
  onOpenSnapshots?: () => void;
  /** Fragment push strength multiplier */
  fragmentPushMultiplier?: number;
  onFragmentPushMultiplierChange?: (v: number) => void;
  /** Particle friction/damping */
  particleFriction?: number;
  onParticleFrictionChange?: (v: number) => void;
  /** Fragment blast radius multiplier */
  fragmentRadiusMultiplier?: number;
  onFragmentRadiusMultiplierChange?: (v: number) => void;
}

// Color theme presets
const COLOR_THEMES = [
  {
    id: "sorcerer",
    name: "Sorcerer",
    colors: ["#a855f7", "#f59e0b", "#f472b6", "#8b5cf6"],
  },
  {
    id: "wanderer",
    name: "Wanderer",
    colors: ["#4ade80", "#22d3ee", "#a78bfa", "#34d399"],
  },
  {
    id: "ember",
    name: "Ember",
    colors: ["#ef4444", "#f97316", "#eab308", "#dc2626"],
  },
  {
    id: "ocean",
    name: "Ocean",
    colors: ["#0ea5e9", "#06b6d4", "#3b82f6", "#8b5cf6"],
  },
  {
    id: "aurora",
    name: "Aurora",
    colors: ["#10b981", "#14b8a6", "#06b6d4", "#8b5cf6"],
  },
] as const;

// Floating Orb - minimalist point of light button
function FloatingOrb({ isActive }: { isActive?: boolean }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Hover indicator ring */}
      <div
        className="absolute rounded-full transition-all duration-500 ease-in-out opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100"
        style={{
          width: "56px",
          height: "56px",
          background:
            "radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 40%, transparent 70%)",
        }}
      />

      {/* Orb container - all layers scale together on hover */}
      <div className="relative flex items-center justify-center transition-transform duration-500 ease-in-out group-hover:scale-[2.5]">
        {/* Outer atmospheric glow - breathes gently */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          animate={{
            scale: [1, 1.3, 1],
            opacity: isActive ? [0.4, 0.6, 0.4] : [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            width: "24px",
            height: "24px",
            background: isActive
              ? "radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.15) 40%, transparent 70%)"
              : "radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.08) 40%, transparent 70%)",
          }}
        />

        {/* Inner glow halo */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          animate={{
            scale: isActive ? [1, 1.15, 1] : [1, 1.08, 1],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          }}
          style={{
            width: "12px",
            height: "12px",
            background: isActive
              ? "radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%)",
          }}
        />

        {/* The orb core - tiny point of light with gentle float */}
        <motion.div
          className="rounded-full"
          animate={{
            y: [-1.5, 1.5, -1.5],
            x: [-0.5, 0.5, -0.5],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            width: isActive ? "4px" : "3px",
            height: isActive ? "4px" : "3px",
            backgroundColor: isActive
              ? "rgba(255, 255, 255, 0.9)"
              : "rgba(255, 255, 255, 0.6)",
            boxShadow: isActive
              ? "0 0 2px 1px rgba(255, 255, 255, 0.8), 0 0 4px 2px rgba(255, 255, 255, 0.5), 0 0 8px 3px rgba(255, 255, 255, 0.3)"
              : "0 0 2px 1px rgba(255, 255, 255, 0.4), 0 0 4px 2px rgba(255, 255, 255, 0.15)",
            transition:
              "width 0.5s ease, height 0.5s ease, background-color 0.5s ease, box-shadow 0.5s ease",
          }}
        />
      </div>
    </div>
  );
}

export function QuestFlowControl({
  tubeSpeed,
  onTubeSpeedChange,
  particleSpeed,
  onParticleSpeedChange,
  tubesOpacity,
  onTubesOpacityChange,
  particlesOpacity,
  onParticlesOpacityChange,
  panelOpacity,
  onPanelOpacityChange,
  colorIntensity,
  onColorIntensityChange,
  mouseFollow,
  onMouseFollowChange,
  onPulse,
  isPulsing,
  enableCollision,
  onCollisionChange,
  collisionRadius,
  onCollisionRadiusChange,
  collisionStrength,
  onCollisionStrengthChange,
  backgroundColor,
  onBackgroundColorChange,
  tubeColors,
  onTubeColorsChange,
  idleTimeout,
  onIdleTimeoutChange,
  tubeRadius,
  onTubeRadiusChange,
  particleCount,
  onParticleCountChange,
  isZenMode = false,
  onZenModeChange,
  pulseOnClick = false,
  onPulseOnClickChange,
  fogIntensity,
  onFogIntensityChange,
  particleShape = 'square',
  onParticleShapeChange,
  particleRotation = 50,
  onParticleRotationChange,
  currentMode,
  enableFlightControls = false,
  onFlightControlsChange,
  flightSpeed = 0.5,
  onFlightSpeedChange,
  lookSensitivity = 0.003,
  onLookSensitivityChange,
  autoForward = false,
  onAutoForwardChange,
  onOpenSnapshots,
  fragmentPushMultiplier = 5,
  onFragmentPushMultiplierChange,
  particleFriction = 15,
  onParticleFrictionChange,
  fragmentRadiusMultiplier = 1,
  onFragmentRadiusMultiplierChange,
}: QuestFlowControlProps) {
  // Find currently active theme based on colors
  const activeTheme = COLOR_THEMES.find(
    (theme) => JSON.stringify(theme.colors) === JSON.stringify(tubeColors)
  );
  const [isOpen, setIsOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  // Local state for particle count input (allows typing before committing)
  const [particleCountInput, setParticleCountInput] = useState(particleCount.toString());

  // Sync input when prop changes externally
  useEffect(() => {
    setParticleCountInput(particleCount.toString());
  }, [particleCount]);

  // Handle particle count input change
  const handleParticleCountInputChange = (value: string) => {
    setParticleCountInput(value);
  };

  // Commit particle count on blur or enter
  const commitParticleCount = () => {
    const parsed = parseInt(particleCountInput, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(0, Math.min(100000, parsed));
      onParticleCountChange(clamped);
      setParticleCountInput(clamped.toString());
    } else {
      setParticleCountInput(particleCount.toString());
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        controlRef.current &&
        !controlRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Keyboard detection: hold SHIFT and type "ZEN" for zen mode
  const [shiftBuffer, setShiftBuffer] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC exits zen mode
      if (e.key === "Escape" && isZenMode) {
        onZenModeChange?.(false);
        return;
      }

      // Only track when shift is held
      if (!e.shiftKey) {
        setShiftBuffer("");
        return;
      }

      // Ignore modifier keys themselves
      if (e.key === "Shift") return;

      const key = e.key.toUpperCase();

      // Only accept letters used in ZEN
      if (!["Z", "E", "N"].includes(key)) {
        setShiftBuffer("");
        return;
      }

      const newBuffer = shiftBuffer + key;

      if (newBuffer === "ZEN") {
        // Enter zen mode
        onZenModeChange?.(true);
        setShiftBuffer("");
        setIsOpen(false); // Close panel when entering zen mode
      } else if ("ZEN".startsWith(newBuffer)) {
        // Valid partial sequence
        setShiftBuffer(newBuffer);
      } else {
        // Invalid sequence, reset
        setShiftBuffer("");
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Reset buffer when shift is released
      if (e.key === "Shift") {
        setShiftBuffer("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [shiftBuffer, isZenMode, onZenModeChange]);

  // Note: We no longer close panel when entering zen mode
  // Users should be able to adjust settings while in zen mode

  return (
    <div
      ref={controlRef}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2"
    >
      {/* Slider panel - slides in/out, available in zen mode for settings adjustments */}
      <motion.div
        initial={false}
        animate={{
          width: isOpen ? "auto" : 0,
          opacity: isOpen ? 1 : 0,
          paddingLeft: isOpen ? 16 : 0,
          paddingRight: isOpen ? 12 : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="overflow-hidden flex items-center gap-4 rounded-l-xl border border-r-0 border-white/10 bg-black/60 py-3 backdrop-blur-md"
      >
        {/* Mode indicator - shows which mode settings you're editing */}
        {currentMode && (
          <div className="flex flex-col gap-1 items-center">
            <span className={`text-[10px] uppercase tracking-wider font-medium ${
              currentMode === "focus" ? "text-amber-400" : "text-cyan-400"
            }`}>
              {currentMode === "focus" ? "Focus" : "Flow"}
            </span>
            <div className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider ${
              currentMode === "focus"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
            }`}>
              Mode
            </div>
          </div>
        )}

        {currentMode && <div className="w-px h-8 bg-white/10" />}

        {/* Tube Spin speed slider */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Spin
          </span>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={tubeSpeed}
            onChange={(e) => onTubeSpeedChange(parseFloat(e.target.value))}
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              width: '64px',
              height: '4px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '9999px',
              cursor: 'pointer',
            }}
            className="slider-thumb-cyan"
            title={`Tube rotation: ${tubeSpeed.toFixed(1)}`}
          />
        </div>

        {/* Particle Drift speed slider */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Drift
          </span>
          <input
            type="range"
            min="0"
            max="2.5"
            step="0.05"
            value={particleSpeed}
            onChange={(e) => onParticleSpeedChange(parseFloat(e.target.value))}
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              width: '64px',
              height: '4px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '9999px',
              cursor: 'pointer',
            }}
            className="slider-thumb-amber"
            title={`Particle speed: ${particleSpeed.toFixed(1)}`}
          />
        </div>

        {/* Tubes opacity slider */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Tubes
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={tubesOpacity}
            onChange={(e) => onTubesOpacityChange(parseFloat(e.target.value))}
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              width: '64px',
              height: '4px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '9999px',
              cursor: 'pointer',
            }}
            className="slider-thumb-green"
          />
        </div>

        {/* Particles opacity slider */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Sparks
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={particlesOpacity}
            onChange={(e) => onParticlesOpacityChange(parseFloat(e.target.value))}
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              width: '64px',
              height: '4px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '9999px',
              cursor: 'pointer',
            }}
            className="slider-thumb-yellow"
          />
        </div>

        {/* Particle count slider with editable input */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Count
          </span>
          <div className="flex items-center gap-1">
            <input
              type="range"
              min="0"
              max="100000"
              step="1000"
              value={particleCount}
              onChange={(e) => onParticleCountChange(parseInt(e.target.value, 10))}
              style={{
                WebkitAppearance: 'none',
                appearance: 'none',
                width: '48px',
                height: '4px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '9999px',
                cursor: 'pointer',
              }}
              className="slider-thumb-orange"
            />
            <input
              type="text"
              value={particleCountInput}
              onChange={(e) => handleParticleCountInputChange(e.target.value)}
              onBlur={commitParticleCount}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitParticleCount();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-12 px-1 py-0.5 text-[9px] text-white/70 bg-white/5 border border-white/10 rounded text-right font-mono focus:outline-none focus:border-white/30"
              title="Click to edit particle count (0-100k)"
            />
          </div>
        </div>

        {/* Tube size slider */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Size
          </span>
          <input
            type="range"
            min="0.05"
            max="0.5"
            step="0.01"
            value={tubeRadius}
            onChange={(e) => onTubeRadiusChange(parseFloat(e.target.value))}
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              width: '64px',
              height: '4px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '9999px',
              cursor: 'pointer',
            }}
            className="slider-thumb-rose"
            title={`Tube thickness: ${tubeRadius.toFixed(2)}`}
          />
        </div>

        {/* Panel opacity slider */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Panels
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={panelOpacity}
            onChange={(e) => onPanelOpacityChange(parseFloat(e.target.value))}
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              width: '64px',
              height: '4px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '9999px',
              cursor: 'pointer',
            }}
            className="slider-thumb-amber"
          />
        </div>

        {/* Color intensity slider */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Color
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={colorIntensity}
            onChange={(e) => onColorIntensityChange(parseFloat(e.target.value))}
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              width: '64px',
              height: '4px',
              background: 'linear-gradient(to right, #6b7280, #a855f7)',
              borderRadius: '9999px',
              cursor: 'pointer',
            }}
            className="slider-thumb-purple"
          />
        </div>

        {/* Background color picker */}
        <div className="flex flex-col gap-1 items-center">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            BG
          </span>
          <div className="relative">
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => onBackgroundColorChange(e.target.value)}
              className="w-8 h-6 cursor-pointer rounded border border-white/20 bg-transparent"
              style={{
                WebkitAppearance: 'none',
                appearance: 'none',
                padding: 0,
              }}
              title="Background color"
            />
            <div
              className="absolute inset-0 rounded pointer-events-none border border-white/10"
              style={{ backgroundColor }}
            />
          </div>
        </div>

        {/* Fog intensity slider */}
        <div className="flex flex-col gap-1">
          <span className={`text-[10px] uppercase tracking-wider transition-colors ${
            fogIntensity > 0 ? 'text-slate-300' : 'text-white/40'
          }`}>
            Fog
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={fogIntensity}
            onChange={(e) => onFogIntensityChange(parseFloat(e.target.value))}
            style={{
              WebkitAppearance: 'none',
              appearance: 'none',
              width: '64px',
              height: '4px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '9999px',
              cursor: 'pointer',
            }}
            className="slider-thumb-slate"
            title={`Fog overlay: ${fogIntensity}%`}
          />
        </div>

        {/* Particle Shape dropdown */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Shape
          </span>
          <select
            value={particleShape}
            onChange={(e) => onParticleShapeChange?.(e.target.value as ParticleShape)}
            className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white/80 cursor-pointer focus:outline-none focus:border-white/30"
            style={{ width: '85px' }}
            title="Particle shape"
          >
            <optgroup label="2D Shapes">
              <option value="square">Square</option>
              <option value="circle">Circle</option>
              <option value="glow">Glow</option>
              <option value="star">Star</option>
              <option value="smoke">Smoke</option>
              <option value="diamond">Diamond</option>
              <option value="hexagon">Hexagon</option>
              <option value="heart">Heart</option>
              <option value="lightning">Lightning</option>
            </optgroup>
            <optgroup label="3D Shapes">
              <option value="sphere">Sphere</option>
              <option value="cube">Cube</option>
              <option value="octahedron">Octahedron</option>
              <option value="tetrahedron">Tetrahedron</option>
            </optgroup>
          </select>
        </div>

        {/* 3D Rotation slider - only show for 3D shapes */}
        {is3DShape(particleShape) && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Spin
            </span>
            <div className="flex items-center gap-1">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={particleRotation}
                onChange={(e) => onParticleRotationChange?.(parseFloat(e.target.value))}
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  width: '48px',
                  height: '4px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                }}
                className="slider-thumb-blue"
                title={`3D rotation speed: ${particleRotation}%`}
              />
              <span className="text-[9px] text-white/50 w-6 text-right">
                {particleRotation}%
              </span>
            </div>
          </div>
        )}

        {/* Idle timeout slider */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Idle
          </span>
          <div className="flex items-center gap-1">
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={idleTimeout}
              onChange={(e) => onIdleTimeoutChange(parseFloat(e.target.value))}
              style={{
                WebkitAppearance: 'none',
                appearance: 'none',
                width: '48px',
                height: '4px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '9999px',
                cursor: 'pointer',
              }}
              className="slider-thumb-blue"
              title={idleTimeout === 0 ? "Never idle" : `${idleTimeout}s until idle`}
            />
            <span className="text-[9px] text-white/50 w-4 text-right">
              {idleTimeout === 0 ? "∞" : `${idleTimeout}s`}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10" />

        {/* Theme presets */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Theme
          </span>
          <div className="flex gap-1.5">
            {COLOR_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => onTubeColorsChange([...theme.colors])}
                className={`
                  relative w-6 h-6 rounded-md transition-all duration-200 overflow-hidden
                  ${activeTheme?.id === theme.id
                    ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-black/50 scale-110'
                    : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }
                `}
                title={theme.name}
              >
                {/* 4-color grid showing theme colors */}
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                  <div style={{ backgroundColor: theme.colors[0] }} />
                  <div style={{ backgroundColor: theme.colors[1] }} />
                  <div style={{ backgroundColor: theme.colors[2] }} />
                  <div style={{ backgroundColor: theme.colors[3] }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10" />

        {/* Mouse follow toggle - "Tether" for fantastical naming */}
        <div className="flex flex-col gap-1 items-center">
          <span className={`text-[10px] uppercase tracking-wider transition-all duration-300 ${
            mouseFollow ? 'text-cyan-400' : 'text-white/40'
          }`}>
            Tether
          </span>
          <button
            onClick={() => onMouseFollowChange(!mouseFollow)}
            className={`
              w-8 h-4 rounded-full transition-all duration-300 relative
              ${mouseFollow
                ? 'bg-cyan-500/40 border border-cyan-500/60'
                : 'bg-white/10 border border-white/20'
              }
            `}
            title={mouseFollow ? "Strands tethered to cursor" : "Strands drift freely"}
          >
            <div
              className={`
                absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300
                ${mouseFollow
                  ? 'left-4 bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]'
                  : 'left-0.5 bg-white/40'
                }
              `}
            />
          </button>
        </div>

        {/* Collision toggle */}
        <div className="flex flex-col gap-1 items-center">
          <span className={`text-[10px] uppercase tracking-wider transition-all duration-300 ${
            enableCollision ? 'text-orange-400' : 'text-white/40'
          }`}>
            Collide
          </span>
          <button
            onClick={() => onCollisionChange(!enableCollision)}
            className={`
              w-8 h-4 rounded-full transition-all duration-300 relative
              ${enableCollision
                ? 'bg-orange-500/40 border border-orange-500/60'
                : 'bg-white/10 border border-white/20'
              }
            `}
            title={enableCollision ? "Disable collision" : "Enable collision"}
          >
            <div
              className={`
                absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300
                ${enableCollision
                  ? 'left-4 bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.6)]'
                  : 'left-0.5 bg-white/40'
                }
              `}
            />
          </button>
        </div>

        {/* Pulse on click toggle */}
        <div className="flex flex-col gap-1 items-center">
          <span className={`text-[10px] uppercase tracking-wider transition-all duration-300 ${
            pulseOnClick ? 'text-pink-400' : 'text-white/40'
          }`}>
            Pulse
          </span>
          <button
            onClick={() => onPulseOnClickChange?.(!pulseOnClick)}
            className={`
              w-8 h-4 rounded-full transition-all duration-300 relative
              ${pulseOnClick
                ? 'bg-pink-500/40 border border-pink-500/60'
                : 'bg-white/10 border border-white/20'
              }
            `}
            title={pulseOnClick ? "Click anywhere to pulse waves" : "Enable click pulse waves"}
          >
            <div
              className={`
                absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300
                ${pulseOnClick
                  ? 'left-4 bg-pink-400 shadow-[0_0_6px_rgba(236,72,153,0.6)]'
                  : 'left-0.5 bg-white/40'
                }
              `}
            />
          </button>
        </div>

        {/* Collision sliders - appear when collision is enabled */}
        <motion.div
          initial={false}
          animate={{
            width: enableCollision ? "auto" : 0,
            opacity: enableCollision ? 1 : 0,
            marginLeft: enableCollision ? 0 : -8,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="overflow-hidden flex items-center gap-3"
        >
          {/* Radius slider */}
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[10px] text-orange-400/80 uppercase tracking-wider">
              Radius
            </span>
            <div className="relative group">
              {/* Glow effect behind slider */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500/30 via-rose-500/30 to-fuchsia-500/30 blur-sm opacity-60" />
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={collisionRadius}
                onChange={(e) => onCollisionRadiusChange(parseFloat(e.target.value))}
                className="collision-slider relative"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  width: '56px',
                  height: '6px',
                  background: 'linear-gradient(90deg, #f97316, #ec4899, #a855f7)',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(249, 115, 22, 0.4), inset 0 1px 2px rgba(255,255,255,0.2)',
                }}
              />
            </div>
          </div>

          {/* Force slider */}
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[10px] text-orange-400/80 uppercase tracking-wider">
              Force
            </span>
            <div className="relative group">
              {/* Glow effect behind slider */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500/30 via-rose-500/30 to-fuchsia-500/30 blur-sm opacity-60" />
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={collisionStrength}
                onChange={(e) => onCollisionStrengthChange(parseFloat(e.target.value))}
                className="collision-slider relative"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  width: '56px',
                  height: '6px',
                  background: 'linear-gradient(90deg, #f97316, #ec4899, #a855f7)',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(249, 115, 22, 0.4), inset 0 1px 2px rgba(255,255,255,0.2)',
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* Explosion Physics sliders */}
        <motion.div
          initial={false}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="flex gap-3 items-center ml-2"
        >
          {/* Fragment Force slider */}
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[10px] text-red-400/80 uppercase tracking-wider">
              Force
            </span>
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/30 via-orange-500/30 to-yellow-500/30 blur-sm opacity-60" />
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={fragmentPushMultiplier}
                onChange={(e) => onFragmentPushMultiplierChange?.(parseFloat(e.target.value))}
                className="explosion-slider relative"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  width: '56px',
                  height: '6px',
                  background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308)',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.4), inset 0 1px 2px rgba(255,255,255,0.2)',
                }}
              />
            </div>
          </div>

          {/* Particle Friction slider */}
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[10px] text-red-400/80 uppercase tracking-wider">
              Friction
            </span>
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/30 via-orange-500/30 to-yellow-500/30 blur-sm opacity-60" />
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={particleFriction}
                onChange={(e) => onParticleFrictionChange?.(parseFloat(e.target.value))}
                className="explosion-slider relative"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  width: '56px',
                  height: '6px',
                  background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308)',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.4), inset 0 1px 2px rgba(255,255,255,0.2)',
                }}
              />
            </div>
          </div>

          {/* Blast Radius slider */}
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[10px] text-red-400/80 uppercase tracking-wider">
              Blast
            </span>
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/30 via-orange-500/30 to-yellow-500/30 blur-sm opacity-60" />
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={fragmentRadiusMultiplier}
                onChange={(e) => onFragmentRadiusMultiplierChange?.(parseFloat(e.target.value))}
                className="explosion-slider relative"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  width: '56px',
                  height: '6px',
                  background: 'linear-gradient(90deg, #ef4444, #f97316, #eab308)',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.4), inset 0 1px 2px rgba(255,255,255,0.2)',
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* Converge toggle - neon gradient button */}
        <div className="flex flex-col gap-1 items-center">
          <span className={`text-[10px] uppercase tracking-wider transition-all duration-500 ${
            isPulsing ? 'text-cyan-400' : 'text-white/40'
          }`}>
            Converge
          </span>
          <button
            onClick={onPulse}
            className="converge-btn group relative"
            title={isPulsing ? "Release particles" : "Converge particles to center"}
          >
            {/* Outer glow layers */}
            <div className={`
              absolute inset-0 rounded-full transition-all duration-500
              ${isPulsing
                ? 'bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-500 opacity-100 blur-md scale-150'
                : 'bg-white/20 opacity-0 blur-sm scale-100'
              }
            `} />
            <div className={`
              absolute inset-0 rounded-full transition-all duration-500
              ${isPulsing
                ? 'bg-gradient-to-br from-cyan-300 via-blue-400 to-fuchsia-400 opacity-80 blur-sm scale-125'
                : 'opacity-0'
              }
            `} />

            {/* Main button surface */}
            <div className={`
              relative w-8 h-8 rounded-full transition-all duration-300 flex items-center justify-center
              ${isPulsing
                ? 'bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-500 shadow-[0_0_20px_rgba(34,211,238,0.6),0_0_40px_rgba(139,92,246,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]'
                : 'bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/30'
              }
            `}>
              {/* Inner core dot */}
              <div className={`
                rounded-full transition-all duration-300
                ${isPulsing
                  ? 'w-2 h-2 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]'
                  : 'w-3 h-3 bg-white/40 group-hover:bg-white/60'
                }
              `} />
            </div>
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10" />

        {/* Shortcuts hint */}
        <div className="flex flex-col gap-1 items-center">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            Shortcuts
          </span>
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-white/60 bg-white/10 rounded">
              Shift
            </kbd>
            <span className="text-[9px] text-white/40">+</span>
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-white/60 bg-white/10 rounded">
              Space
            </kbd>
            <span className="text-[9px] text-white/50 ml-1">Freeze</span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-white/10" />

        {/* Flight Controls toggle */}
        <div className="flex flex-col gap-1 items-center">
          <span className={`text-[10px] uppercase tracking-wider transition-all duration-300 ${
            enableFlightControls ? 'text-violet-400' : 'text-white/40'
          }`}>
            Flight
          </span>
          <button
            onClick={() => onFlightControlsChange?.(!enableFlightControls)}
            className={`
              w-8 h-4 rounded-full transition-all duration-300 relative
              ${enableFlightControls
                ? 'bg-violet-500/40 border border-violet-500/60'
                : 'bg-white/10 border border-white/20'
              }
            `}
            title={enableFlightControls ? "Disable WASD flight" : "Enable WASD spaceship controls"}
          >
            <div
              className={`
                absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300
                ${enableFlightControls
                  ? 'left-4 bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.6)]'
                  : 'left-0.5 bg-white/40'
                }
              `}
            />
          </button>
        </div>

        {/* Flight control sliders - appear when flight is enabled */}
        <motion.div
          initial={false}
          animate={{
            width: enableFlightControls ? "auto" : 0,
            opacity: enableFlightControls ? 1 : 0,
            marginLeft: enableFlightControls ? 0 : -8,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="overflow-hidden flex items-center gap-3"
        >
          {/* Speed slider */}
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[10px] text-violet-400/80 uppercase tracking-wider">
              Speed
            </span>
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/30 via-purple-500/30 to-fuchsia-500/30 blur-sm opacity-60" />
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={flightSpeed}
                onChange={(e) => onFlightSpeedChange?.(parseFloat(e.target.value))}
                className="collision-slider relative"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  width: '56px',
                  height: '6px',
                  background: 'linear-gradient(90deg, #8b5cf6, #a855f7, #d946ef)',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(139, 92, 246, 0.4), inset 0 1px 2px rgba(255,255,255,0.2)',
                }}
                title={`Flight speed: ${flightSpeed.toFixed(1)}`}
              />
            </div>
          </div>

          {/* Look sensitivity slider */}
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[10px] text-violet-400/80 uppercase tracking-wider">
              Look
            </span>
            <div className="relative group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/30 via-purple-500/30 to-fuchsia-500/30 blur-sm opacity-60" />
              <input
                type="range"
                min="0.001"
                max="0.01"
                step="0.001"
                value={lookSensitivity}
                onChange={(e) => onLookSensitivityChange?.(parseFloat(e.target.value))}
                className="collision-slider relative"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  width: '56px',
                  height: '6px',
                  background: 'linear-gradient(90deg, #8b5cf6, #a855f7, #d946ef)',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(139, 92, 246, 0.4), inset 0 1px 2px rgba(255,255,255,0.2)',
                }}
                title={`Look sensitivity: ${(lookSensitivity * 1000).toFixed(1)}`}
              />
            </div>
          </div>

          {/* Flight controls hint - organized keyboard reference */}
          <div className="flex flex-col gap-2 pl-2 border-l border-violet-500/20">
            {/* Movement group */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-wider text-violet-400/50 font-medium">Movement</span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-violet-300/80 bg-violet-500/15 border border-violet-500/20 rounded">WASD</kbd>
                  <span className="text-[9px] text-violet-300/50">Move</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-violet-300/80 bg-violet-500/15 border border-violet-500/20 rounded">Q</kbd>
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-violet-300/80 bg-violet-500/15 border border-violet-500/20 rounded">E</kbd>
                  <span className="text-[9px] text-violet-300/50">Up/Down</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-violet-300/80 bg-violet-500/15 border border-violet-500/20 rounded">R</kbd>
                  <span className="text-[9px] text-violet-300/50">Reset</span>
                </div>
              </div>
            </div>

            {/* Camera group */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-wider text-violet-400/50 font-medium">Camera</span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-violet-300/80 bg-violet-500/15 border border-violet-500/20 rounded">MMB</kbd>
                  <span className="text-[9px] text-violet-300/50">Look</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[9px] font-mono text-violet-300/80 bg-violet-500/15 border border-violet-500/20 rounded">Scroll</kbd>
                  <span className="text-[9px] text-violet-300/50">Zoom</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 text-[9px] font-mono text-violet-300/80 bg-violet-500/15 border border-violet-500/20 rounded">Shift</kbd>
                  <span className="text-[8px] text-violet-300/30">+</span>
                  <kbd className="px-1 py-0.5 text-[9px] font-mono text-violet-300/80 bg-violet-500/15 border border-violet-500/20 rounded">A/D</kbd>
                  <span className="text-[9px] text-violet-300/50">Roll</span>
                </div>
              </div>
            </div>

            {/* Modes group */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-wider text-violet-400/50 font-medium">Modes</span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 text-[9px] font-mono text-cyan-300/80 bg-cyan-500/15 border border-cyan-500/20 rounded">Shift</kbd>
                  <span className="text-[8px] text-violet-300/30">+</span>
                  <kbd className="px-1 py-0.5 text-[9px] font-mono text-cyan-300/80 bg-cyan-500/15 border border-cyan-500/20 rounded">FLY</kbd>
                  <span className="text-[9px] text-cyan-300/50">Cruise</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 text-[9px] font-mono text-amber-300/80 bg-amber-500/15 border border-amber-500/20 rounded">Shift</kbd>
                  <span className="text-[8px] text-violet-300/30">+</span>
                  <kbd className="px-1 py-0.5 text-[9px] font-mono text-amber-300/80 bg-amber-500/15 border border-amber-500/20 rounded">ZEN</kbd>
                  <span className="text-[9px] text-amber-300/50">Zen</span>
                </div>
              </div>
              <span className="text-[8px] text-violet-300/30 italic pl-0.5">Cruise: W/S adjusts speed</span>
            </div>
          </div>

          {/* Saves section */}
          {onOpenSnapshots && (
            <div className="flex flex-col gap-2 pt-3 mt-3 border-t border-white/5">
              <span className="text-[9px] uppercase tracking-wider text-violet-400/50 font-medium">Saves</span>
              <button
                onClick={onOpenSnapshots}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300/80 text-xs transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
                Snapshots & Presets
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Flow settings button - large invisible click area around the orb */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative w-16 h-16 cursor-pointer focus:outline-none focus-visible:outline-none"
        title="Visual settings"
      >
        <FloatingOrb isActive={isOpen} />
      </button>
    </div>
  );
}

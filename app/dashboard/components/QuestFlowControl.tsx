"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface QuestFlowControlProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  tubesOpacity: number;
  onTubesOpacityChange: (opacity: number) => void;
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
}

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
  speed,
  onSpeedChange,
  tubesOpacity,
  onTubesOpacityChange,
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
}: QuestFlowControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={controlRef}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2"
    >
      {/* Slider panel - slides in/out */}
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
        {/* Speed slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Speed
            </span>
            <span className="text-[10px] text-white/60 font-mono">
              {speed.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
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
          />
        </div>

        {/* Tubes opacity slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Tubes
            </span>
            <span className="text-[10px] text-white/60 font-mono">
              {Math.round(tubesOpacity)}
            </span>
          </div>
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

        {/* Panel opacity slider */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Panels
            </span>
            <span className="text-[10px] text-white/60 font-mono">
              {Math.round(panelOpacity)}
            </span>
          </div>
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
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Color
            </span>
            <span className="text-[10px] text-white/60 font-mono">
              {Math.round(colorIntensity)}
            </span>
          </div>
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
            {/* Color preview overlay for better visibility */}
            <div
              className="absolute inset-0 rounded pointer-events-none border border-white/10"
              style={{ backgroundColor }}
            />
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
            <div className="flex justify-between items-center w-full px-1">
              <span className="text-[10px] text-orange-400/80 uppercase tracking-wider">
                Radius
              </span>
              <span className="text-[10px] text-orange-300/60 font-mono">
                {Math.round(collisionRadius)}
              </span>
            </div>
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
            <div className="flex justify-between items-center w-full px-1">
              <span className="text-[10px] text-orange-400/80 uppercase tracking-wider">
                Force
              </span>
              <span className="text-[10px] text-orange-300/60 font-mono">
                {collisionStrength.toFixed(1)}
              </span>
            </div>
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
      </motion.div>

      {/* Flow settings button - large invisible click area around the orb */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative w-16 h-16 cursor-pointer"
        title="Visual settings"
      >
        <FloatingOrb isActive={isOpen} />
      </button>
    </div>
  );
}

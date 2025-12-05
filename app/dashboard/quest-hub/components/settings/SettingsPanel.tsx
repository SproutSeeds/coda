"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gauge,
  Palette,
  Sparkles,
  MousePointer2,
  Plane,
  Save,
  Droplets,
  Zap,
} from "lucide-react";
import { SettingsSection, SettingsSlider, SettingsToggle, SettingsColorPicker } from "./SettingsSection";
import { KeyboardShortcutsSection } from "./KeyboardShortcutsSection";
import type { ParticleShape } from "@/components/effects/TubesEffect";

// Color theme presets
const COLOR_THEMES = [
  { id: "sorcerer", name: "Sorcerer", colors: ["#a855f7", "#f59e0b", "#f472b6", "#8b5cf6"] },
  { id: "wanderer", name: "Wanderer", colors: ["#4ade80", "#22d3ee", "#a78bfa", "#34d399"] },
  { id: "ember", name: "Ember", colors: ["#ef4444", "#f97316", "#eab308", "#dc2626"] },
  { id: "ocean", name: "Ocean", colors: ["#0ea5e9", "#06b6d4", "#3b82f6", "#8b5cf6"] },
  { id: "aurora", name: "Aurora", colors: ["#10b981", "#14b8a6", "#06b6d4", "#8b5cf6"] },
] as const;

// Particle shape options
const PARTICLE_SHAPES: { value: ParticleShape; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "circle", label: "Circle" },
  { value: "glow", label: "Glow" },
  { value: "star", label: "Star" },
  { value: "diamond", label: "Diamond" },
  { value: "hexagon", label: "Hexagon" },
  { value: "sphere", label: "Sphere 3D" },
  { value: "cube", label: "Cube 3D" },
  { value: "octahedron", label: "Octahedron 3D" },
];

interface SettingsPanelProps {
  // Speed & Motion
  tubeSpeed: number;
  onTubeSpeedChange: (v: number) => void;
  particleSpeed: number;
  onParticleSpeedChange: (v: number) => void;
  idleTimeout: number;
  onIdleTimeoutChange: (v: number) => void;

  // Appearance
  tubesOpacity: number;
  onTubesOpacityChange: (v: number) => void;
  particlesOpacity: number;
  onParticlesOpacityChange: (v: number) => void;
  colorIntensity: number;
  onColorIntensityChange: (v: number) => void;
  backgroundColor: string;
  onBackgroundColorChange: (v: string) => void;
  fogIntensity: number;
  onFogIntensityChange: (v: number) => void;
  panelOpacity: number;
  onPanelOpacityChange: (v: number) => void;

  // Colors
  tubeColors: string[];
  onTubeColorsChange: (colors: string[]) => void;

  // Particles
  particleCount: number;
  onParticleCountChange: (v: number) => void;
  tubeRadius: number;
  onTubeRadiusChange: (v: number) => void;
  particleShape: ParticleShape;
  onParticleShapeChange: (v: ParticleShape) => void;
  particleRotation: number;
  onParticleRotationChange: (v: number) => void;

  // Interactions
  mouseFollow: boolean;
  onMouseFollowChange: (v: boolean) => void;
  enableCollision: boolean;
  onCollisionChange: (v: boolean) => void;
  collisionRadius: number;
  onCollisionRadiusChange: (v: number) => void;
  collisionStrength: number;
  onCollisionStrengthChange: (v: number) => void;
  pulseOnClick: boolean;
  onPulseOnClickChange: (v: boolean) => void;
  onPulse: () => void;
  isPulsing: boolean;

  // Flight Controls
  enableFlightControls: boolean;
  onFlightControlsChange: (v: boolean) => void;
  flightSpeed: number;
  onFlightSpeedChange: (v: number) => void;
  lookSensitivity: number;
  onLookSensitivityChange: (v: number) => void;
  autoForward: boolean;
  onAutoForwardChange: (v: boolean) => void;

  // Zen Mode
  isZenMode: boolean;
  onZenModeChange: (v: boolean) => void;

  // Explosion Physics
  fragmentPushMultiplier: number;
  onFragmentPushMultiplierChange: (v: number) => void;
  particleFriction: number;
  onParticleFrictionChange: (v: number) => void;
  fragmentRadiusMultiplier: number;
  onFragmentRadiusMultiplierChange: (v: number) => void;

  // Saves
  onOpenSnapshots: () => void;

  // Mode indicator
  currentMode: "flow" | "focus";
}

/**
 * Floating Orb button - the "point of light" trigger
 */
function FloatingOrb({ isActive, onClick }: { isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative w-12 h-12 flex items-center justify-center group"
    >
      {/* Hover indicator ring */}
      <div
        className="absolute rounded-full transition-all duration-500 ease-in-out
                   opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100"
        style={{
          width: "56px",
          height: "56px",
          background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 40%, transparent 70%)",
        }}
      />

      {/* Orb container */}
      <div className="relative flex items-center justify-center transition-transform duration-500 ease-in-out group-hover:scale-[2.5]">
        {/* Outer atmospheric glow */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          animate={{
            scale: [1, 1.3, 1],
            opacity: isActive ? [0.4, 0.6, 0.4] : [0.15, 0.25, 0.15],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: "24px",
            height: "24px",
            background: isActive
              ? "radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.15) 40%, transparent 70%)"
              : "radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.08) 40%, transparent 70%)",
          }}
        />

        {/* Inner glow halo */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          animate={{ scale: isActive ? [1, 1.15, 1] : [1, 1.08, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          style={{
            width: "12px",
            height: "12px",
            background: isActive
              ? "radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)"
              : "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)",
          }}
        />

        {/* Orb core */}
        <motion.div
          className="rounded-full"
          animate={{ y: [-1.5, 1.5, -1.5], x: [-0.5, 0.5, -0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: isActive ? "4px" : "3px",
            height: isActive ? "4px" : "3px",
            backgroundColor: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
            boxShadow: isActive
              ? "0 0 2px 1px rgba(255,255,255,0.8), 0 0 4px 2px rgba(255,255,255,0.5), 0 0 8px 3px rgba(255,255,255,0.3)"
              : "0 0 2px 1px rgba(255,255,255,0.4), 0 0 4px 2px rgba(255,255,255,0.15)",
            transition: "width 0.5s ease, height 0.5s ease, background-color 0.5s ease, box-shadow 0.5s ease",
          }}
        />
      </div>
    </button>
  );
}

/**
 * Main floating settings panel with collapsible sections
 */
export function SettingsPanel(props: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Find matching theme
  const activeTheme = COLOR_THEMES.find(
    (t) => JSON.stringify(t.colors) === JSON.stringify(props.tubeColors)
  );

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Floating Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            data-settings-panel
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-80 rounded-2xl
                       bg-black/70 backdrop-blur-xl border border-white/10
                       shadow-2xl shadow-black/50 flex flex-col"
            style={{
              // Equal distance from bottom as from top (bottom-6 = 24px, so max height leaves 24px at top too)
              // Plus account for the toggle button (~48px) and gap (12px)
              maxHeight: 'calc(100vh - 24px - 24px - 48px - 12px)',
            }}
            onWheel={(e) => {
              // Prevent page scroll and WebGL zoom when hovering over panel
              e.stopPropagation();
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-sm font-medium text-white/80">Settings</span>
              <span
                className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded
                          ${props.currentMode === "focus"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-cyan-500/20 text-cyan-400"
                          }`}
              >
                {props.currentMode}
              </span>
            </div>

            {/* Content - individual sections handle their own scrolling */}
            <div
              className="flex-1 min-h-0 overflow-y-auto scrollbar-none overscroll-contain"
              onWheel={(e) => {
                // Stop propagation to prevent page scroll and WebGL zoom
                e.stopPropagation();
              }}
            >
              {/* Speed & Motion */}
              <SettingsSection
                title="Speed & Motion"
                icon={<Gauge size={14} />}
                defaultOpen={true}
                accentColor="rgb(34, 211, 238)"
              >
                <SettingsSlider
                  label="Spin"
                  value={props.tubeSpeed}
                  onChange={props.onTubeSpeedChange}
                  min={0}
                  max={10}
                  step={0.1}
                />
                <SettingsSlider
                  label="Drift"
                  value={props.particleSpeed}
                  onChange={props.onParticleSpeedChange}
                  min={0}
                  max={2.5}
                  step={0.05}
                />
                <SettingsSlider
                  label="Idle"
                  value={props.idleTimeout}
                  onChange={props.onIdleTimeoutChange}
                  min={0}
                  max={30}
                  step={1}
                  unit="s"
                />
              </SettingsSection>

              {/* Appearance */}
              <SettingsSection
                title="Appearance"
                icon={<Droplets size={14} />}
                accentColor="rgb(251, 146, 60)"
              >
                <SettingsSlider
                  label="Tubes"
                  value={props.tubesOpacity}
                  onChange={props.onTubesOpacityChange}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                />
                <SettingsSlider
                  label="Sparks"
                  value={props.particlesOpacity}
                  onChange={props.onParticlesOpacityChange}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                />
                <SettingsSlider
                  label="Color"
                  value={props.colorIntensity}
                  onChange={props.onColorIntensityChange}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                />
                <SettingsSlider
                  label="Fog"
                  value={props.fogIntensity}
                  onChange={props.onFogIntensityChange}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                />
                <SettingsColorPicker
                  label="Background"
                  value={props.backgroundColor}
                  onChange={props.onBackgroundColorChange}
                />
              </SettingsSection>

              {/* Colors & Themes */}
              <SettingsSection
                title="Colors & Themes"
                icon={<Palette size={14} />}
                accentColor="rgb(168, 85, 247)"
              >
                <div className="flex flex-wrap gap-2">
                  {COLOR_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => props.onTubeColorsChange([...theme.colors])}
                      className={`w-10 h-10 rounded-md p-0.5 grid grid-cols-2 gap-px
                                transition-all duration-200
                                ${activeTheme?.id === theme.id
                                  ? "ring-2 ring-white/50 ring-offset-1 ring-offset-black/50"
                                  : "hover:ring-1 hover:ring-white/20"
                                }`}
                      title={theme.name}
                    >
                      {theme.colors.map((color, i) => (
                        <div
                          key={i}
                          className="rounded-[2px]"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </button>
                  ))}
                </div>
              </SettingsSection>

              {/* Particles */}
              <SettingsSection
                title="Particles"
                icon={<Sparkles size={14} />}
                accentColor="rgb(244, 114, 182)"
              >
                <SettingsSlider
                  label="Count"
                  value={props.particleCount}
                  onChange={props.onParticleCountChange}
                  min={0}
                  max={10000}
                  step={500}
                />
                <SettingsSlider
                  label="Size"
                  value={props.tubeRadius}
                  onChange={props.onTubeRadiusChange}
                  min={0.05}
                  max={0.5}
                  step={0.01}
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs text-white/60">Shape</label>
                  <select
                    value={props.particleShape}
                    onChange={(e) => props.onParticleShapeChange(e.target.value as ParticleShape)}
                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/10
                             text-xs text-white/70 cursor-pointer
                             focus:outline-none focus:border-white/20"
                  >
                    {PARTICLE_SHAPES.map((shape) => (
                      <option key={shape.value} value={shape.value}>
                        {shape.label}
                      </option>
                    ))}
                  </select>
                </div>
                {["sphere", "cube", "octahedron", "tetrahedron"].includes(props.particleShape) && (
                  <SettingsSlider
                    label="Rotation"
                    value={props.particleRotation}
                    onChange={props.onParticleRotationChange}
                    min={0}
                    max={100}
                    step={5}
                    unit="%"
                  />
                )}
              </SettingsSection>

              {/* Interactions */}
              <SettingsSection
                title="Interactions"
                icon={<MousePointer2 size={14} />}
                accentColor="rgb(74, 222, 128)"
              >
                <SettingsToggle
                  label="Mouse Follow"
                  description="Particles follow cursor"
                  checked={props.mouseFollow}
                  onChange={props.onMouseFollowChange}
                  accentColor="rgb(34, 211, 238)"
                />
                <SettingsToggle
                  label="Collision"
                  description="Particles collide with cursor"
                  checked={props.enableCollision}
                  onChange={props.onCollisionChange}
                  accentColor="rgb(251, 146, 60)"
                />
                {props.enableCollision && (
                  <>
                    <SettingsSlider
                      label="Radius"
                      value={props.collisionRadius}
                      onChange={props.onCollisionRadiusChange}
                      min={1}
                      max={30}
                      step={1}
                    />
                    <SettingsSlider
                      label="Force"
                      value={props.collisionStrength}
                      onChange={props.onCollisionStrengthChange}
                      min={0.5}
                      max={3}
                      step={0.1}
                    />
                  </>
                )}
                <SettingsToggle
                  label="Pulse on Click"
                  checked={props.pulseOnClick ?? false}
                  onChange={props.onPulseOnClickChange ?? (() => {})}
                  accentColor="rgb(244, 114, 182)"
                />
                <button
                  onClick={props.onPulse}
                  className={`w-full py-2 rounded-lg text-xs font-medium transition-all
                            ${props.isPulsing
                              ? "bg-gradient-to-r from-cyan-500/30 via-blue-500/30 to-fuchsia-500/30 text-white"
                              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                            }`}
                >
                  {props.isPulsing ? "Stop Converge" : "Converge"}
                </button>
              </SettingsSection>

              {/* Explosion Physics */}
              <SettingsSection
                title="Explosion Physics"
                icon={<Zap size={14} />}
                accentColor="rgb(239, 68, 68)"
              >
                <SettingsSlider
                  label="Fragment Force"
                  value={props.fragmentPushMultiplier}
                  onChange={props.onFragmentPushMultiplierChange}
                  min={1}
                  max={20}
                  step={1}
                />
                <SettingsSlider
                  label="Particle Friction"
                  value={props.particleFriction}
                  onChange={props.onParticleFrictionChange}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                />
                <SettingsSlider
                  label="Blast Radius"
                  value={props.fragmentRadiusMultiplier}
                  onChange={props.onFragmentRadiusMultiplierChange}
                  min={0.5}
                  max={3}
                  step={0.1}
                />
              </SettingsSection>

              {/* Flight Controls */}
              <SettingsSection
                title="Flight Controls"
                icon={<Plane size={14} />}
                accentColor="rgb(139, 92, 246)"
              >
                <SettingsToggle
                  label="Enable Flight"
                  description="WASD to fly around"
                  checked={props.enableFlightControls}
                  onChange={props.onFlightControlsChange}
                  accentColor="rgb(139, 92, 246)"
                />
                {props.enableFlightControls && (
                  <>
                    <SettingsSlider
                      label="Speed"
                      value={props.flightSpeed}
                      onChange={props.onFlightSpeedChange}
                      min={0.1}
                      max={2}
                      step={0.1}
                    />
                    <SettingsSlider
                      label="Look"
                      value={props.lookSensitivity * 1000}
                      onChange={(v) => props.onLookSensitivityChange(v / 1000)}
                      min={1}
                      max={10}
                      step={1}
                    />
                    <SettingsToggle
                      label="Auto-Forward"
                      description="Cruise control mode"
                      checked={props.autoForward}
                      onChange={props.onAutoForwardChange}
                      accentColor="rgb(34, 211, 238)"
                    />
                    <div className="text-[10px] text-white/30 space-y-0.5 mt-2">
                      <div>WASD - Move | Q/E - Up/Down</div>
                      <div>MMB - Look | Scroll - Zoom</div>
                      <div>Shift+A/D - Roll | R - Reset</div>
                    </div>
                  </>
                )}
              </SettingsSection>

              {/* Keyboard Shortcuts */}
              <KeyboardShortcutsSection />

              {/* Saves */}
              <SettingsSection
                title="Saves"
                icon={<Save size={14} />}
                defaultOpen={true}
                accentColor="rgb(96, 165, 250)"
              >
                <button
                  onClick={props.onOpenSnapshots}
                  className="w-full py-2 rounded-lg bg-white/5 border border-white/10
                           text-xs text-white/60 hover:bg-white/10 hover:text-white/80
                           transition-colors"
                >
                  Snapshots & Presets
                </button>
                <SettingsToggle
                  label="Zen Mode"
                  description="Hide all UI"
                  checked={props.isZenMode}
                  onChange={props.onZenModeChange}
                  accentColor="rgb(251, 191, 36)"
                />
              </SettingsSection>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Orb Trigger */}
      <FloatingOrb isActive={isOpen} onClick={() => setIsOpen(!isOpen)} />
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext, ReactNode } from "react";
import { TubesEffect, type ParticleShape, type TubesSnapshotAPI, type CameraState, type ParticleExportData } from "@/components/effects/TubesEffect";
import { NavigationMinimap } from "@/components/effects/NavigationMinimap";
import { SettingsPanel } from "./quest-hub/components/settings/SettingsPanel";
import { SnapshotManager } from "./quest-hub/components/SnapshotManager";
import { useShortcut, useSequenceShortcut } from "@/lib/shortcuts";
import type { SnapshotSettings } from "@/lib/storage/scene-snapshots";

// Shared localStorage key for dashboard space settings
const STORAGE_KEY = "coda-flow-mode-settings";
// Old keys to migrate from
const OLD_STORAGE_KEYS = [
  "quest-hub-settings",
  "dashboard-visual-settings",
  "choose-path-flow-settings",
  "coda-visual-settings"
];

// Default colors for different paths
const SORCERER_COLORS = ["#a855f7", "#f59e0b", "#f472b6", "#8b5cf6"];
const WANDERER_COLORS = ["#4ade80", "#22d3ee", "#a78bfa", "#34d399"];
const DEFAULT_COLORS = ["#a855f7", "#f59e0b", "#22d3ee", "#f472b6"];

// Context for sharing space state with child components
interface SpaceContextType {
  isZenMode: boolean;
  setIsZenMode: (value: boolean) => void;
  panelOpacity: number;
  backgroundColor: string;
}

const SpaceContext = createContext<SpaceContextType | null>(null);

export function useSpaceContext() {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error("useSpaceContext must be used within DashboardSpaceProvider");
  }
  return context;
}

interface DashboardSpaceProviderProps {
  children: ReactNode;
  chosenPath?: "wanderer" | "sorcerer" | null;
  completionPercent?: number;
}

export function DashboardSpaceProvider({
  children,
  chosenPath,
  completionPercent = 50
}: DashboardSpaceProviderProps) {
  // TubesEffect visual settings - defaults match GlobalVisualShell Flow Mode
  const [tubeSpeed, setTubeSpeed] = useState(2);
  const [particleSpeed, setParticleSpeed] = useState(2);
  const [tubesOpacity, setTubesOpacity] = useState(0);
  const [particlesOpacity, setParticlesOpacity] = useState(70);
  const [panelOpacity, setPanelOpacity] = useState(80);
  const [colorIntensity, setColorIntensity] = useState(60);
  const [mouseFollow, setMouseFollow] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [enableCollision, setEnableCollision] = useState(false);
  const [collisionRadius, setCollisionRadius] = useState(15);
  const [collisionStrength, setCollisionStrength] = useState(1.5);
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  const [hasClicked, setHasClicked] = useState(false);
  const [idleTimeout, setIdleTimeout] = useState(5);
  const [tubeRadius, setTubeRadius] = useState(0.15);
  const [particleCount, setParticleCount] = useState(5000);
  const [isZenMode, setIsZenMode] = useState(false);
  const [pulseOnClick, setPulseOnClick] = useState(false);
  const [fogIntensity, setFogIntensity] = useState(0);  // No fog in Flow mode
  const [particleShape, setParticleShape] = useState<ParticleShape>('octahedron');
  const [particleRotation, setParticleRotation] = useState(50);

  // Explosion physics
  const [fragmentPushMultiplier, setFragmentPushMultiplier] = useState(5);
  const [particleFriction, setParticleFriction] = useState(15);
  const [fragmentRadiusMultiplier, setFragmentRadiusMultiplier] = useState(1);

  // Flight controls state
  const [enableFlightControls, setEnableFlightControls] = useState(true);
  const [flightSpeed, setFlightSpeed] = useState(0.5);
  const [lookSensitivity, setLookSensitivity] = useState(0.003);
  const [autoForward, setAutoForward] = useState(false);

  // Navigation minimap state
  const [showMinimap, setShowMinimap] = useState(true);
  const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 0, z: 50 });
  const [playerQuaternion, setPlayerQuaternion] = useState({ x: 0, y: 0, z: 0, w: 1 });
  const [cruiseState, setCruiseState] = useState({
    isActive: false,
    velocity: { x: 0, y: 0, z: 0 },
    axisLabels: [] as string[],
    speedMultiplier: 0,
    targetSpeed: 0,
    speedCeiling: 1,
    isLocked: false,
  });

  // Custom tube colors - null means use path-based colors
  const [customTubeColors, setCustomTubeColors] = useState<string[] | null>(null);

  // Store previous state for toggle functionality
  const [previousSpeed, setPreviousSpeed] = useState<number | null>(null);
  const [previousMouseFollow, setPreviousMouseFollow] = useState<boolean | null>(null);

  // Snapshot manager state
  const tubesSnapshotRef = useRef<TubesSnapshotAPI | null>(null);
  const [isSnapshotManagerOpen, setIsSnapshotManagerOpen] = useState(false);

  // Customizable shortcuts
  const freezeShortcut = useShortcut('freeze');

  // Sequence shortcuts for ZEN mode
  useSequenceShortcut('zenMode', () => {
    setIsZenMode(true);
  });

  // Load saved settings from localStorage (with migration from old keys)
  useEffect(() => {
    // First, try to migrate from old keys
    for (const oldKey of OLD_STORAGE_KEYS) {
      const oldData = localStorage.getItem(oldKey);
      if (oldData) {
        try {
          const existing = localStorage.getItem(STORAGE_KEY);
          if (!existing) {
            localStorage.setItem(STORAGE_KEY, oldData);
          }
          localStorage.removeItem(oldKey);
        } catch {
          localStorage.removeItem(oldKey);
        }
      }
    }

    // Now load from storage key
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (typeof settings.tubeSpeed === "number") setTubeSpeed(settings.tubeSpeed);
        if (typeof settings.particleSpeed === "number") setParticleSpeed(settings.particleSpeed);
        if (typeof settings.tubesOpacity === "number") setTubesOpacity(settings.tubesOpacity);
        if (typeof settings.particlesOpacity === "number") setParticlesOpacity(settings.particlesOpacity);
        if (typeof settings.panelOpacity === "number") setPanelOpacity(settings.panelOpacity);
        if (typeof settings.colorIntensity === "number") setColorIntensity(settings.colorIntensity);
        if (typeof settings.mouseFollow === "boolean") setMouseFollow(settings.mouseFollow);
        if (typeof settings.enableCollision === "boolean") setEnableCollision(settings.enableCollision);
        if (typeof settings.collisionRadius === "number") setCollisionRadius(settings.collisionRadius);
        if (typeof settings.collisionStrength === "number") setCollisionStrength(settings.collisionStrength);
        if (typeof settings.backgroundColor === "string") setBackgroundColor(settings.backgroundColor);
        if (Array.isArray(settings.customTubeColors)) setCustomTubeColors(settings.customTubeColors);
        if (typeof settings.idleTimeout === "number") setIdleTimeout(settings.idleTimeout);
        if (typeof settings.tubeRadius === "number") setTubeRadius(settings.tubeRadius);
        if (typeof settings.particleCount === "number") setParticleCount(settings.particleCount);
        if (typeof settings.pulseOnClick === "boolean") setPulseOnClick(settings.pulseOnClick);
        if (typeof settings.fogIntensity === "number") setFogIntensity(settings.fogIntensity);
        if (typeof settings.particleShape === "string") setParticleShape(settings.particleShape);
        if (typeof settings.particleRotation === "number") setParticleRotation(settings.particleRotation);
        if (typeof settings.fragmentPushMultiplier === "number") setFragmentPushMultiplier(settings.fragmentPushMultiplier);
        if (typeof settings.particleFriction === "number") setParticleFriction(settings.particleFriction);
        if (typeof settings.fragmentRadiusMultiplier === "number") setFragmentRadiusMultiplier(settings.fragmentRadiusMultiplier);
        if (typeof settings.enableFlightControls === "boolean") setEnableFlightControls(settings.enableFlightControls);
        if (typeof settings.flightSpeed === "number") setFlightSpeed(settings.flightSpeed);
        if (typeof settings.lookSensitivity === "number") setLookSensitivity(settings.lookSensitivity);
        if (typeof settings.showMinimap === "boolean") setShowMinimap(settings.showMinimap);
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  // Save settings when they change
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tubeSpeed, particleSpeed, tubesOpacity, particlesOpacity, panelOpacity, colorIntensity,
        mouseFollow, enableCollision, collisionRadius, collisionStrength, backgroundColor,
        customTubeColors, idleTimeout, tubeRadius, particleCount, pulseOnClick, fogIntensity,
        particleShape, particleRotation, fragmentPushMultiplier, particleFriction,
        fragmentRadiusMultiplier, enableFlightControls, flightSpeed, lookSensitivity, showMinimap
      })
    );
  }, [
    tubeSpeed, particleSpeed, tubesOpacity, particlesOpacity, panelOpacity, colorIntensity,
    mouseFollow, enableCollision, collisionRadius, collisionStrength, backgroundColor,
    customTubeColors, idleTimeout, tubeRadius, particleCount, pulseOnClick, fogIntensity,
    particleShape, particleRotation, fragmentPushMultiplier, particleFriction,
    fragmentRadiusMultiplier, enableFlightControls, flightSpeed, lookSensitivity, showMinimap
  ]);

  // Set initial color intensity based on completion progress
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setColorIntensity(completionPercent);
    }
  }, [completionPercent]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to exit Zen Mode
      if (e.key === "Escape" && isZenMode) {
        setIsZenMode(false);
        return;
      }

      // Shift+Space to toggle freeze mode
      if (freezeShortcut.matches(e)) {
        e.preventDefault();
        if (tubeSpeed === 0 && previousSpeed !== null) {
          setTubeSpeed(previousSpeed);
          setPreviousSpeed(null);
          if (previousMouseFollow !== null) {
            setMouseFollow(previousMouseFollow);
            setPreviousMouseFollow(null);
          }
        } else if (tubeSpeed > 0) {
          setPreviousSpeed(tubeSpeed);
          setPreviousMouseFollow(mouseFollow);
          setTubeSpeed(0);
          setMouseFollow(false);
        }
      }

      // M to toggle navigation minimap
      if (e.key === "m" || e.key === "M") {
        setShowMinimap(v => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZenMode, tubeSpeed, previousSpeed, mouseFollow, previousMouseFollow, freezeShortcut]);

  // Handle converge button
  const handleConverge = useCallback(() => {
    setIsPulsing((prev) => !prev);
  }, []);

  // Handle auto forward change
  const handleAutoForwardChange = useCallback((enabled: boolean) => {
    setAutoForward(enabled);
  }, []);

  // Handle cruise speed change (from TubesEffect flight controls)
  const handleCruiseSpeedChange = useCallback((speed: number) => {
    // Update cruise state with the new speed for HUD display
    setCruiseState(prev => ({
      ...prev,
      speedMultiplier: speed
    }));
  }, []);

  // Determine tube colors based on path or custom selection
  const pathBasedColors = useMemo(() =>
    chosenPath === "sorcerer"
      ? SORCERER_COLORS
      : chosenPath === "wanderer"
        ? WANDERER_COLORS
        : DEFAULT_COLORS,
    [chosenPath]
  );

  const tubeColors = customTubeColors || pathBasedColors;

  // Calculate grayscale vs color based on colorIntensity slider
  const effectiveColors = useMemo(() =>
    colorIntensity === 0
      ? ["#ffffff", "#e0e0e0", "#c0c0c0", "#a0a0a0"]
      : tubeColors,
    [colorIntensity, tubeColors]
  );

  // Snapshot handlers
  const handleLoadSettings = useCallback((settings: SnapshotSettings) => {
    if (settings.tubeSpeed !== undefined) setTubeSpeed(settings.tubeSpeed);
    if (settings.particleSpeed !== undefined) setParticleSpeed(settings.particleSpeed);
    if (settings.tubesOpacity !== undefined) setTubesOpacity(settings.tubesOpacity);
    if (settings.particlesOpacity !== undefined) setParticlesOpacity(settings.particlesOpacity);
    if (settings.panelOpacity !== undefined) setPanelOpacity(settings.panelOpacity);
    if (settings.colorIntensity !== undefined) setColorIntensity(settings.colorIntensity);
    if (settings.mouseFollow !== undefined) setMouseFollow(settings.mouseFollow);
    if (settings.enableCollision !== undefined) setEnableCollision(settings.enableCollision);
    if (settings.collisionRadius !== undefined) setCollisionRadius(settings.collisionRadius);
    if (settings.collisionStrength !== undefined) setCollisionStrength(settings.collisionStrength);
    if (settings.backgroundColor !== undefined) setBackgroundColor(settings.backgroundColor);
    if (settings.customTubeColors !== undefined) setCustomTubeColors(settings.customTubeColors);
    if (settings.idleTimeout !== undefined) setIdleTimeout(settings.idleTimeout);
    if (settings.tubeRadius !== undefined) setTubeRadius(settings.tubeRadius);
    if (settings.particleCount !== undefined) setParticleCount(settings.particleCount);
    if (settings.pulseOnClick !== undefined) setPulseOnClick(settings.pulseOnClick);
    if (settings.fogIntensity !== undefined) setFogIntensity(settings.fogIntensity);
    if (settings.particleShape !== undefined) setParticleShape(settings.particleShape as ParticleShape);
    if (settings.particleRotation !== undefined) setParticleRotation(settings.particleRotation);
  }, []);

  const handleLoadFullSnapshot = useCallback((
    settings: SnapshotSettings,
    camera: CameraState,
    particles: ParticleExportData
  ) => {
    handleLoadSettings(settings);
    if (tubesSnapshotRef.current) {
      tubesSnapshotRef.current.setCameraState(camera);
      tubesSnapshotRef.current.setParticleData(particles);
    }
  }, [handleLoadSettings]);

  // Context value
  const contextValue = useMemo(() => ({
    isZenMode,
    setIsZenMode,
    panelOpacity,
    backgroundColor,
  }), [isZenMode, panelOpacity, backgroundColor]);

  // Calculate glass opacity from panel opacity setting
  const bgOpacity = (panelOpacity / 100) * 0.15;

  // Build current settings object for snapshots
  const currentSettings: SnapshotSettings = {
    backgroundColor,
    tubeSpeed,
    particleSpeed,
    tubesOpacity,
    particlesOpacity,
    colorIntensity,
    mouseFollow,
    enableCollision,
    collisionRadius,
    collisionStrength,
    panelOpacity,
    customTubeColors,
    idleTimeout,
    tubeRadius,
    particleCount,
    pulseOnClick,
    fogIntensity,
    particleShape,
    particleRotation,
    enableFlightControls,
    flightSpeed,
    lookSensitivity,
  };

  return (
    <SpaceContext.Provider value={contextValue}>
      <div
        className="relative min-h-screen w-full overflow-hidden"
        style={{ backgroundColor }}
        onClick={() => !hasClicked && setHasClicked(true)}
      >
        {/* WebGL Background - single instance for all dashboard pages */}
        <TubesEffect
          ref={tubesSnapshotRef}
          tubeSpeed={tubeSpeed}
          particleSpeed={particleSpeed}
          opacity={tubesOpacity / 100}
          particlesOpacity={particlesOpacity / 100}
          colors={effectiveColors}
          colorIntensity={colorIntensity / 100}
          disableMouseFollow={!mouseFollow}
          pulseToCenter={isPulsing}
          enableCollision={enableCollision}
          collisionRadius={collisionRadius}
          collisionStrength={collisionStrength}
          backgroundColor={backgroundColor}
          idleTimeout={idleTimeout}
          tubeRadius={tubeRadius}
          particleCount={particleCount}
          pulseOnClick={pulseOnClick}
          particleShape={particleShape}
          particleRotation={particleRotation}
          fogIntensity={fogIntensity}
          fragmentPushMultiplier={fragmentPushMultiplier}
          particleFriction={particleFriction}
          fragmentRadiusMultiplier={fragmentRadiusMultiplier}
          enableFlightControls={enableFlightControls}
          flightSpeed={flightSpeed}
          lookSensitivity={lookSensitivity}
          isZenMode={isZenMode}
          autoForward={autoForward}
          onAutoForwardChange={handleAutoForwardChange}
          onCruiseSpeedChange={handleCruiseSpeedChange}
          onPositionChange={setPlayerPosition}
          onQuaternionChange={setPlayerQuaternion}
          onCruiseStateChange={setCruiseState}
          className="!z-0"
        />

        {/* Navigation Minimap - always visible across all dashboard pages */}
        <NavigationMinimap
          position={playerPosition}
          quaternion={playerQuaternion}
          velocity={cruiseState.velocity}
          axisLabels={cruiseState.axisLabels}
          speedMultiplier={cruiseState.speedMultiplier}
          targetSpeed={cruiseState.targetSpeed}
          speedCeiling={cruiseState.speedCeiling}
          isVisible={showMinimap}
          isCruising={cruiseState.isActive}
          isLocked={cruiseState.isLocked}
        />

        {/* UI elements that fade out in zen mode */}
        <div
          className="transition-opacity duration-500 ease-in-out"
          style={{ opacity: isZenMode ? 0 : 1, pointerEvents: isZenMode ? "none" : "auto" }}
        >
          {/* Children (page content) rendered as overlay */}
          <div className="relative z-10">
            {children}
          </div>
        </div>

        {/* Visual Settings Control - floating panel */}
        <SettingsPanel
          tubeSpeed={tubeSpeed}
          onTubeSpeedChange={setTubeSpeed}
          particleSpeed={particleSpeed}
          onParticleSpeedChange={setParticleSpeed}
          tubesOpacity={tubesOpacity}
          onTubesOpacityChange={setTubesOpacity}
          particlesOpacity={particlesOpacity}
          onParticlesOpacityChange={setParticlesOpacity}
          panelOpacity={panelOpacity}
          onPanelOpacityChange={setPanelOpacity}
          colorIntensity={colorIntensity}
          onColorIntensityChange={setColorIntensity}
          mouseFollow={mouseFollow}
          onMouseFollowChange={setMouseFollow}
          onPulse={handleConverge}
          isPulsing={isPulsing}
          enableCollision={enableCollision}
          onCollisionChange={setEnableCollision}
          collisionRadius={collisionRadius}
          onCollisionRadiusChange={setCollisionRadius}
          collisionStrength={collisionStrength}
          onCollisionStrengthChange={setCollisionStrength}
          backgroundColor={backgroundColor}
          onBackgroundColorChange={setBackgroundColor}
          tubeColors={tubeColors}
          onTubeColorsChange={setCustomTubeColors}
          idleTimeout={idleTimeout}
          onIdleTimeoutChange={setIdleTimeout}
          tubeRadius={tubeRadius}
          onTubeRadiusChange={setTubeRadius}
          particleCount={particleCount}
          onParticleCountChange={setParticleCount}
          isZenMode={isZenMode}
          onZenModeChange={setIsZenMode}
          pulseOnClick={pulseOnClick}
          onPulseOnClickChange={setPulseOnClick}
          fogIntensity={fogIntensity}
          onFogIntensityChange={setFogIntensity}
          particleShape={particleShape}
          onParticleShapeChange={setParticleShape}
          particleRotation={particleRotation}
          onParticleRotationChange={setParticleRotation}
          currentMode="flow"
          enableFlightControls={enableFlightControls}
          onFlightControlsChange={setEnableFlightControls}
          flightSpeed={flightSpeed}
          onFlightSpeedChange={setFlightSpeed}
          lookSensitivity={lookSensitivity}
          onLookSensitivityChange={setLookSensitivity}
          autoForward={autoForward}
          onAutoForwardChange={handleAutoForwardChange}
          fragmentPushMultiplier={fragmentPushMultiplier}
          onFragmentPushMultiplierChange={setFragmentPushMultiplier}
          particleFriction={particleFriction}
          onParticleFrictionChange={setParticleFriction}
          fragmentRadiusMultiplier={fragmentRadiusMultiplier}
          onFragmentRadiusMultiplierChange={setFragmentRadiusMultiplier}
          onOpenSnapshots={() => setIsSnapshotManagerOpen(true)}
        />

        {/* Snapshot Manager Modal */}
        <SnapshotManager
          isOpen={isSnapshotManagerOpen}
          onClose={() => setIsSnapshotManagerOpen(false)}
          currentSettings={currentSettings}
          currentMode="flow"
          snapshotAPI={tubesSnapshotRef.current}
          onLoadSettings={handleLoadSettings}
          onLoadFullSnapshot={handleLoadFullSnapshot}
        />
      </div>
    </SpaceContext.Provider>
  );
}

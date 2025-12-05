"use client";

import { useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { TubesEffect, type ParticleShape, type TubesSnapshotAPI, type CameraState, type ParticleExportData } from "./TubesEffect";
import { SpeedHUD } from "./SpeedHUD";
import { SettingsPanel } from "@/app/dashboard/quest-hub/components/settings/SettingsPanel";
import { SnapshotManager } from "@/app/dashboard/quest-hub/components/SnapshotManager";
import { useShortcut, useSequenceShortcut } from "@/lib/shortcuts";
import type { SnapshotSettings } from "@/lib/storage/scene-snapshots";

// Separate localStorage keys for each mode
const FLOW_MODE_KEY = "coda-flow-mode-settings";
const FOCUS_MODE_KEY = "coda-focus-mode-settings";

// Old keys to migrate from
const OLD_KEYS = ["quest-hub-settings", "dashboard-visual-settings", "choose-path-flow-settings", "coda-visual-settings"];

interface ModeSettings {
  backgroundColor: string;
  tubeSpeed: number;
  particleSpeed: number;
  tubesOpacity: number;
  particlesOpacity: number;
  colorIntensity: number;
  mouseFollow: boolean;
  enableCollision: boolean;
  collisionRadius: number;
  collisionStrength: number;
  panelOpacity: number;
  customTubeColors: string[] | null;
  idleTimeout: number;
  tubeRadius: number;
  particleCount: number;
  pulseOnClick: boolean;
  fogIntensity: number;
  particleShape: ParticleShape;
  particleRotation: number;
  // Flight controls
  enableFlightControls: boolean;
  flightSpeed: number;
  lookSensitivity: number;
  // Explosion physics
  fragmentPushMultiplier?: number;
  particleFriction?: number;
  fragmentRadiusMultiplier?: number;
}

// Flow Mode defaults: vibrant, interactive, no fog
const DEFAULT_FLOW_SETTINGS: ModeSettings = {
  backgroundColor: "#000000",
  tubeSpeed: 2,
  particleSpeed: 2,
  tubesOpacity: 70,
  particlesOpacity: 70,
  colorIntensity: 60,
  mouseFollow: true,
  enableCollision: false,
  collisionRadius: 15,
  collisionStrength: 1.5,
  panelOpacity: 80,
  customTubeColors: null,
  idleTimeout: 5,
  tubeRadius: 0.15,
  particleCount: 5000,
  pulseOnClick: false,
  fogIntensity: 0, // No fog in Flow Mode
  particleShape: 'square',
  particleRotation: 50, // Default rotation speed (0-100)
  enableFlightControls: false,
  flightSpeed: 0.5,
  lookSensitivity: 0.003,
};

// Focus Mode defaults: dimmer, less distracting, with fog
const DEFAULT_FOCUS_SETTINGS: ModeSettings = {
  backgroundColor: "#000000",
  tubeSpeed: 1,
  particleSpeed: 1,
  tubesOpacity: 40,
  particlesOpacity: 30,
  colorIntensity: 30,
  mouseFollow: false,
  enableCollision: false,
  collisionRadius: 15,
  collisionStrength: 1.5,
  panelOpacity: 85,
  customTubeColors: null,
  idleTimeout: 3,
  tubeRadius: 0.12,
  particleCount: 3000,
  pulseOnClick: false,
  fogIntensity: 50, // Fog enabled in Focus Mode
  particleShape: 'square',
  particleRotation: 30, // Slower rotation in focus mode
  enableFlightControls: false,
  flightSpeed: 0.5,
  lookSensitivity: 0.003,
};

// Default color themes
const DEFAULT_COLORS = ["#a855f7", "#f59e0b", "#22d3ee", "#f472b6"];

// Pages that do NOT get TubesEffect (they have their own backgrounds)
// Dashboard pages use DashboardSpaceProvider for unified space experience
const EXCLUDED_PATHS = ["/login", "/about", "/dashboard"];

interface GlobalVisualShellProps {
  children: ReactNode;
}

export function GlobalVisualShell({ children }: GlobalVisualShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Dual-mode settings: Flow Mode (pure animation) and Focus Mode (content visible)
  const [flowSettings, setFlowSettings] = useState<ModeSettings>(DEFAULT_FLOW_SETTINGS);
  const [focusSettings, setFocusSettings] = useState<ModeSettings>(DEFAULT_FOCUS_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [autoForward, setAutoForward] = useState(false);

  // Cruise speed HUD state
  const [cruiseSpeed, setCruiseSpeed] = useState(1.0);
  const [isCruising, setIsCruising] = useState(false);
  const [speedHUDVisible, setSpeedHUDVisible] = useState(false);
  const speedHUDTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcut state for Shift+Space freeze
  const [previousSpeed, setPreviousSpeed] = useState<number | null>(null);
  const [previousParticleSpeed, setPreviousParticleSpeed] = useState<number | null>(null);
  const [previousMouseFollow, setPreviousMouseFollow] = useState<boolean | null>(null);

  // Snapshot manager state
  const tubesSnapshotRef = useRef<TubesSnapshotAPI | null>(null);
  const [isSnapshotManagerOpen, setIsSnapshotManagerOpen] = useState(false);

  // Customizable shortcuts
  const freezeShortcut = useShortcut('freeze');
  const dismissShortcut = useShortcut('dismiss');

  // Sequence shortcuts for ZEN and FLY modes
  useSequenceShortcut('zenMode', () => {
    setIsZenMode(true);
  });

  useSequenceShortcut('toggleCruise', () => {
    // If flight controls are off, enable them first
    if (!activeSettings.enableFlightControls) {
      setActiveSettings((prev) => ({ ...prev, enableFlightControls: true }));
    }
    // Toggle auto-forward (cruise control)
    handleAutoForwardChange(!autoForward);
  });

  // Check if this path should show TubesEffect
  // Dashboard pages are handled by DashboardSpaceProvider for unified space
  const showTubesEffect = !EXCLUDED_PATHS.some((p) => pathname?.startsWith(p));

  // Check if any content is visible (Focus Mode) - from URL ?show=ideas,other,...
  const visibleContent = searchParams.get("show")?.split(",").filter(Boolean) || [];
  const isFocusMode = visibleContent.length > 0;

  // Get current active settings based on mode
  const activeSettings = isFocusMode ? focusSettings : flowSettings;
  const setActiveSettings = isFocusMode ? setFocusSettings : setFlowSettings;

  // Load and migrate settings from localStorage
  useEffect(() => {
    // First, try to migrate from old keys into Flow Mode
    let migratedSettings: Partial<ModeSettings> = {};

    for (const oldKey of OLD_KEYS) {
      const oldData = localStorage.getItem(oldKey);
      if (oldData) {
        try {
          const parsed = JSON.parse(oldData);
          migratedSettings = { ...migratedSettings, ...parsed };
          localStorage.removeItem(oldKey);
        } catch {
          localStorage.removeItem(oldKey);
        }
      }
    }

    const hasMigratedData = Object.keys(migratedSettings).length > 0;

    // Load Flow Mode settings
    const savedFlow = localStorage.getItem(FLOW_MODE_KEY);
    if (savedFlow) {
      try {
        const parsed = JSON.parse(savedFlow);
        setFlowSettings((prev) => ({ ...prev, ...parsed }));
      } catch {
        if (hasMigratedData) {
          setFlowSettings((prev) => ({ ...prev, ...migratedSettings }));
        }
      }
    } else if (hasMigratedData) {
      setFlowSettings((prev) => ({ ...prev, ...migratedSettings }));
    }

    // Load Focus Mode settings
    const savedFocus = localStorage.getItem(FOCUS_MODE_KEY);
    if (savedFocus) {
      try {
        const parsed = JSON.parse(savedFocus);
        setFocusSettings((prev) => ({ ...prev, ...parsed }));
      } catch {
        // Use defaults
      }
    }

    setSettingsLoaded(true);
  }, []);

  // Save Flow Mode settings when they change
  useEffect(() => {
    if (!settingsLoaded) return;
    localStorage.setItem(FLOW_MODE_KEY, JSON.stringify(flowSettings));
  }, [flowSettings, settingsLoaded]);

  // Save Focus Mode settings when they change
  useEffect(() => {
    if (!settingsLoaded) return;
    localStorage.setItem(FOCUS_MODE_KEY, JSON.stringify(focusSettings));
  }, [focusSettings, settingsLoaded]);

  // Handle keyboard shortcuts using customizable bindings
  useEffect(() => {
    if (!showTubesEffect) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC (dismiss) to exit Zen Mode or Focus Mode
      if (dismissShortcut.matches(e)) {
        if (isZenMode) {
          e.preventDefault();
          setIsZenMode(false);
          return;
        }
        if (isFocusMode) {
          e.preventDefault();
          // Remove all visible content from URL
          const params = new URLSearchParams(searchParams.toString());
          params.delete("show");
          const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
          router.push(newUrl || "/dashboard/ideas", { scroll: false });
          return;
        }
      }

      // Freeze shortcut (default: Shift+Space) to toggle freeze mode
      if (freezeShortcut.matches(e)) {
        e.preventDefault();
        const isFrozen = activeSettings.tubeSpeed === 0 && activeSettings.particleSpeed === 0;

        if (isFrozen && previousSpeed !== null) {
          // Unfreeze: restore both speeds
          setActiveSettings((prev) => ({
            ...prev,
            tubeSpeed: previousSpeed,
            particleSpeed: previousParticleSpeed ?? prev.particleSpeed,
          }));
          setPreviousSpeed(null);
          setPreviousParticleSpeed(null);
          if (previousMouseFollow !== null) {
            setActiveSettings((prev) => ({ ...prev, mouseFollow: previousMouseFollow }));
            setPreviousMouseFollow(null);
          }
        } else if (!isFrozen) {
          // Freeze: save both speeds and set to zero
          setPreviousSpeed(activeSettings.tubeSpeed);
          setPreviousParticleSpeed(activeSettings.particleSpeed);
          setPreviousMouseFollow(activeSettings.mouseFollow);
          setActiveSettings((prev) => ({
            ...prev,
            tubeSpeed: 0,
            particleSpeed: 0,
            mouseFollow: false,
          }));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showTubesEffect, isZenMode, isFocusMode, activeSettings.tubeSpeed, activeSettings.particleSpeed, activeSettings.mouseFollow, previousSpeed, previousParticleSpeed, previousMouseFollow, searchParams, pathname, router, setActiveSettings, dismissShortcut, freezeShortcut]);

  // Update individual settings for the active mode
  const updateSetting = useCallback(<K extends keyof ModeSettings>(
    key: K,
    value: ModeSettings[K]
  ) => {
    if (isFocusMode) {
      setFocusSettings((prev) => ({ ...prev, [key]: value }));
    } else {
      setFlowSettings((prev) => ({ ...prev, [key]: value }));
    }
  }, [isFocusMode]);

  // Handle converge/pulse toggle
  const handleConverge = useCallback(() => {
    setIsPulsing((prev) => !prev);
  }, []);

  // Show speed HUD and reset 30s timeout
  const showSpeedHUD = useCallback(() => {
    setSpeedHUDVisible(true);
    if (speedHUDTimeoutRef.current) {
      clearTimeout(speedHUDTimeoutRef.current);
    }
    speedHUDTimeoutRef.current = setTimeout(() => {
      setSpeedHUDVisible(false);
    }, 30000);
  }, []);

  // Called when W/S adjusts cruise speed
  const handleCruiseSpeedChange = useCallback((speed: number) => {
    setCruiseSpeed(speed);
    showSpeedHUD();
  }, [showSpeedHUD]);

  // Called when cruise toggles on/off - wraps setAutoForward to also trigger HUD
  const handleAutoForwardChange = useCallback((enabled: boolean) => {
    setAutoForward(enabled);
    setIsCruising(enabled);
    if (enabled) {
      setCruiseSpeed(1.0); // Reset to 100% when starting cruise
    }
    showSpeedHUD();
  }, [showSpeedHUD]);

  // Snapshot load handlers
  const handleLoadSettings = useCallback((settings: SnapshotSettings) => {
    if (isFocusMode) {
      setFocusSettings(settings as ModeSettings);
    } else {
      setFlowSettings(settings as ModeSettings);
    }
  }, [isFocusMode]);

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

  // Get effective tube colors
  const tubeColors = activeSettings.customTubeColors || DEFAULT_COLORS;

  // Calculate effective colors based on colorIntensity
  const effectiveColors =
    activeSettings.colorIntensity === 0
      ? ["#ffffff", "#e0e0e0", "#c0c0c0", "#a0a0a0"] // Grayscale
      : tubeColors;

  // If this path shouldn't have TubesEffect, just render children
  // This now includes all /dashboard/* routes (handled by DashboardSpaceProvider)
  if (!showTubesEffect) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundColor: activeSettings.backgroundColor }}
    >
      {/* WebGL Background */}
      <TubesEffect
        ref={tubesSnapshotRef}
        tubeSpeed={activeSettings.tubeSpeed}
        particleSpeed={activeSettings.particleSpeed}
        opacity={activeSettings.tubesOpacity / 100}
        particlesOpacity={activeSettings.particlesOpacity / 100}
        colors={effectiveColors}
        colorIntensity={activeSettings.colorIntensity / 100}
        disableMouseFollow={!activeSettings.mouseFollow}
        pulseToCenter={isPulsing}
        enableCollision={activeSettings.enableCollision}
        collisionRadius={activeSettings.collisionRadius}
        collisionStrength={activeSettings.collisionStrength}
        backgroundColor={activeSettings.backgroundColor}
        idleTimeout={activeSettings.idleTimeout}
        tubeRadius={activeSettings.tubeRadius}
        particleCount={activeSettings.particleCount}
        pulseOnClick={activeSettings.pulseOnClick}
        fogIntensity={activeSettings.fogIntensity}
        particleShape={activeSettings.particleShape}
        particleRotation={activeSettings.particleRotation}
        enableFlightControls={activeSettings.enableFlightControls}
        flightSpeed={activeSettings.flightSpeed}
        lookSensitivity={activeSettings.lookSensitivity}
        isZenMode={isZenMode}
        autoForward={autoForward}
        onAutoForwardChange={handleAutoForwardChange}
        onCruiseSpeedChange={handleCruiseSpeedChange}
        fragmentPushMultiplier={activeSettings.fragmentPushMultiplier ?? 5}
        particleFriction={activeSettings.particleFriction ?? 15}
        fragmentRadiusMultiplier={activeSettings.fragmentRadiusMultiplier ?? 1}
        className="!z-0"
      />

      {/* Speed HUD overlay - shows cruise speed when active */}
      <SpeedHUD
        speed={cruiseSpeed}
        isCruising={isCruising}
        visible={speedHUDVisible}
      />

      {/* Content - fades out in zen mode */}
      <div
        className="transition-opacity duration-500 ease-in-out"
        style={{ opacity: isZenMode ? 0 : 1, pointerEvents: isZenMode ? "none" : "auto" }}
      >
        {children}
      </div>

      {/* Visual Settings Control - new floating panel design */}
      <SettingsPanel
        tubeSpeed={activeSettings.tubeSpeed}
        onTubeSpeedChange={(v) => updateSetting("tubeSpeed", v)}
        particleSpeed={activeSettings.particleSpeed}
        onParticleSpeedChange={(v) => updateSetting("particleSpeed", v)}
        tubesOpacity={activeSettings.tubesOpacity}
        onTubesOpacityChange={(v) => updateSetting("tubesOpacity", v)}
        particlesOpacity={activeSettings.particlesOpacity}
        onParticlesOpacityChange={(v) => updateSetting("particlesOpacity", v)}
        panelOpacity={activeSettings.panelOpacity}
        onPanelOpacityChange={(v) => updateSetting("panelOpacity", v)}
        colorIntensity={activeSettings.colorIntensity}
        onColorIntensityChange={(v) => updateSetting("colorIntensity", v)}
        mouseFollow={activeSettings.mouseFollow}
        onMouseFollowChange={(v) => updateSetting("mouseFollow", v)}
        onPulse={handleConverge}
        isPulsing={isPulsing}
        enableCollision={activeSettings.enableCollision}
        onCollisionChange={(v) => updateSetting("enableCollision", v)}
        collisionRadius={activeSettings.collisionRadius}
        onCollisionRadiusChange={(v) => updateSetting("collisionRadius", v)}
        collisionStrength={activeSettings.collisionStrength}
        onCollisionStrengthChange={(v) => updateSetting("collisionStrength", v)}
        backgroundColor={activeSettings.backgroundColor}
        onBackgroundColorChange={(v) => updateSetting("backgroundColor", v)}
        tubeColors={tubeColors}
        onTubeColorsChange={(colors) => updateSetting("customTubeColors", colors)}
        idleTimeout={activeSettings.idleTimeout}
        onIdleTimeoutChange={(v) => updateSetting("idleTimeout", v)}
        tubeRadius={activeSettings.tubeRadius}
        onTubeRadiusChange={(v) => updateSetting("tubeRadius", v)}
        particleCount={activeSettings.particleCount}
        onParticleCountChange={(v) => updateSetting("particleCount", v)}
        isZenMode={isZenMode}
        onZenModeChange={setIsZenMode}
        pulseOnClick={activeSettings.pulseOnClick}
        onPulseOnClickChange={(v) => updateSetting("pulseOnClick", v)}
        fogIntensity={activeSettings.fogIntensity}
        onFogIntensityChange={(v) => updateSetting("fogIntensity", v)}
        particleShape={activeSettings.particleShape}
        onParticleShapeChange={(v) => updateSetting("particleShape", v)}
        particleRotation={activeSettings.particleRotation}
        onParticleRotationChange={(v) => updateSetting("particleRotation", v)}
        currentMode={isFocusMode ? "focus" : "flow"}
        enableFlightControls={activeSettings.enableFlightControls}
        onFlightControlsChange={(v) => updateSetting("enableFlightControls", v)}
        flightSpeed={activeSettings.flightSpeed}
        onFlightSpeedChange={(v) => updateSetting("flightSpeed", v)}
        lookSensitivity={activeSettings.lookSensitivity}
        onLookSensitivityChange={(v) => updateSetting("lookSensitivity", v)}
        autoForward={autoForward}
        onAutoForwardChange={handleAutoForwardChange}
        fragmentPushMultiplier={activeSettings.fragmentPushMultiplier ?? 5}
        onFragmentPushMultiplierChange={(v) => updateSetting("fragmentPushMultiplier", v)}
        particleFriction={activeSettings.particleFriction ?? 15}
        onParticleFrictionChange={(v) => updateSetting("particleFriction", v)}
        fragmentRadiusMultiplier={activeSettings.fragmentRadiusMultiplier ?? 1}
        onFragmentRadiusMultiplierChange={(v) => updateSetting("fragmentRadiusMultiplier", v)}
        onOpenSnapshots={() => setIsSnapshotManagerOpen(true)}
      />

      {/* Snapshot Manager Modal */}
      <SnapshotManager
        isOpen={isSnapshotManagerOpen}
        onClose={() => setIsSnapshotManagerOpen(false)}
        currentSettings={activeSettings as SnapshotSettings}
        currentMode={isFocusMode ? "focus" : "flow"}
        snapshotAPI={tubesSnapshotRef.current}
        onLoadSettings={handleLoadSettings}
        onLoadFullSnapshot={handleLoadFullSnapshot}
      />
    </div>
  );
}

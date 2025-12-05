"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// Stable defaults - defined outside component to prevent reference changes on re-render
const DEFAULT_COLORS = ["#a855f7", "#f59e0b", "#22d3ee", "#f472b6"];
const DEFAULT_STRAND_COUNT = 4;

// 2D particle shapes (rendered as camera-facing billboards)
export type ParticleShape2D = 'square' | 'circle' | 'glow' | 'star' | 'smoke' | 'diamond' | 'hexagon' | 'heart' | 'lightning';

// 3D particle shapes (rendered as instanced meshes with real depth)
export type ParticleShape3D = 'sphere' | 'cube' | 'octahedron' | 'tetrahedron';

// Combined particle shape type
export type ParticleShape = ParticleShape2D | ParticleShape3D;

// Helper to check if a shape is 3D
export function is3DShape(shape: ParticleShape): shape is ParticleShape3D {
  return ['sphere', 'cube', 'octahedron', 'tetrahedron'].includes(shape);
}

// ============================================
// SNAPSHOT API TYPES - for saving/loading scene state
// ============================================

export interface CameraState {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
  distance: number;
  orbitOffset: { x: number; y: number };
}

export interface ParticleExportData {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  lifetimes: Float32Array;
  maxLifetimes: Float32Array;
  velocities: Float32Array;
  nextIndex: number;
  count: number;
}

export interface TubesSnapshotAPI {
  getCameraState: () => CameraState;
  setCameraState: (state: CameraState) => void;
  getParticleData: () => ParticleExportData | null;
  setParticleData: (data: ParticleExportData) => void;
  captureScreenshot: () => string | null;
}

/**
 * Creates a canvas texture for different particle shapes
 * Returns null for 'square' to use native WebGL squares (best performance)
 */
function createParticleTexture(shape: ParticleShape, size = 64): THREE.CanvasTexture | null {
  if (shape === 'square') return null;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const center = size / 2;
  const radius = size / 2 - 2;

  switch (shape) {
    case 'circle': {
      // Crisp solid circle with hard edge
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'glow': {
      // Glow keeps soft gradient (intentionally soft)
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.3, 'rgba(255,255,255,0.6)');
      gradient.addColorStop(0.6, 'rgba(255,255,255,0.2)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      break;
    }

    case 'star': {
      // Crisp 4-pointed star
      ctx.fillStyle = 'white';
      ctx.beginPath();
      const spikes = 4;
      const outerRadius = radius;
      const innerRadius = radius * 0.3;
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const x = center + Math.cos(angle) * r;
        const y = center + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'smoke': {
      // Smoke keeps soft gradient (intentionally soft/cloudy)
      const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
      gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(0.4, 'rgba(255,255,255,0.5)');
      gradient.addColorStop(0.7, 'rgba(255,255,255,0.2)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      break;
    }

    case 'diamond': {
      // Crisp diamond shape
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.moveTo(center, center - radius);
      ctx.lineTo(center + radius, center);
      ctx.lineTo(center, center + radius);
      ctx.lineTo(center - radius, center);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'hexagon': {
      // Crisp hexagon
      ctx.fillStyle = 'white';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 2;
        const x = center + Math.cos(angle) * radius;
        const y = center + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'heart': {
      // Crisp heart shape
      ctx.fillStyle = 'white';
      ctx.beginPath();
      const heartScale = radius * 0.9;
      ctx.moveTo(center, center + heartScale * 0.7);
      ctx.bezierCurveTo(
        center - heartScale * 1.2, center,
        center - heartScale * 0.6, center - heartScale * 0.8,
        center, center - heartScale * 0.3
      );
      ctx.bezierCurveTo(
        center + heartScale * 0.6, center - heartScale * 0.8,
        center + heartScale * 1.2, center,
        center, center + heartScale * 0.7
      );
      ctx.fill();
      break;
    }

    case 'lightning': {
      // Crisp lightning bolt - filled shape instead of stroke
      ctx.fillStyle = 'white';
      ctx.beginPath();
      // Draw lightning as a filled polygon
      ctx.moveTo(center + radius * 0.4, center - radius);
      ctx.lineTo(center + radius * 0.1, center - radius);
      ctx.lineTo(center - radius * 0.3, center - radius * 0.1);
      ctx.lineTo(center + radius * 0.1, center - radius * 0.1);
      ctx.lineTo(center - radius * 0.4, center + radius);
      ctx.lineTo(center - radius * 0.1, center + radius);
      ctx.lineTo(center + radius * 0.3, center + radius * 0.1);
      ctx.lineTo(center - radius * 0.1, center + radius * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface TubesEffectProps {
  /** Tube rotation speed (0 = frozen, 2 = normal, 10 = fast) */
  tubeSpeed?: number;
  /** Particle movement speed (0 = frozen, 2 = normal, 10 = fast) */
  particleSpeed?: number;
  /** Opacity of tubes only (0 = invisible, 1 = fully visible) */
  opacity?: number;
  /** Opacity of particles only (0 = invisible, 1 = fully visible) */
  particlesOpacity?: number;
  /** Tube colors - pass a stable reference or omit to use defaults */
  colors?: string[];
  /** Number of helix strands */
  strandCount?: number;
  /** CSS class for the container */
  className?: string;
  /** Color intensity (0 = grayscale, 1 = full color) - controls saturation */
  colorIntensity?: number;
  /** Disable mouse following - tubes will drift autonomously */
  disableMouseFollow?: boolean;
  /** Trigger pulse effect - particles rush to center */
  pulseToCenter?: boolean;
  /** Enable collision physics between mouse and particles */
  enableCollision?: boolean;
  /** Collision force field radius (5-30 world units) */
  collisionRadius?: number;
  /** Collision push strength (0.5-3) */
  collisionStrength?: number;
  /** Background color in hex format (e.g., "#0a0a0a") */
  backgroundColor?: string;
  /** Idle timeout in seconds before animation slows down (0 = never idle) */
  idleTimeout?: number;
  /** Tube radius (0.05 = very thin, 0.5 = thick) */
  tubeRadius?: number;
  /** Number of particles (0 = none, 100000 = max) */
  particleCount?: number;
  /** Enable pulse waves on click */
  pulseOnClick?: boolean;
  /** Callback when a pulse is triggered (receives click position) */
  onPulse?: (x: number, y: number) => void;
  /** Fog/glass overlay intensity (0 = clear, 100 = fully fogged) */
  fogIntensity?: number;
  /** Particle shape for visual customization */
  particleShape?: ParticleShape;
  /** 3D particle rotation speed (0 = no rotation, 100 = fast spin) */
  particleRotation?: number;
  /** Enable WASD spaceship camera controls */
  enableFlightControls?: boolean;
  /** Flight movement speed (units per frame) */
  flightSpeed?: number;
  /** Mouse look sensitivity */
  lookSensitivity?: number;
  /** Zen mode - triggers camera intro animation */
  isZenMode?: boolean;
  /** Auto-forward cruise control (externally controlled) */
  autoForward?: boolean;
  /** Callback when auto-forward state changes internally */
  onAutoForwardChange?: (enabled: boolean) => void;
  /** Callback when cruise speed changes (for HUD display) */
  onCruiseSpeedChange?: (speed: number) => void;
  /** Fragment push strength multiplier (1-20, default 5) */
  fragmentPushMultiplier?: number;
  /** Particle friction/damping (0-100%, default 15) - higher = particles slow faster */
  particleFriction?: number;
  /** Fragment blast radius multiplier (0.5-3, default 1) */
  fragmentRadiusMultiplier?: number;
  /** Callback for position updates (throttled for minimap) */
  onPositionChange?: (pos: { x: number; y: number; z: number }) => void;
  /** Callback for quaternion updates */
  onQuaternionChange?: (quat: { x: number; y: number; z: number; w: number }) => void;
  /** Callback for progressive flight state changes */
  onCruiseStateChange?: (state: {
    isActive: boolean;
    velocity: { x: number; y: number; z: number };
    axisLabels: string[];  // ['FWD', 'LEFT', 'UP'] etc.
    speedMultiplier: number;
    targetSpeed: number;  // Target speed from +/- keys
    speedCeiling: number;  // Max allowed speed (1.0 = no ceiling)
    isLocked: boolean;  // Whether cruise speed is locked
  }) => void;
}

/**
 * DNA Helix Tubes Effect with glowing electricity
 * Follows cursor with intertwining helical motion
 */
export const TubesEffect = forwardRef<TubesSnapshotAPI, TubesEffectProps>(function TubesEffect({
  tubeSpeed = 2,
  particleSpeed = 2,
  opacity = 1,
  particlesOpacity = 1,
  colors = DEFAULT_COLORS,
  strandCount = DEFAULT_STRAND_COUNT,
  className = "",
  colorIntensity = 1,
  disableMouseFollow = false,
  pulseToCenter = false,
  enableCollision = false,
  collisionRadius = 15,
  collisionStrength = 1.5,
  backgroundColor = "#000000",
  idleTimeout = 5,
  tubeRadius = 0.15,
  particleCount = 5000,
  pulseOnClick = false,
  fogIntensity = 0,
  particleShape = 'square',
  particleRotation = 50,
  enableFlightControls = false,
  flightSpeed = 0.5,
  lookSensitivity = 0.003,
  isZenMode = false,
  autoForward = false,
  onAutoForwardChange,
  onCruiseSpeedChange,
  fragmentPushMultiplier = 5,
  particleFriction = 15,
  fragmentRadiusMultiplier = 1,
  onPositionChange,
  onQuaternionChange,
  onCruiseStateChange,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tubeSpeedRef = useRef(tubeSpeed);
  const targetTubeSpeedRef = useRef(tubeSpeed);
  const particleSpeedRef = useRef(particleSpeed);
  const targetParticleSpeedRef = useRef(particleSpeed);
  const opacityRef = useRef(opacity);
  const targetOpacityRef = useRef(opacity);
  const particlesOpacityRef = useRef(particlesOpacity);
  const targetParticlesOpacityRef = useRef(particlesOpacity);
  const colorIntensityRef = useRef(colorIntensity);
  const targetColorIntensityRef = useRef(colorIntensity);
  const disableMouseFollowRef = useRef(disableMouseFollow);
  const pulseToCenterRef = useRef(pulseToCenter);
  const enableCollisionRef = useRef(enableCollision);
  const collisionRadiusRef = useRef(collisionRadius);
  const collisionStrengthRef = useRef(collisionStrength);
  const backgroundColorRef = useRef(backgroundColor);
  const colorsRef = useRef(colors);
  const idleTimeoutRef = useRef(idleTimeout);
  const tubeRadiusRef = useRef(tubeRadius);
  const particleCountRef = useRef(particleCount);
  const pulseOnClickRef = useRef(pulseOnClick);
  const particleShapeRef = useRef<ParticleShape>(particleShape);
  const particleRotationRef = useRef(particleRotation);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const fogIntensityRef = useRef(fogIntensity);

  // Explosion physics refs
  const fragmentPushMultiplierRef = useRef(fragmentPushMultiplier);
  const particleFrictionRef = useRef(particleFriction);
  const fragmentRadiusMultiplierRef = useRef(fragmentRadiusMultiplier);

  // Callback refs to avoid stale closures in event handlers
  const onCruiseStateChangeRef = useRef(onCruiseStateChange);
  onCruiseStateChangeRef.current = onCruiseStateChange;

  // Camera flight control state
  const enableFlightControlsRef = useRef(enableFlightControls);
  const flightSpeedRef = useRef(flightSpeed);
  const lookSensitivityRef = useRef(lookSensitivity);
  const cameraPositionRef = useRef(new THREE.Vector3(0, 0, 50));
  const cameraQuaternionRef = useRef(new THREE.Quaternion()); // Quaternion for gimbal-lock-free rotation
  const flightKeysRef = useRef<Set<string>>(new Set());
  const flightShiftRef = useRef(false); // Track if shift is held for roll mode
  const isMiddleMouseRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const autoForwardRef = useRef(false); // Auto-forward cruise control state
  const autoForwardSpeedRef = useRef(0); // Current cruise velocity (0 to 1)
  const autoForwardTargetRef = useRef(0); // Target velocity (0 = stopping, 1 = cruising)
  const AUTO_FORWARD_ACCEL = 0.008; // Acceleration rate per frame
  const AUTO_FORWARD_DECEL = 0.012; // Deceleration rate per frame (slightly faster to stop)
  const lastAutoPulseRef = useRef(0); // Track last auto-pulse time
  const travelDirectionRef = useRef(new THREE.Quaternion()); // Locked travel direction during auto-forward

  const isLeftMouseRef = useRef(false); // Track left-click for free look in auto-forward mode
  const isRightMouseRef = useRef(false); // Track right-click for free look (doesn't change travel direction)

  // Cruise axis state for UI display
  interface CruiseAxisState {
    forward: number;  // -1 to 1 (negative = backward)
    right: number;    // -1 to 1 (negative = left)
    up: number;       // -1 to 1 (negative = down)
  }

  // ============================================
  // PROGRESSIVE ACCELERATION FLIGHT SYSTEM
  // Hold keys to accelerate, release to coast, C to lock
  // ============================================
  const flightStateRef = useRef({
    // Current speed (0.0 to 1.0)
    speed: 0,

    // Target speed from +/- keys (0.0 to 1.0)
    targetSpeed: 0,

    // Speed ceiling - maximum allowed speed (1.0 = no ceiling)
    // Set by "-" key, unlocked by "SHIFT+-"
    speedCeiling: 1.0,

    // Direction vector (normalized, camera-relative)
    direction: new THREE.Vector3(0, 0, 0),

    // World-space direction (after applying camera orientation)
    worldDirection: new THREE.Vector3(0, 0, 0),

    // How long movement keys have been held (seconds)
    holdDuration: 0,

    // Whether cruise is locked (hands-free)
    isLocked: false,

    // Axis components for UI display
    axisComponents: { forward: 0, right: 0, up: 0 } as CruiseAxisState,
  });

  // Acceleration constants
  const ACCEL_BASE = 0.008;        // Base acceleration per frame
  const ACCEL_PROGRESSIVE = 0.5;   // How much holdDuration multiplies accel
  const DECEL_RATE = 0.015;        // Deceleration per frame when coasting
  const MAX_SPEED = 1.0;           // Maximum speed (100%)

  // Helper: Build velocity vector from currently held movement keys
  const buildVelocityFromKeys = () => {
    const keys = flightKeysRef.current;
    const axes: CruiseAxisState = { forward: 0, right: 0, up: 0 };
    const labels: string[] = [];

    // Forward/Backward axis
    if (keys.has('w')) { axes.forward = 1; labels.push('FWD'); }
    else if (keys.has('s')) { axes.forward = -1; labels.push('BWD'); }

    // Left/Right axis
    if (keys.has('d')) { axes.right = 1; labels.push('RIGHT'); }
    else if (keys.has('a')) { axes.right = -1; labels.push('LEFT'); }

    // Up/Down axis
    if (keys.has('e')) { axes.up = 1; labels.push('UP'); }
    else if (keys.has('q')) { axes.up = -1; labels.push('DOWN'); }

    // Build local velocity vector (camera-relative)
    const localVelocity = new THREE.Vector3(
      axes.right,       // X: right
      axes.up,          // Y: up
      -axes.forward     // Z: negative forward (THREE.js convention)
    );

    // Normalize if non-zero
    if (localVelocity.length() > 0) {
      localVelocity.normalize();
    }

    return { velocity: localVelocity, axes, labels };
  };

  // Helper: Get axis labels from axis components
  const getAxisLabels = (axes: CruiseAxisState): string[] => {
    const labels: string[] = [];
    if (axes.forward > 0) labels.push('FWD');
    else if (axes.forward < 0) labels.push('BWD');
    if (axes.right > 0) labels.push('RIGHT');
    else if (axes.right < 0) labels.push('LEFT');
    if (axes.up > 0) labels.push('UP');
    else if (axes.up < 0) labels.push('DOWN');
    return labels;
  };

  // Helper: Fire flight state callback immediately (not throttled)
  // Uses ref to avoid stale closure issues in event handlers
  const fireFlightStateCallback = () => {
    const flight = flightStateRef.current;
    const state = {
      isActive: flight.speed > 0.01,
      velocity: {
        x: flight.worldDirection.x,
        y: flight.worldDirection.y,
        z: flight.worldDirection.z,
      },
      axisLabels: getAxisLabels(flight.axisComponents),
      speedMultiplier: flight.speed,  // 0-1 (0-100%)
      targetSpeed: flight.targetSpeed,  // Target from +/- keys
      speedCeiling: flight.speedCeiling,  // Max allowed speed (1.0 = no ceiling)
      isLocked: flight.isLocked,
    };
    onCruiseStateChangeRef.current?.(state);
  };

  // Helper: Reset all mouse button states (for ESC, blur, mouseleave - fixes "stuck" MMB)
  const resetMouseStates = () => {
    isMiddleMouseRef.current = false;
    isRightMouseRef.current = false;
    isLeftMouseRef.current = false;
  };

  // Throttle minimap callbacks (every 2 frames)
  const lastMinimapUpdateRef = useRef(0);
  const MINIMAP_UPDATE_INTERVAL = 2; // frames

  const isOrbRepositionKeyRef = useRef(false); // Track "/" key for orb repositioning in 3rd person

  // 3rd person camera state
  const cameraDistanceRef = useRef(0); // 0 = first person, >0 = 3rd person
  const targetCameraDistanceRef = useRef(0); // For smooth interpolation
  const orbitOffsetRef = useRef({ x: 0, y: 0 }); // Screen-space offset for where orb appears
  const playerOrbRef = useRef<THREE.Mesh | null>(null);
  const orbGlowRef = useRef<THREE.PointLight | null>(null);

  // Targeting system state
  type AimState = 'idle' | 'aiming';
  const aimStateRef = useRef<AimState>('idle');
  const aimConeRef = useRef<THREE.Mesh | null>(null); // TRON neon cone with ShaderMaterial
  const aimConeRingRef = useRef<THREE.Mesh | null>(null); // Base ring halo
  const aimDirectionRef = useRef(new THREE.Vector3(0, 0, -1)); // Current aim direction

  // Multi-probe projectile system
  interface Probe {
    id: string;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    direction: THREE.Vector3;
    speed: number;
    pushRadius: number;
    pushStrength: number;
    isActive: boolean;
    isEnabled: boolean; // green (true) vs blue (false) for explosion grouping
    isRecalling: boolean; // true when probe is returning to orb
    mesh: THREE.Mesh | null;
  }

  // Explosion fragments
  interface Fragment {
    id: string;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    size: number; // 0.1 to 1.0 scale
    pushStrength: number; // 5x probe strength
    pushRadius: number;
    lifespan: number; // 2-4 seconds
    timeAlive: number;
    mesh: THREE.Mesh | null;
  }

  // Probe/fragment constants
  const MAX_PROBES = 100;
  const PROBE_SPEED = 50; // Units per second
  const PROBE_RECALL_SPEED = 80; // Faster return speed
  const PROBE_DOCK_DISTANCE = 2; // Distance at which probe docks with orb
  const FRAGMENT_COUNT_MIN = 12; // Reduced for performance
  const FRAGMENT_COUNT_MAX = 20; // Reduced for performance
  const FRAGMENT_LIFESPAN_MIN = 2;
  const FRAGMENT_LIFESPAN_MAX = 4;
  const MAX_FRAGMENTS = 500; // Cap total fragments for performance
  const WORLD_BOUNDS = 10000; // Distance from center - probes respawn when reaching this (matches flight range)

  const probesRef = useRef<Probe[]>([]);
  const fragmentsRef = useRef<Fragment[]>([]);
  let probeIdCounter = 0; // For generating unique probe IDs

  // Probe management UI state
  const [showProbePanel, setShowProbePanel] = useState(false);
  const [probeListVersion, setProbeListVersion] = useState(0); // Increment to trigger re-render
  const forceProbeListUpdate = () => setProbeListVersion(v => v + 1);

  // Zen mode camera intro animation
  const zenIntroPhaseRef = useRef<'idle' | 'zoom_out' | 'zoom_in' | 'complete'>('idle');
  const zenIntroProgressRef = useRef(0); // 0-1 progress through current phase
  const wasZenModeRef = useRef(false); // Track previous zen mode state
  const ZEN_INTRO_ZOOM_OUT_DISTANCE = 80; // How far to zoom out
  const ZEN_FINAL_DISTANCE = 25; // Final comfortable 3rd person distance
  const ZEN_INTRO_SPEED = 0.015; // Animation speed

  // Exhaust particle system - persistent particles left behind in space
  const exhaustParticlesRef = useRef<THREE.Points | null>(null);
  const exhaustDataRef = useRef<{
    positions: Float32Array;
    colors: Float32Array;
    sizes: Float32Array;
    lifetimes: Float32Array;  // Current age of each particle
    maxLifetimes: Float32Array; // Max lifespan of each particle
    velocities: Float32Array; // Slight drift velocity
    nextIndex: number; // Ring buffer index for spawning
  } | null>(null);
  const lastExhaustPosRef = useRef(new THREE.Vector3()); // For spawn spacing
  const EXHAUST_PARTICLE_COUNT = 300; // Total particle pool
  const EXHAUST_SPAWN_DISTANCE = 0.3; // Distance traveled before spawning new particle
  const EXHAUST_LIFESPAN_MIN = 3; // Minimum lifespan in seconds
  const EXHAUST_LIFESPAN_MAX = 6; // Maximum lifespan in seconds

  // 3rd person zoom constants
  const MAX_ZOOM_DISTANCE = 10000; // Match flight boundary
  const ZOOM_SPEED_NEAR = 8; // Scroll sensitivity when close
  const ZOOM_SPEED_FAR = 0.5; // Scroll sensitivity when very far (slower)
  const ZOOM_LERP_SPEED = 0.08; // Smoothing factor

  // Pulse wave state - array of active pulses
  const pulsesRef = useRef<Array<{
    x: number;        // World X position of pulse origin
    y: number;        // World Y position of pulse origin
    z?: number;       // World Z position (for 3D spherical pulses in flight mode)
    radius: number;   // Current radius of expanding wave
    strength: number; // Current strength (fades over time)
    startTime: number;
  }>>([]);
  const strandsRef = useRef<HelixStrand[]>([]);
  const electricitySystemRef = useRef<ElectricitySystem | null>(null);
  const electricitySystem3DRef = useRef<ElectricitySystem3D | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  // Raw mouse position - always tracked for collision, separate from tube-following target
  const rawMouseRef = useRef({ x: 0, y: 0 });
  const lastActivityRef = useRef(Date.now());
  const isIdleRef = useRef(false);

  // Expose snapshot API via ref
  useImperativeHandle(ref, () => ({
    getCameraState: () => ({
      position: {
        x: cameraPositionRef.current.x,
        y: cameraPositionRef.current.y,
        z: cameraPositionRef.current.z,
      },
      quaternion: {
        x: cameraQuaternionRef.current.x,
        y: cameraQuaternionRef.current.y,
        z: cameraQuaternionRef.current.z,
        w: cameraQuaternionRef.current.w,
      },
      distance: cameraDistanceRef.current,
      orbitOffset: { ...orbitOffsetRef.current },
    }),
    setCameraState: (state: CameraState) => {
      cameraPositionRef.current.set(state.position.x, state.position.y, state.position.z);
      cameraQuaternionRef.current.set(
        state.quaternion.x,
        state.quaternion.y,
        state.quaternion.z,
        state.quaternion.w
      );
      cameraDistanceRef.current = state.distance;
      targetCameraDistanceRef.current = state.distance;
      orbitOffsetRef.current = { ...state.orbitOffset };
    },
    getParticleData: () => {
      if (!exhaustDataRef.current) return null;
      return {
        positions: new Float32Array(exhaustDataRef.current.positions),
        colors: new Float32Array(exhaustDataRef.current.colors),
        sizes: new Float32Array(exhaustDataRef.current.sizes),
        lifetimes: new Float32Array(exhaustDataRef.current.lifetimes),
        maxLifetimes: new Float32Array(exhaustDataRef.current.maxLifetimes),
        velocities: new Float32Array(exhaustDataRef.current.velocities),
        nextIndex: exhaustDataRef.current.nextIndex,
        count: EXHAUST_PARTICLE_COUNT,
      };
    },
    setParticleData: (data: ParticleExportData) => {
      if (!exhaustDataRef.current) return;
      exhaustDataRef.current.positions.set(data.positions);
      exhaustDataRef.current.colors.set(data.colors);
      exhaustDataRef.current.sizes.set(data.sizes);
      exhaustDataRef.current.lifetimes.set(data.lifetimes);
      exhaustDataRef.current.maxLifetimes.set(data.maxLifetimes);
      exhaustDataRef.current.velocities.set(data.velocities);
      exhaustDataRef.current.nextIndex = data.nextIndex;
      // Mark GPU buffers for update
      if (exhaustParticlesRef.current?.geometry) {
        const geo = exhaustParticlesRef.current.geometry;
        if (geo.attributes.position) geo.attributes.position.needsUpdate = true;
        if (geo.attributes.color) geo.attributes.color.needsUpdate = true;
        if (geo.attributes.size) geo.attributes.size.needsUpdate = true;
      }
    },
    captureScreenshot: () => {
      return rendererRef.current?.domElement.toDataURL("image/jpeg", 0.6) ?? null;
    },
  }), []);

  // Update target speeds (actual interpolation happens in animation loop)
  useEffect(() => {
    targetTubeSpeedRef.current = tubeSpeed;
  }, [tubeSpeed]);

  useEffect(() => {
    targetParticleSpeedRef.current = particleSpeed;
  }, [particleSpeed]);

  // Update target opacity (actual interpolation happens in animation loop)
  useEffect(() => {
    targetOpacityRef.current = opacity;
  }, [opacity]);

  // Update target particles opacity
  useEffect(() => {
    targetParticlesOpacityRef.current = particlesOpacity;
  }, [particlesOpacity]);

  // Update target color intensity (actual interpolation happens in animation loop)
  useEffect(() => {
    targetColorIntensityRef.current = colorIntensity;
  }, [colorIntensity]);

  // Update mouse follow setting
  useEffect(() => {
    disableMouseFollowRef.current = disableMouseFollow;
  }, [disableMouseFollow]);

  // Update pulse setting
  useEffect(() => {
    pulseToCenterRef.current = pulseToCenter;
  }, [pulseToCenter]);

  // Update collision setting
  useEffect(() => {
    enableCollisionRef.current = enableCollision;
  }, [enableCollision]);

  // Update collision radius
  useEffect(() => {
    collisionRadiusRef.current = collisionRadius;
  }, [collisionRadius]);

  // Update collision strength
  useEffect(() => {
    collisionStrengthRef.current = collisionStrength;
  }, [collisionStrength]);

  // Update background color (and fog color to match)
  useEffect(() => {
    backgroundColorRef.current = backgroundColor;
    if (rendererRef.current) {
      const color = new THREE.Color(backgroundColor);
      rendererRef.current.setClearColor(color, 1);
    }
    // Update fog color to match background
    if (sceneRef.current?.fog && sceneRef.current.fog instanceof THREE.FogExp2) {
      sceneRef.current.fog.color.set(backgroundColor);
    }
  }, [backgroundColor]);

  // Update fog intensity - controls Three.js exponential fog density
  useEffect(() => {
    fogIntensityRef.current = fogIntensity;
    if (sceneRef.current?.fog && sceneRef.current.fog instanceof THREE.FogExp2) {
      // Map 0-100 intensity to fog density (0 = no fog, 100 = very thick)
      // Using exponential fog density: higher values = thicker fog
      sceneRef.current.fog.density = fogIntensity > 0 ? fogIntensity * 0.0003 : 0;
    }
  }, [fogIntensity]);

  // Update explosion physics refs
  useEffect(() => {
    fragmentPushMultiplierRef.current = fragmentPushMultiplier;
  }, [fragmentPushMultiplier]);

  useEffect(() => {
    particleFrictionRef.current = particleFriction;
  }, [particleFriction]);

  useEffect(() => {
    fragmentRadiusMultiplierRef.current = fragmentRadiusMultiplier;
  }, [fragmentRadiusMultiplier]);

  // Update idle timeout
  useEffect(() => {
    idleTimeoutRef.current = idleTimeout;
  }, [idleTimeout]);

  // Update tube radius
  useEffect(() => {
    tubeRadiusRef.current = tubeRadius;
    // Update existing strands with new radius
    strandsRef.current.forEach((strand) => {
      strand.setRadius(tubeRadius);
    });
  }, [tubeRadius]);

  // Update particle count dynamically without recreating the system
  useEffect(() => {
    particleCountRef.current = particleCount;
    // Update the electricity system's active count - particles beyond this will naturally die off
    if (electricitySystemRef.current) {
      electricitySystemRef.current.setActiveParticleCount(particleCount);
    }
    if (electricitySystem3DRef.current) {
      electricitySystem3DRef.current.setActiveParticleCount(particleCount);
    }
  }, [particleCount]);

  // Update pulse on click ref
  useEffect(() => {
    pulseOnClickRef.current = pulseOnClick;
  }, [pulseOnClick]);

  // Update particle shape dynamically - handles switching between 2D and 3D systems
  useEffect(() => {
    const oldShape = particleShapeRef.current;
    particleShapeRef.current = particleShape;

    const wasUsing3D = is3DShape(oldShape);
    const nowUsing3D = is3DShape(particleShape);

    // If staying within 2D shapes, just update the texture
    if (!wasUsing3D && !nowUsing3D && electricitySystemRef.current) {
      electricitySystemRef.current.setShape(particleShape);
      return;
    }

    // If staying within 3D shapes, just update the geometry
    if (wasUsing3D && nowUsing3D && electricitySystem3DRef.current) {
      electricitySystem3DRef.current.setShape(particleShape as ParticleShape3D);
      return;
    }

    // Note: Full 2D<->3D transitions will be handled by the main effect
    // when scene is available, since we need access to the scene to create/dispose systems
  }, [particleShape]);

  // Update particle rotation speed
  useEffect(() => {
    particleRotationRef.current = particleRotation;
  }, [particleRotation]);

  // Update flight control settings
  useEffect(() => {
    enableFlightControlsRef.current = enableFlightControls;
  }, [enableFlightControls]);

  useEffect(() => {
    flightSpeedRef.current = flightSpeed;
  }, [flightSpeed]);

  useEffect(() => {
    lookSensitivityRef.current = lookSensitivity;
  }, [lookSensitivity]);

  // Sync autoForward prop - triggers smooth acceleration/deceleration
  useEffect(() => {
    if (autoForward && !autoForwardRef.current) {
      // Starting cruise - lock travel direction and set target to accelerate
      travelDirectionRef.current.copy(cameraQuaternionRef.current);
      autoForwardRef.current = true;
      autoForwardTargetRef.current = 1; // Target full speed
      onCruiseSpeedChange?.(1.0); // Notify HUD
    } else if (!autoForward && autoForwardRef.current) {
      // Stopping cruise - set target to decelerate
      autoForwardTargetRef.current = 0; // Target stop
      // Note: autoForwardRef.current will be set to false when speed reaches 0
    }
  }, [autoForward, onCruiseSpeedChange]);

  // Update colors seamlessly without restarting animation
  useEffect(() => {
    colorsRef.current = colors;

    // Update existing strands with new colors
    strandsRef.current.forEach((strand, i) => {
      const newColor = new THREE.Color(colors[i % colors.length]);
      strand.setColor(newColor);
    });

    // Update electricity system with new color palette
    if (electricitySystemRef.current) {
      electricitySystemRef.current.setColorPalette(colors);
    }
    if (electricitySystem3DRef.current) {
      electricitySystem3DRef.current.setColorPalette(colors);
    }
  }, [colors]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Add exponential fog for atmospheric depth effect
    // Density controls how quickly objects fade into fog color
    const bgColor = new THREE.Color(backgroundColorRef.current);
    const initialFogDensity = fogIntensityRef.current > 0 ? fogIntensityRef.current * 0.0003 : 0;
    scene.fog = new THREE.FogExp2(bgColor.getHex(), initialFogDensity);

    // Extended far plane (50000) for flight mode to see tubes from very far away
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 50000);
    camera.position.z = 50;

    // Add subtle ambient light for 3D shading without overpowering the glow
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false, // No alpha needed since we have solid background
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Set initial background color (bgColor already created for fog)
    renderer.setClearColor(bgColor, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.6; // Reduced from 1.2
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Post-processing for bloom/glow - toned down significantly
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.4,  // strength - reduced further to prevent edge artifacts
      0.2,  // radius - reduced to limit glow spread
      0.6   // threshold - raised higher (only brightest parts glow)
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    // Create DNA helix strands - use colorsRef for initial colors
    const strands: HelixStrand[] = [];
    for (let i = 0; i < strandCount; i++) {
      const color = new THREE.Color(colorsRef.current[i % colorsRef.current.length]);
      const strand = new HelixStrand(scene, color, i, strandCount, tubeRadiusRef.current);
      strands.push(strand);
    }
    strandsRef.current = strands;

    // Create electricity particles - 2D or 3D based on current shape
    let electricitySystem: ElectricitySystem | null = null;
    let electricitySystem3D: ElectricitySystem3D | null = null;

    if (is3DShape(particleShapeRef.current)) {
      electricitySystem3D = new ElectricitySystem3D(scene, colorsRef.current, particleCountRef.current, particleShapeRef.current as ParticleShape3D);
      electricitySystem3DRef.current = electricitySystem3D;
    } else {
      electricitySystem = new ElectricitySystem(scene, colorsRef.current, particleCountRef.current, particleShapeRef.current);
      electricitySystemRef.current = electricitySystem;
    }

    // Track current mode for shape switching during animation
    let currentlyUsing3D = is3DShape(particleShapeRef.current);

    // Create player orb for 3rd person view
    const orbGeometry = new THREE.SphereGeometry(0.8, 32, 32);
    const orbMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffff, // Cyan glow
      emissive: 0x00ffff,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0,
    });
    const playerOrb = new THREE.Mesh(orbGeometry, orbMaterial);
    playerOrb.frustumCulled = false;
    playerOrb.visible = false; // Start invisible (first person)
    scene.add(playerOrb);
    playerOrbRef.current = playerOrb;

    // Add point light for orb glow effect
    const orbGlow = new THREE.PointLight(0x00ffff, 0, 15);
    scene.add(orbGlow);
    orbGlowRef.current = orbGlow;

    // === TRON NEON AIM CONE (polished glassy targeting cone) ===
    const PROBE_PUSH_RADIUS = 8; // Must match probe.pushRadius
    const AIM_CONE_LENGTH = 150; // How far the cone extends

    // TRON Cone Vertex Shader
    const tronConeVertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying float vHeightRatio;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);

        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;

        // Height ratio: 0 at tip, 1 at base (cone points along -Z after rotation)
        vHeightRatio = clamp((-position.z) / ${AIM_CONE_LENGTH.toFixed(1)}, 0.0, 1.0);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // TRON Cone Fragment Shader - Fresnel glow, gradient opacity, subtle scanlines
    const tronConeFragmentShader = `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uFresnelPower;
      uniform float uFresnelOpacity;
      uniform float uScanlineSpeed;
      uniform float uScanlineOpacity;
      uniform float uPulseSpeed;
      uniform float uBaseOpacity;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying float vHeightRatio;

      void main() {
        // === 1. FRESNEL EDGE GLOW (TRON signature look) ===
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = 1.0 - abs(dot(viewDirection, vNormal));
        fresnel = pow(fresnel, uFresnelPower);

        // === 2. GRADIENT OPACITY (transparent tip -> visible base) ===
        float gradientAlpha = mix(0.02, 1.0, pow(vHeightRatio, 0.6));

        // === 3. SUBTLE ANIMATED SCAN LINES (rings traveling down cone) ===
        float scanline1 = sin(vHeightRatio * 30.0 - uTime * uScanlineSpeed);
        float scanline2 = sin(vHeightRatio * 15.0 - uTime * uScanlineSpeed * 0.7);
        float scanlines = max(scanline1, scanline2);
        scanlines = smoothstep(0.7, 1.0, scanlines); // Sharpen into rings

        // === 4. BREATHING PULSE ===
        float pulse = sin(uTime * uPulseSpeed) * 0.12 + 0.88;

        // === 5. COMBINE ALL EFFECTS ===
        float fresnelGlow = fresnel * uFresnelOpacity;
        float scanlineContrib = scanlines * uScanlineOpacity * vHeightRatio;

        float alpha = uBaseOpacity * gradientAlpha * pulse;
        alpha += fresnelGlow;
        alpha += scanlineContrib;
        alpha = clamp(alpha, 0.0, 0.65);

        // Brighten color at edges for bloom pickup
        vec3 finalColor = uColor * (1.0 + fresnel * 0.5);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    // Create cone geometry with higher segment count for smoother appearance
    const aimConeGeometry = new THREE.ConeGeometry(PROBE_PUSH_RADIUS, AIM_CONE_LENGTH, 32, 1, true);
    aimConeGeometry.rotateX(Math.PI / 2);
    aimConeGeometry.translate(0, 0, -AIM_CONE_LENGTH / 2);

    const aimConeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x00ffff) },
        uFresnelPower: { value: 2.5 },
        uFresnelOpacity: { value: 0.5 },
        uScanlineSpeed: { value: 2.0 },
        uScanlineOpacity: { value: 0.08 },
        uPulseSpeed: { value: 1.5 },
        uBaseOpacity: { value: 0.08 },
      },
      vertexShader: tronConeVertexShader,
      fragmentShader: tronConeFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const aimCone = new THREE.Mesh(aimConeGeometry, aimConeMaterial);
    aimCone.visible = false;
    aimCone.frustumCulled = false;
    aimCone.renderOrder = 998;
    scene.add(aimCone);
    aimConeRef.current = aimCone;

    // === BASE RING HALO (rotating highlight at cone base) ===
    const ringVertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const ringFragmentShader = `
      uniform float uTime;
      uniform vec3 uColor;

      varying vec2 vUv;

      void main() {
        // Rotating highlight effect
        float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
        float highlight = sin(angle * 3.0 + uTime * 3.0) * 0.3 + 0.7;

        // Radial fade (brighter at center of ring thickness)
        float dist = length(vUv - vec2(0.5));
        float ringFade = 1.0 - abs(dist - 0.35) * 4.0;
        ringFade = clamp(ringFade, 0.0, 1.0);

        float alpha = highlight * ringFade * 0.4;
        gl_FragColor = vec4(uColor * 1.3, alpha);
      }
    `;

    const ringGeometry = new THREE.RingGeometry(PROBE_PUSH_RADIUS * 0.85, PROBE_PUSH_RADIUS * 1.15, 32);
    const ringMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x00ffff) },
      },
      vertexShader: ringVertexShader,
      fragmentShader: ringFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const aimConeRing = new THREE.Mesh(ringGeometry, ringMaterial);
    aimConeRing.visible = false;
    aimConeRing.frustumCulled = false;
    aimConeRing.renderOrder = 999;
    scene.add(aimConeRing);
    aimConeRingRef.current = aimConeRing;

    // === EXHAUST PARTICLE SYSTEM (persistent particles left in space) ===
    const exhaustGeometry = new THREE.BufferGeometry();
    const exhaustPositions = new Float32Array(EXHAUST_PARTICLE_COUNT * 3);
    const exhaustColors = new Float32Array(EXHAUST_PARTICLE_COUNT * 4);
    const exhaustSizes = new Float32Array(EXHAUST_PARTICLE_COUNT);
    const exhaustLifetimes = new Float32Array(EXHAUST_PARTICLE_COUNT);
    const exhaustMaxLifetimes = new Float32Array(EXHAUST_PARTICLE_COUNT);
    const exhaustVelocities = new Float32Array(EXHAUST_PARTICLE_COUNT * 3);

    // Initialize all particles as "dead" (lifetime >= maxLifetime)
    for (let i = 0; i < EXHAUST_PARTICLE_COUNT; i++) {
      exhaustPositions[i * 3] = 0;
      exhaustPositions[i * 3 + 1] = 0;
      exhaustPositions[i * 3 + 2] = 0;
      // Cyan/white color
      exhaustColors[i * 4] = 0.7;     // R
      exhaustColors[i * 4 + 1] = 1;   // G
      exhaustColors[i * 4 + 2] = 1;   // B
      exhaustColors[i * 4 + 3] = 0;   // Alpha (starts invisible)
      exhaustSizes[i] = 0.4;
      exhaustLifetimes[i] = 999; // Dead
      exhaustMaxLifetimes[i] = 1;
      exhaustVelocities[i * 3] = 0;
      exhaustVelocities[i * 3 + 1] = 0;
      exhaustVelocities[i * 3 + 2] = 0;
    }

    exhaustGeometry.setAttribute('position', new THREE.BufferAttribute(exhaustPositions, 3));
    exhaustGeometry.setAttribute('color', new THREE.BufferAttribute(exhaustColors, 4));
    exhaustGeometry.setAttribute('size', new THREE.BufferAttribute(exhaustSizes, 1));

    const exhaustMaterial = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const exhaustParticles = new THREE.Points(exhaustGeometry, exhaustMaterial);
    exhaustParticles.frustumCulled = false;
    exhaustParticles.visible = false;
    scene.add(exhaustParticles);
    exhaustParticlesRef.current = exhaustParticles;

    // Store data refs for animation loop
    exhaustDataRef.current = {
      positions: exhaustPositions,
      colors: exhaustColors,
      sizes: exhaustSizes,
      lifetimes: exhaustLifetimes,
      maxLifetimes: exhaustMaxLifetimes,
      velocities: exhaustVelocities,
      nextIndex: 0,
    };

    // Also track clicks and key presses as activity
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      isIdleRef.current = false;
    };
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("keydown", handleActivity);

    // Handle click/hold for pulse waves
    let pulseInterval: ReturnType<typeof setInterval> | null = null;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const createPulse = (clientX: number, clientY: number) => {
      if (enableFlightControlsRef.current) {
        // Flight mode: 3D spherical pulse from player's current position
        pulsesRef.current.push({
          x: cameraPositionRef.current.x,
          y: cameraPositionRef.current.y,
          z: cameraPositionRef.current.z,
          radius: 0,
          strength: 1.0,
          startTime: Date.now(),
        });
      } else {
        // Normal mode: 2D radial pulse from screen coordinates
        const worldX = ((clientX / window.innerWidth) * 2 - 1) * 30; // Scale to world units
        const worldY = (-(clientY / window.innerHeight) * 2 + 1) * 20;

        pulsesRef.current.push({
          x: worldX,
          y: worldY,
          radius: 0,
          strength: 1.0,
          startTime: Date.now(),
        });
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!pulseOnClickRef.current) return;
      // Only trigger pulse on left click (button 0), not middle (1) or right (2)
      if (e.button !== 0) return;

      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      // Create initial pulse
      createPulse(e.clientX, e.clientY);

      // Start continuous pulsing while held
      pulseInterval = setInterval(() => {
        createPulse(lastMouseX, lastMouseY);
      }, 150); // Pulse every 150ms while held
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Always track raw mouse position for collision
      rawMouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      rawMouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;

      // Track for continuous pulsing
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      // Only update tube-following target if mouse follow is enabled
      if (!disableMouseFollowRef.current) {
        mouseRef.current.targetX = rawMouseRef.current.x;
        mouseRef.current.targetY = rawMouseRef.current.y;
        lastActivityRef.current = Date.now();
        isIdleRef.current = false;
      }
    };

    const handleMouseUp = () => {
      if (pulseInterval) {
        clearInterval(pulseInterval);
        pulseInterval = null;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("mouseleave", handleMouseUp); // Stop if mouse leaves window

    // === TARGETING SYSTEM FUNCTIONS ===
    // Get current aim direction based on where camera is looking
    const getAimDirection = (): THREE.Vector3 => {
      return new THREE.Vector3(0, 0, -1)
        .applyQuaternion(cameraQuaternionRef.current)
        .normalize();
    };

    // Fire a probe in the given direction from the orb position
    const fireProbe = (fromPosition: THREE.Vector3, direction: THREE.Vector3) => {
      // Check capacity - don't fire if at max
      if (probesRef.current.length >= MAX_PROBES) {
        console.log('[Probes] At max capacity:', MAX_PROBES);
        return;
      }

      // Create probe mesh (small glowing sphere) - green for enabled
      const probeGeometry = new THREE.SphereGeometry(0.8, 16, 16);
      const probeMaterial = new THREE.MeshBasicMaterial({
        color: 0x22ff44, // Bright green for enabled probes
        transparent: true,
        opacity: 0.9,
      });
      const probeMesh = new THREE.Mesh(probeGeometry, probeMaterial);
      probeMesh.position.copy(fromPosition);
      probeMesh.frustumCulled = false;
      scene.add(probeMesh);

      const newProbe: Probe = {
        id: `probe_${probeIdCounter++}`,
        position: fromPosition.clone(),
        velocity: direction.clone().multiplyScalar(PROBE_SPEED),
        direction: direction.clone(),
        speed: PROBE_SPEED,
        pushRadius: 8,        // Units around probe that get affected
        pushStrength: 2.0,    // Medium-strong push force
        isActive: true,
        isEnabled: true,      // Default to enabled (green) for explosions
        isRecalling: false,   // Not recalling initially
        mesh: probeMesh,
      };

      probesRef.current.push(newProbe);
      console.log('[Probes] Fired probe:', newProbe.id, 'Total:', probesRef.current.length);
      forceProbeListUpdate();
    };

    // Get spherically distributed random direction
    const getSphericalDirection = (): THREE.Vector3 => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      return new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
      );
    };

    // Shared geometry for fragments (performance optimization)
    const sharedFragmentGeometry = new THREE.SphereGeometry(1, 4, 4); // Low poly, scale via mesh.scale

    // Explode a single probe into fragments
    const explodeProbe = (probe: Probe) => {
      if (!probe.isActive) return;

      // Check fragment limit
      const availableSlots = MAX_FRAGMENTS - fragmentsRef.current.length;
      if (availableSlots <= 0) {
        console.log('[Explosion] Fragment limit reached, skipping explosion');
        return;
      }

      // Calculate fragment count (12-20), capped by available slots
      const desiredCount = FRAGMENT_COUNT_MIN + Math.floor(Math.random() * (FRAGMENT_COUNT_MAX - FRAGMENT_COUNT_MIN + 1));
      const fragmentCount = Math.min(desiredCount, availableSlots);

      // Create fragments with shared geometry
      let fragmentIdCounter = 0;
      for (let i = 0; i < fragmentCount; i++) {
        const size = 0.2 + Math.random() * 0.4; // 0.2 to 0.6 scale

        const fragmentMaterial = new THREE.MeshBasicMaterial({
          color: probe.isEnabled ? 0x44ff88 : 0x88ccff, // Brighter green/blue
          transparent: true,
          opacity: 0.9,
        });
        const fragmentMesh = new THREE.Mesh(sharedFragmentGeometry, fragmentMaterial);
        fragmentMesh.position.copy(probe.position);
        fragmentMesh.scale.setScalar(size * 0.8);
        fragmentMesh.frustumCulled = false;
        scene.add(fragmentMesh);

        // Spherical direction for this fragment
        const direction = getSphericalDirection();
        const speed = 20 + Math.random() * 30; // 20-50 units/second (faster for impact)

        const fragment: Fragment = {
          id: `frag_${probe.id}_${fragmentIdCounter++}`,
          position: probe.position.clone(),
          velocity: direction.multiplyScalar(speed),
          size: size,
          pushStrength: probe.pushStrength * fragmentPushMultiplierRef.current, // Configurable force multiplier
          pushRadius: probe.pushRadius * size * fragmentRadiusMultiplierRef.current, // Configurable blast radius
          lifespan: FRAGMENT_LIFESPAN_MIN + Math.random() * (FRAGMENT_LIFESPAN_MAX - FRAGMENT_LIFESPAN_MIN),
          timeAlive: 0,
          mesh: fragmentMesh,
        };

        fragmentsRef.current.push(fragment);
      }

      console.log('[Explosion] Probe', probe.id, 'exploded into', fragmentCount, 'fragments. Total:', fragmentsRef.current.length);

      // Remove the probe
      probe.isActive = false;
      if (probe.mesh) {
        scene.remove(probe.mesh);
        probe.mesh.geometry.dispose();
        (probe.mesh.material as THREE.Material).dispose();
        probe.mesh = null;
      }
    };

    // Explode all enabled (green) probes
    const explodeEnabledProbes = () => {
      const enabledProbes = probesRef.current.filter(p => p.isActive && p.isEnabled);
      if (enabledProbes.length === 0) {
        console.log('[Explosion] No enabled probes to explode');
        return;
      }

      console.log('[Explosion] Exploding', enabledProbes.length, 'enabled probes');
      for (const probe of enabledProbes) {
        explodeProbe(probe);
      }

      // Clean up inactive probes from array
      probesRef.current = probesRef.current.filter(p => p.isActive);
    };

    // Recall all enabled probes back to the orb
    const recallEnabledProbes = () => {
      const enabledProbes = probesRef.current.filter(p => p.isActive && p.isEnabled && !p.isRecalling);
      if (enabledProbes.length === 0) {
        console.log('[Recall] No enabled probes to recall');
        return;
      }

      console.log('[Recall] Recalling', enabledProbes.length, 'enabled probes');
      for (const probe of enabledProbes) {
        probe.isRecalling = true;
        // Change color to indicate recall mode (yellow/gold)
        if (probe.mesh) {
          (probe.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xffaa00);
        }
      }
      forceProbeListUpdate();
    };

    // Flight control keyboard handlers (WASD + QE)
    const handleFlightKeyDown = (e: KeyboardEvent) => {
      if (!enableFlightControlsRef.current) return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(key)) {
        flightKeysRef.current.add(key);
        lastActivityRef.current = Date.now();
        isIdleRef.current = false;
      }

      // C = Toggle cruise lock (only when moving)
      if (key === 'c' && !e.shiftKey) {
        const flight = flightStateRef.current;
        if (flight.speed > 0.01) {
          // Currently moving - toggle lock
          flight.isLocked = !flight.isLocked;
          fireFlightStateCallback();
        }
      }

      // Spacebar = Emergency stop (instant halt + unlock)
      if (e.key === ' ' && !e.shiftKey) {
        e.preventDefault();
        const flight = flightStateRef.current;
        flight.speed = 0;
        flight.targetSpeed = 0;
        flight.isLocked = false;
        flight.holdDuration = 0;
        flight.worldDirection.set(0, 0, 0);
        flight.direction.set(0, 0, 0);
        fireFlightStateCallback();
      }

      // + or = key: Increase target speed by 10% (respects ceiling)
      if (key === '=' || key === '+') {
        e.preventDefault();
        const flight = flightStateRef.current;
        const currentBase = flight.targetSpeed > 0.01 ? flight.targetSpeed : flight.speed;
        const effectiveMax = Math.min(MAX_SPEED, flight.speedCeiling);  // Respect ceiling
        const newTarget = Math.min(effectiveMax, currentBase + 0.1);
        flight.targetSpeed = newTarget;

        // If stopped, start moving forward
        if (flight.speed < 0.01 && newTarget > 0) {
          flight.direction.set(0, 0, -1);
          flight.worldDirection.copy(flight.direction);
          flight.worldDirection.applyQuaternion(cameraQuaternionRef.current);
          flight.axisComponents = { forward: 1, right: 0, up: 0 };
        }

        // If locked, adjust speed immediately
        if (flight.isLocked) {
          flight.speed = newTarget;
        }

        fireFlightStateCallback();
      }

      // 0 key: Remove speed ceiling (unlock max speed)
      if (key === '0') {
        e.preventDefault();
        flightStateRef.current.speedCeiling = 1.0;
        fireFlightStateCallback();
        return;
      }

      // - key: Decrease target speed by 10% AND set as ceiling
      if (key === '-') {
        e.preventDefault();
        const flight = flightStateRef.current;
        const currentBase = flight.targetSpeed > 0.01 ? flight.targetSpeed : flight.speed;
        const newTarget = Math.max(0, currentBase - 0.1);
        flight.targetSpeed = newTarget;
        flight.speedCeiling = newTarget;  // Set ceiling to new target

        // If locked, adjust immediately (respect new ceiling)
        if (flight.isLocked) {
          flight.speed = Math.min(newTarget, flight.speed);
        }

        // If target is 0, stop and unlock
        if (newTarget < 0.01) {
          flight.speed = 0;
          flight.targetSpeed = 0;
          flight.speedCeiling = 0;  // Keep ceiling at 0 until unlocked
          flight.isLocked = false;
          flight.worldDirection.set(0, 0, 0);
          flight.direction.set(0, 0, 0);
        }

        fireFlightStateCallback();
      }

      // Track shift for roll mode
      if (e.key === 'Shift') {
        flightShiftRef.current = true;
      }

      // SHIFT+Home to reset camera to origin
      if (e.key === 'Home' && e.shiftKey) {
        cameraPositionRef.current.set(0, 0, 50);
        cameraQuaternionRef.current.identity(); // Reset rotation to default
        targetCameraDistanceRef.current = 0; // Reset to first person
        cameraDistanceRef.current = 0;
        // Reset auto-forward state
        autoForwardRef.current = false;
        autoForwardSpeedRef.current = 0;
        autoForwardTargetRef.current = 0;
        onAutoForwardChange?.(false);
        // Reset flight state
        const flight = flightStateRef.current;
        flight.speed = 0;
        flight.isLocked = false;
        flight.holdDuration = 0;
        flight.worldDirection.set(0, 0, 0);
        flight.direction.set(0, 0, 0);
        fireFlightStateCallback();
      }
      // "/" key to enable orb repositioning in 3rd person
      if (e.key === '/' && cameraDistanceRef.current > 0.5) {
        isOrbRepositionKeyRef.current = true;
        e.preventDefault(); // Prevent browser search
      }
      // F key for aim/fire toggle
      if (key === 'f') {
        console.log('[Targeting] F pressed, current state:', aimStateRef.current);
        if (aimStateRef.current === 'idle') {
          // Enter aim mode - show dotted line
          aimStateRef.current = 'aiming';
          console.log('[Targeting] Entered aim mode');
        } else if (aimStateRef.current === 'aiming') {
          // Fire probe using the stored aim direction (from mouse position)
          console.log('[Targeting] Firing probe in direction:', aimDirectionRef.current);
          fireProbe(cameraPositionRef.current.clone(), aimDirectionRef.current.clone());
          aimStateRef.current = 'idle';
          // Hide aim cone and ring
          if (aimConeRef.current) aimConeRef.current.visible = false;
          if (aimConeRingRef.current) aimConeRingRef.current.visible = false;
        }
      }
      // ESC to reset mouse states + cancel aim mode
      if (e.key === 'Escape') {
        // Reset all mouse button states to fix "stuck" MMB/RMB steering
        resetMouseStates();

        // Cancel aim mode if active
        if (aimStateRef.current === 'aiming') {
          aimStateRef.current = 'idle';
          if (aimConeRef.current) aimConeRef.current.visible = false;
          if (aimConeRingRef.current) aimConeRingRef.current.visible = false;
        }
      }
      // SHIFT+G to explode all enabled probes
      if (key === 'g' && e.shiftKey) {
        console.log('[Explosion] SHIFT+G pressed - exploding enabled probes');
        explodeEnabledProbes();
        forceProbeListUpdate();
      }
      // SHIFT+R to recall all enabled probes
      if (key === 'r' && e.shiftKey) {
        e.preventDefault(); // Prevent page refresh
        console.log('[Recall] SHIFT+R pressed - recalling enabled probes');
        recallEnabledProbes();
      }
      // TAB to toggle probe management panel
      if (e.key === 'Tab') {
        e.preventDefault(); // Prevent focus change
        setShowProbePanel(prev => !prev);
      }
    };

    const handleFlightKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      flightKeysRef.current.delete(key);
      // Track shift release
      if (e.key === 'Shift') {
        flightShiftRef.current = false;
      }
      // Release orb repositioning
      if (e.key === '/') {
        isOrbRepositionKeyRef.current = false;
      }
    };

    // Middle mouse button for free look (camera only), Right-click for camera look + steering
    const handleFlightMouseDown = (e: MouseEvent) => {
      if (!enableFlightControlsRef.current) return;

      if (e.button === 1) { // Middle mouse button - free look only (no steering)
        isMiddleMouseRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }

      if (e.button === 2) { // Right mouse button - steer + look
        isRightMouseRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    };

    const handleFlightMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        isMiddleMouseRef.current = false;
      }
      if (e.button === 2) {
        isRightMouseRef.current = false;
      }
    };

    const handleFlightMouseMove = (e: MouseEvent) => {
      // Middle mouse button: free look only (rotate camera, don't change travel direction)
      if (isMiddleMouseRef.current && enableFlightControlsRef.current) {
        const deltaX = e.clientX - lastMouseRef.current.x;
        const deltaY = e.clientY - lastMouseRef.current.y;

        const pitchQuat = new THREE.Quaternion();
        const yawQuat = new THREE.Quaternion();

        pitchQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -deltaY * lookSensitivityRef.current);
        yawQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -deltaX * lookSensitivityRef.current);

        // Only rotate camera, NOT travel direction
        cameraQuaternionRef.current.multiply(pitchQuat).multiply(yawQuat);
        cameraQuaternionRef.current.normalize();

        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        lastActivityRef.current = Date.now();
        isIdleRef.current = false;
      }

      // Right-click: steer + look (rotate camera AND change travel direction)
      if (isRightMouseRef.current && enableFlightControlsRef.current) {
        const deltaX = e.clientX - lastMouseRef.current.x;
        const deltaY = e.clientY - lastMouseRef.current.y;

        // Create rotation quaternions for pitch and yaw (no gimbal lock!)
        const pitchQuat = new THREE.Quaternion();
        const yawQuat = new THREE.Quaternion();

        // Pitch around local X axis (look up/down)
        pitchQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -deltaY * lookSensitivityRef.current);

        // Yaw around local Y axis (look left/right)
        yawQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -deltaX * lookSensitivityRef.current);

        const flight = flightStateRef.current;

        // Always rotate the camera (for look direction)
        cameraQuaternionRef.current.multiply(pitchQuat).multiply(yawQuat);
        cameraQuaternionRef.current.normalize();

        // If moving, steer travel direction to match camera forward
        // This makes right-click steering consistent with WASD behavior (fly where you look)
        if (flight.speed > 0.01) {
          // Set worldDirection to camera forward
          const forward = new THREE.Vector3(0, 0, -1);
          forward.applyQuaternion(cameraQuaternionRef.current);
          flight.worldDirection.copy(forward);

          // Update camera-relative direction to pure forward
          flight.direction.set(0, 0, -1);
          flight.axisComponents = { forward: 1, right: 0, up: 0 };
        }

        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        lastActivityRef.current = Date.now();
        isIdleRef.current = false;
      }
    };

    // Prevent context menu on middle and right click
    const handleContextMenu = (e: MouseEvent) => {
      if (enableFlightControlsRef.current) {
        e.preventDefault(); // Prevent context menu when flight controls are active
      }
    };

    // Left mouse button for free look in auto-forward mode
    const handleFreeLookMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && enableFlightControlsRef.current && autoForwardRef.current) {
        isLeftMouseRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    };

    const handleFreeLookMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isLeftMouseRef.current = false;
      }
    };

    const handleFreeLookMouseMove = (e: MouseEvent) => {
      if (isLeftMouseRef.current && enableFlightControlsRef.current && autoForwardRef.current) {
        const deltaX = e.clientX - lastMouseRef.current.x;
        const deltaY = e.clientY - lastMouseRef.current.y;

        // Rotate camera for free look (doesn't affect travel direction)
        const pitchQuat = new THREE.Quaternion();
        const yawQuat = new THREE.Quaternion();

        pitchQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -deltaY * lookSensitivityRef.current);
        yawQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -deltaX * lookSensitivityRef.current);

        cameraQuaternionRef.current.multiply(pitchQuat).multiply(yawQuat);
        cameraQuaternionRef.current.normalize();

        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        lastActivityRef.current = Date.now();
        isIdleRef.current = false;
      }
    };

    // "/" key + mouse move for orb repositioning in 3rd person
    const handleOrbRepositionMove = (e: MouseEvent) => {
      if (!isOrbRepositionKeyRef.current || !enableFlightControlsRef.current) return;
      if (cameraDistanceRef.current <= 0.5) {
        isOrbRepositionKeyRef.current = false;
        return;
      }

      const deltaX = e.clientX - lastMouseRef.current.x;
      const deltaY = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      // Update screen-space orbit offset (where the orb appears on screen)
      // Sensitivity scales with distance for consistent feel
      const sensitivity = 0.002;
      orbitOffsetRef.current.x += deltaX * sensitivity;
      orbitOffsetRef.current.y -= deltaY * sensitivity; // Invert Y for natural feel

      // Clamp offset to keep orb visible on screen (-0.8 to 0.8 in normalized coords)
      orbitOffsetRef.current.x = Math.max(-0.8, Math.min(0.8, orbitOffsetRef.current.x));
      orbitOffsetRef.current.y = Math.max(-0.8, Math.min(0.8, orbitOffsetRef.current.y));

      lastActivityRef.current = Date.now();
      isIdleRef.current = false;
    };

    // Scroll wheel for 3rd person zoom
    const handleFlightWheel = (e: WheelEvent) => {
      if (!enableFlightControlsRef.current) return;

      // Don't capture wheel events when mouse is over UI elements (settings panel, etc.)
      const target = e.target as HTMLElement;
      if (target.closest('[data-settings-panel]') || target.closest('[data-ui-panel]')) {
        return; // Let the panel scroll naturally
      }

      e.preventDefault();

      const currentDistance = targetCameraDistanceRef.current;

      // Calculate zoom speed based on distance (slower when further)
      const t = currentDistance / MAX_ZOOM_DISTANCE;
      const zoomSpeed = THREE.MathUtils.lerp(ZOOM_SPEED_NEAR, ZOOM_SPEED_FAR, t);

      // Update target distance (scroll down = zoom out, scroll up = zoom in)
      const delta = e.deltaY > 0 ? zoomSpeed : -zoomSpeed;
      targetCameraDistanceRef.current = THREE.MathUtils.clamp(
        currentDistance + delta,
        0, // Minimum (first person)
        MAX_ZOOM_DISTANCE // Maximum zoom out
      );
    };

    window.addEventListener("keydown", handleFlightKeyDown);
    window.addEventListener("keyup", handleFlightKeyUp);
    window.addEventListener("mousedown", handleFlightMouseDown);
    window.addEventListener("mouseup", handleFlightMouseUp);
    window.addEventListener("mousemove", handleFlightMouseMove);
    window.addEventListener("auxclick", handleContextMenu);
    window.addEventListener("wheel", handleFlightWheel, { passive: false });
    // Free look in auto-forward mode (left-click drag)
    window.addEventListener("mousedown", handleFreeLookMouseDown);
    window.addEventListener("mouseup", handleFreeLookMouseUp);
    window.addEventListener("mousemove", handleFreeLookMouseMove);
    // "/" key + mouse for orb repositioning in 3rd person mode
    window.addEventListener("mousemove", handleOrbRepositionMove);

    // Reset mouse states when window loses focus or mouse leaves (prevents stuck MMB/RMB)
    const handleWindowBlur = () => {
      resetMouseStates();
    };
    const handleDocumentMouseLeave = () => {
      resetMouseStates();
    };
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("mouseleave", handleDocumentMouseLeave);

    // Animation
    let time = 0;
    let animationId: number;

    // Idle timeout is now configurable via prop (in seconds, converted to ms)
    // 0 means never go idle
    const IDLE_TRANSITION_SPEED = 0.02; // How fast to transition to idle state
    const WAKE_TRANSITION_SPEED = 0.03; // How fast to wake up (gentle, not jarring)
    let wakeUpProgress = 1; // 0 = just woke up, 1 = fully awake

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Check for idle state based on mouse activity timeout
      // Note: Tether being off does NOT mean idle - we still track user activity
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      const wasIdle = isIdleRef.current;
      const idleTimeoutMs = idleTimeoutRef.current * 1000; // Convert seconds to ms

      // Go idle only after timeout with no mouse activity (0 = never idle)
      if (idleTimeoutMs > 0 && timeSinceActivity > idleTimeoutMs) {
        isIdleRef.current = true;
        if (!wasIdle) {
          wakeUpProgress = 0; // Reset wake progress when going idle
        }
      } else {
        isIdleRef.current = false;
        if (wasIdle) {
          // Just woke up - start wake transition
          wakeUpProgress = 0;
        }
      }

      // Gradually increase wake progress when not idle
      if (!isIdleRef.current && wakeUpProgress < 1) {
        wakeUpProgress += WAKE_TRANSITION_SPEED;
        wakeUpProgress = Math.min(wakeUpProgress, 1);
      }

      // Determine effective target speeds (tubes and particles separately)
      // When idle (no mouse activity for 5s): slow down to dreamy speed
      // When user is active OR converging: use user's speed setting
      // Note: Tether being off does NOT mean idle - user can still be active with tether off
      const isConverging = pulseToCenterRef.current;
      const effectiveTargetTubeSpeed = (isIdleRef.current && !isConverging) ? 0 : targetTubeSpeedRef.current;
      const effectiveTargetParticleSpeed = (isIdleRef.current && !isConverging) ? 0 : targetParticleSpeedRef.current;

      // Smoothly interpolate tube speed toward target (no jarring transitions)
      // Use asymmetric lerp: much slower when speeding up (hover off) for very gradual return
      const isTubeSpeedingUp = effectiveTargetTubeSpeed > tubeSpeedRef.current;
      const tubeBaseLerpFactor = isTubeSpeedingUp ? 0.005 : 0.05;
      const tubeSpeedLerpFactor = isIdleRef.current
        ? IDLE_TRANSITION_SPEED
        : IDLE_TRANSITION_SPEED + (tubeBaseLerpFactor - IDLE_TRANSITION_SPEED) * wakeUpProgress;
      tubeSpeedRef.current += (effectiveTargetTubeSpeed - tubeSpeedRef.current) * tubeSpeedLerpFactor;

      // Smoothly interpolate particle speed toward target
      const isParticleSpeedingUp = effectiveTargetParticleSpeed > particleSpeedRef.current;
      const particleBaseLerpFactor = isParticleSpeedingUp ? 0.005 : 0.05;
      const particleSpeedLerpFactor = isIdleRef.current
        ? IDLE_TRANSITION_SPEED
        : IDLE_TRANSITION_SPEED + (particleBaseLerpFactor - IDLE_TRANSITION_SPEED) * wakeUpProgress;
      particleSpeedRef.current += (effectiveTargetParticleSpeed - particleSpeedRef.current) * particleSpeedLerpFactor;

      // When idle, slowly drift mouse position toward center
      if (isIdleRef.current) {
        mouseRef.current.targetX += (0 - mouseRef.current.targetX) * IDLE_TRANSITION_SPEED;
        mouseRef.current.targetY += (0 - mouseRef.current.targetY) * IDLE_TRANSITION_SPEED;
      }

      // Smooth mouse follow - gentle during wake-up, more responsive when fully awake
      const mouseLerp = isIdleRef.current
        ? IDLE_TRANSITION_SPEED
        : IDLE_TRANSITION_SPEED + (0.15 - IDLE_TRANSITION_SPEED) * wakeUpProgress;
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * mouseLerp;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * mouseLerp;

      // Convert to world position - directly on cursor
      // Use camera FOV and distance to calculate exact screen-to-world mapping
      // When in flight mode, use a fixed reference distance (50) since camera moves freely
      const fovRad = (camera.fov * Math.PI) / 180;
      const cameraDistForMouseCalc = enableFlightControlsRef.current ? 50 : Math.abs(camera.position.z);
      const worldHeight = 2 * Math.tan(fovRad / 2) * Math.max(cameraDistForMouseCalc, 1); // Prevent zero/negative
      const worldWidth = worldHeight * camera.aspect;

      const mouseWorld = new THREE.Vector3(
        mouseRef.current.x * (worldWidth / 2),
        mouseRef.current.y * (worldHeight / 2),
        0
      );

      // Raw mouse position for collision (always tracked, even when tubes don't follow)
      const rawMouseWorld = new THREE.Vector3(
        rawMouseRef.current.x * (worldWidth / 2),
        rawMouseRef.current.y * (worldHeight / 2),
        0
      );

      // In 3rd person with orbit offset, adjust mouse positions for camera lateral shift
      // This ensures mouse follow and collision track correctly after "/" key repositioning
      if (enableFlightControlsRef.current && cameraDistanceRef.current > 0.5) {
        const distance = cameraDistanceRef.current;
        const offsetScale = distance * 0.8; // Same scale used in camera positioning

        // Get camera orientation vectors
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuaternionRef.current);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraQuaternionRef.current);

        // Add the same offset that was applied to camera position
        const offsetX = orbitOffsetRef.current.x * offsetScale;
        const offsetY = orbitOffsetRef.current.y * offsetScale;

        mouseWorld.add(right.clone().multiplyScalar(offsetX));
        mouseWorld.add(up.clone().multiplyScalar(offsetY));

        rawMouseWorld.add(right.clone().multiplyScalar(offsetX));
        rawMouseWorld.add(up.clone().multiplyScalar(offsetY));
      }

      // Use fixed deltaTime (~60fps) - speed scaling happens in individual components
      const rawDeltaTime = 0.016;

      // Advance time based on tube speed (used for helix calculations)
      const effectiveTubeSpeed = 0.2 + tubeSpeedRef.current * 0.96;
      time += rawDeltaTime * effectiveTubeSpeed;

      // Smoothly interpolate opacity toward target (tubes)
      const opacityLerpFactor = 0.08; // Smooth but responsive
      opacityRef.current += (targetOpacityRef.current - opacityRef.current) * opacityLerpFactor;

      // Smoothly interpolate particles opacity toward target
      particlesOpacityRef.current += (targetParticlesOpacityRef.current - particlesOpacityRef.current) * opacityLerpFactor;

      // Smoothly interpolate color intensity toward target
      const colorLerpFactor = 0.05; // Slower for smooth color transitions
      colorIntensityRef.current += (targetColorIntensityRef.current - colorIntensityRef.current) * colorLerpFactor;

      // Update strands (tubes only) - uses tube speed
      strands.forEach((strand) => {
        strand.update(mouseWorld, time, rawDeltaTime, tubeSpeedRef.current);
        strand.setOpacity(opacityRef.current);
        strand.setColorIntensity(colorIntensityRef.current);
      });

      // Update electricity (particles) - uses particle speed
      // Update and clean up pulse waves
      const now = Date.now();
      const PULSE_DURATION = 2000; // 2 seconds for wave to expand and fade
      const PULSE_MAX_RADIUS = 80; // Max radius in world units

      // Update pulse radii and remove expired pulses
      pulsesRef.current = pulsesRef.current.filter(pulse => {
        const age = now - pulse.startTime;
        if (age > PULSE_DURATION) return false;

        // Expand radius over time
        const progress = age / PULSE_DURATION;
        pulse.radius = progress * PULSE_MAX_RADIUS;
        pulse.strength = 1 - progress; // Fade strength over time
        return true;
      });

      // Check if we need to switch between 2D and 3D systems
      const shouldUse3D = is3DShape(particleShapeRef.current);
      if (shouldUse3D !== currentlyUsing3D) {
        // Dispose old system and create new one
        if (currentlyUsing3D && electricitySystem3D) {
          electricitySystem3D.dispose();
          electricitySystem3D = null;
          electricitySystem3DRef.current = null;
        } else if (!currentlyUsing3D && electricitySystem) {
          electricitySystem.dispose();
          electricitySystem = null;
          electricitySystemRef.current = null;
        }

        // Create new system
        if (shouldUse3D) {
          electricitySystem3D = new ElectricitySystem3D(scene, colorsRef.current, particleCountRef.current, particleShapeRef.current as ParticleShape3D);
          electricitySystem3DRef.current = electricitySystem3D;
        } else {
          electricitySystem = new ElectricitySystem(scene, colorsRef.current, particleCountRef.current, particleShapeRef.current);
          electricitySystemRef.current = electricitySystem;
        }

        currentlyUsing3D = shouldUse3D;
      }

      // Update the active particle system
      // Pass all active probes and fragments for 3D collision in flight mode
      const activeProbes = probesRef.current.filter(p => p.isActive);
      const activeFragments = fragmentsRef.current;
      if (electricitySystem) {
        electricitySystem.update(mouseWorld, time, particleSpeedRef.current, strands, pulseToCenterRef.current, enableCollisionRef.current, collisionRadiusRef.current, collisionStrengthRef.current, rawMouseWorld, pulsesRef.current, activeProbes, activeFragments, particleFrictionRef.current);
        electricitySystem.setOpacity(particlesOpacityRef.current);
        electricitySystem.setColorIntensity(colorIntensityRef.current);
      }

      if (electricitySystem3D) {
        electricitySystem3D.update(mouseWorld, time, particleSpeedRef.current, strands, pulseToCenterRef.current, enableCollisionRef.current, collisionRadiusRef.current, collisionStrengthRef.current, rawMouseWorld, pulsesRef.current, particleRotationRef.current, activeProbes, activeFragments, particleFrictionRef.current);
        electricitySystem3D.setOpacity(particlesOpacityRef.current);
        electricitySystem3D.setColorIntensity(colorIntensityRef.current);
      }

      // Process camera flight movement (before rendering)
      if (enableFlightControlsRef.current) {
        const baseSpeed = flightSpeedRef.current;

        // ============================================
        // PROGRESSIVE ACCELERATION FLIGHT SYSTEM
        // Hold keys to accelerate, release to coast, C to lock
        // ============================================
        const flight = flightStateRef.current;
        const keys = flightKeysRef.current;
        const hasMovementKeys = keys.has('w') || keys.has('a') || keys.has('s') ||
                                keys.has('d') || keys.has('q') || keys.has('e');

        // Approximate deltaTime (assuming ~60fps, ~16.67ms per frame)
        const deltaTime = 1 / 60;

        // Build direction from currently held keys
        if (hasMovementKeys) {
          const { velocity, axes } = buildVelocityFromKeys();
          flight.direction.copy(velocity);
          flight.axisComponents = axes;

          // Convert to world space using current camera orientation
          flight.worldDirection.copy(velocity);
          flight.worldDirection.applyQuaternion(cameraQuaternionRef.current);

          // Progressive acceleration: longer hold = faster ramp
          flight.holdDuration += deltaTime;
          const accelMultiplier = 1 + (flight.holdDuration * ACCEL_PROGRESSIVE);
          // Cap at minimum of: targetSpeed (if set), speedCeiling, and MAX_SPEED
          const targetCap = flight.targetSpeed > 0.01 ? flight.targetSpeed : MAX_SPEED;
          const speedCap = Math.min(targetCap, flight.speedCeiling);
          flight.speed = Math.min(speedCap, flight.speed + ACCEL_BASE * accelMultiplier);

        } else if (!flight.isLocked) {
          // No keys held and not locked
          flight.holdDuration = 0;

          if (flight.targetSpeed > 0.01) {
            // Has target speed from +/- keys - accelerate/decelerate toward it (respect ceiling)
            const effectiveTarget = Math.min(flight.targetSpeed, flight.speedCeiling);
            if (flight.speed < effectiveTarget) {
              flight.speed = Math.min(effectiveTarget, flight.speed + ACCEL_BASE * 2);
            } else if (flight.speed > effectiveTarget) {
              flight.speed = Math.max(effectiveTarget, flight.speed - DECEL_RATE);
            }
          } else {
            // No target - coast to stop (original behavior)
            flight.speed = Math.max(0, flight.speed - DECEL_RATE);
          }

          // Clear direction when fully stopped
          if (flight.speed < 0.001) {
            flight.speed = 0;
            flight.targetSpeed = 0;
            flight.direction.set(0, 0, 0);
            flight.worldDirection.set(0, 0, 0);
          }
        }

        // Apply movement based on speed and world direction
        if (flight.speed > 0 && flight.worldDirection.length() > 0) {
          const moveSpeed = baseSpeed * flight.speed;
          const movement = flight.worldDirection.clone().multiplyScalar(moveSpeed);
          cameraPositionRef.current.add(movement);
        }

        // SHIFT+A/D = Roll (barrel roll) - always allowed regardless of flight state
        if (flightShiftRef.current) {
          if (keys.has('a')) {
            const rollQuat = new THREE.Quaternion();
            rollQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), baseSpeed * 0.05);
            cameraQuaternionRef.current.multiply(rollQuat);
            cameraQuaternionRef.current.normalize();
          }
          if (keys.has('d')) {
            const rollQuat = new THREE.Quaternion();
            rollQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -baseSpeed * 0.05);
            cameraQuaternionRef.current.multiply(rollQuat);
            cameraQuaternionRef.current.normalize();
          }
        }

        // Clamp camera position to a very large boundary (10,000 units from origin)
        const FLIGHT_BOUNDARY = 10000;
        cameraPositionRef.current.x = Math.max(-FLIGHT_BOUNDARY, Math.min(FLIGHT_BOUNDARY, cameraPositionRef.current.x));
        cameraPositionRef.current.y = Math.max(-FLIGHT_BOUNDARY, Math.min(FLIGHT_BOUNDARY, cameraPositionRef.current.y));
        cameraPositionRef.current.z = Math.max(-FLIGHT_BOUNDARY, Math.min(FLIGHT_BOUNDARY, cameraPositionRef.current.z));

        // Throttled minimap callbacks (every MINIMAP_UPDATE_INTERVAL frames)
        lastMinimapUpdateRef.current++;
        if (lastMinimapUpdateRef.current >= MINIMAP_UPDATE_INTERVAL) {
          lastMinimapUpdateRef.current = 0;

          // Position callback
          onPositionChange?.({
            x: cameraPositionRef.current.x,
            y: cameraPositionRef.current.y,
            z: cameraPositionRef.current.z,
          });

          // Quaternion callback
          onQuaternionChange?.({
            x: cameraQuaternionRef.current.x,
            y: cameraQuaternionRef.current.y,
            z: cameraQuaternionRef.current.z,
            w: cameraQuaternionRef.current.w,
          });

          // Flight state callback (speed, direction, lock status)
          fireFlightStateCallback();
        }

        // Zen mode camera intro animation
        // Detect when isZenMode transitions from false to true
        if (isZenMode && !wasZenModeRef.current) {
          // Just entered Zen mode - start zoom out phase
          zenIntroPhaseRef.current = 'zoom_out';
          zenIntroProgressRef.current = 0;
        } else if (!isZenMode && wasZenModeRef.current) {
          // Exited Zen mode - reset animation state
          zenIntroPhaseRef.current = 'idle';
          zenIntroProgressRef.current = 0;
        }
        wasZenModeRef.current = isZenMode;

        // Process zen intro animation phases
        if (zenIntroPhaseRef.current === 'zoom_out') {
          zenIntroProgressRef.current += ZEN_INTRO_SPEED;
          // Ease out - smooth deceleration toward target
          const eased = 1 - Math.pow(1 - zenIntroProgressRef.current, 3);
          targetCameraDistanceRef.current = THREE.MathUtils.lerp(
            cameraDistanceRef.current,
            ZEN_INTRO_ZOOM_OUT_DISTANCE,
            eased
          );

          // Check if zoom out is complete (close enough to target)
          if (zenIntroProgressRef.current >= 1 ||
              Math.abs(cameraDistanceRef.current - ZEN_INTRO_ZOOM_OUT_DISTANCE) < 1) {
            zenIntroPhaseRef.current = 'zoom_in';
            zenIntroProgressRef.current = 0;
          }
        } else if (zenIntroPhaseRef.current === 'zoom_in') {
          zenIntroProgressRef.current += ZEN_INTRO_SPEED;
          // Ease in-out for smooth landing
          const eased = zenIntroProgressRef.current < 0.5
            ? 4 * zenIntroProgressRef.current * zenIntroProgressRef.current * zenIntroProgressRef.current
            : 1 - Math.pow(-2 * zenIntroProgressRef.current + 2, 3) / 2;
          targetCameraDistanceRef.current = THREE.MathUtils.lerp(
            ZEN_INTRO_ZOOM_OUT_DISTANCE,
            ZEN_FINAL_DISTANCE,
            eased
          );

          // Check if zoom in is complete
          if (zenIntroProgressRef.current >= 1) {
            zenIntroPhaseRef.current = 'complete';
            targetCameraDistanceRef.current = ZEN_FINAL_DISTANCE;
          }
        }

        // Smooth zoom interpolation for 3rd person camera
        cameraDistanceRef.current = THREE.MathUtils.lerp(
          cameraDistanceRef.current,
          targetCameraDistanceRef.current,
          ZOOM_LERP_SPEED
        );

        const distance = cameraDistanceRef.current;

        // Update player orb position and visibility
        if (playerOrbRef.current) {
          playerOrbRef.current.position.copy(cameraPositionRef.current);

          // In auto-forward mode, orb faces travel direction; otherwise faces camera direction
          if (autoForwardRef.current) {
            playerOrbRef.current.quaternion.copy(travelDirectionRef.current);
          } else {
            playerOrbRef.current.quaternion.copy(cameraQuaternionRef.current);
          }

          // Orb visibility: fade in as we zoom out
          const orbOpacity = THREE.MathUtils.clamp(distance / 5, 0, 0.9);
          (playerOrbRef.current.material as THREE.MeshStandardMaterial).opacity = orbOpacity;
          playerOrbRef.current.visible = distance > 0.5;

          // Update glow light position and intensity
          if (orbGlowRef.current) {
            orbGlowRef.current.position.copy(cameraPositionRef.current);
            orbGlowRef.current.intensity = orbOpacity * 2;
          }

          // Update exhaust particle system (persistent particles left in space)
          if (exhaustParticlesRef.current && exhaustDataRef.current && playerOrbRef.current) {
            const data = exhaustDataRef.current;
            const currentPos = cameraPositionRef.current.clone();
            const deltaTime = 1 / 60; // Approximate frame time

            // Check if we should spawn a new particle (based on distance traveled)
            const distFromLastSpawn = currentPos.distanceTo(lastExhaustPosRef.current);
            if (distFromLastSpawn >= EXHAUST_SPAWN_DISTANCE && playerOrbRef.current.visible) {
              // Spawn new particle at current position
              const idx = data.nextIndex;

              // Position with slight random offset
              data.positions[idx * 3] = currentPos.x + (Math.random() - 0.5) * 0.3;
              data.positions[idx * 3 + 1] = currentPos.y + (Math.random() - 0.5) * 0.3;
              data.positions[idx * 3 + 2] = currentPos.z + (Math.random() - 0.5) * 0.3;

              // Random lifespan
              const lifespan = EXHAUST_LIFESPAN_MIN + Math.random() * (EXHAUST_LIFESPAN_MAX - EXHAUST_LIFESPAN_MIN);
              data.lifetimes[idx] = 0;
              data.maxLifetimes[idx] = lifespan;

              // Slight random drift velocity
              data.velocities[idx * 3] = (Math.random() - 0.5) * 0.02;
              data.velocities[idx * 3 + 1] = (Math.random() - 0.5) * 0.02;
              data.velocities[idx * 3 + 2] = (Math.random() - 0.5) * 0.02;

              // Random size
              data.sizes[idx] = 0.3 + Math.random() * 0.4;

              // Color: cyan/white with slight variation
              data.colors[idx * 4] = 0.6 + Math.random() * 0.3;
              data.colors[idx * 4 + 1] = 0.9 + Math.random() * 0.1;
              data.colors[idx * 4 + 2] = 1;

              // Advance ring buffer
              data.nextIndex = (data.nextIndex + 1) % EXHAUST_PARTICLE_COUNT;
              lastExhaustPosRef.current.copy(currentPos);
            }

            // Update all particles
            const positionAttr = exhaustParticlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
            const colorAttr = exhaustParticlesRef.current.geometry.attributes.color as THREE.BufferAttribute;
            const sizeAttr = exhaustParticlesRef.current.geometry.attributes.size as THREE.BufferAttribute;

            for (let i = 0; i < EXHAUST_PARTICLE_COUNT; i++) {
              // Age the particle
              data.lifetimes[i] += deltaTime;

              const age = data.lifetimes[i];
              const maxLife = data.maxLifetimes[i];
              const lifeRatio = age / maxLife;

              if (lifeRatio < 1) {
                // Particle is alive - update position with drift
                data.positions[i * 3] += data.velocities[i * 3];
                data.positions[i * 3 + 1] += data.velocities[i * 3 + 1];
                data.positions[i * 3 + 2] += data.velocities[i * 3 + 2];

                positionAttr.setXYZ(i, data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2]);

                // Fade out over lifetime - quick fade in, slow fade out
                let alpha;
                if (lifeRatio < 0.1) {
                  // Quick fade in
                  alpha = lifeRatio * 10 * 0.7;
                } else {
                  // Slow fade out
                  alpha = (1 - (lifeRatio - 0.1) / 0.9) * 0.7;
                }
                colorAttr.setW(i, alpha);

                // Slight shimmer/size variation
                const shimmer = 0.9 + Math.sin(time * 5 + i * 1.7) * 0.1;
                sizeAttr.setX(i, data.sizes[i] * shimmer * (1 - lifeRatio * 0.3));
              } else {
                // Particle is dead - make invisible
                colorAttr.setW(i, 0);
              }
            }

            positionAttr.needsUpdate = true;
            colorAttr.needsUpdate = true;
            sizeAttr.needsUpdate = true;

            // Always visible when in flight mode
            exhaustParticlesRef.current.visible = enableFlightControlsRef.current;
          }
        }

        // Calculate camera position with 3rd person offset
        if (distance > 0.1) {
          // Get direction vectors from camera orientation
          const back = new THREE.Vector3(0, 0, 1);
          const right = new THREE.Vector3(1, 0, 0);
          const up = new THREE.Vector3(0, 1, 0);
          back.applyQuaternion(cameraQuaternionRef.current);
          right.applyQuaternion(cameraQuaternionRef.current);
          up.applyQuaternion(cameraQuaternionRef.current);

          // Apply orbit offset - shifts camera position to put orb at different screen position
          // Offset is in normalized screen coords, scale by distance for consistent visual offset
          const offsetScale = distance * 0.8;
          const offsetX = orbitOffsetRef.current.x * offsetScale;
          const offsetY = orbitOffsetRef.current.y * offsetScale;

          // Camera position = player position + back * distance + screen offset
          // Orb starts centered on screen (no default upward offset)
          camera.position.copy(cameraPositionRef.current)
            .add(back.clone().multiplyScalar(distance))
            .add(right.clone().multiplyScalar(offsetX))
            .add(up.clone().multiplyScalar(offsetY));
        } else {
          // First person - camera at player position, reset orbit offset
          camera.position.copy(cameraPositionRef.current);
          orbitOffsetRef.current = { x: 0, y: 0 };
        }

        camera.quaternion.copy(cameraQuaternionRef.current);
      }

      // === AIM CONE UPDATE ===
      // Show cone visualization while in aiming mode
      // Mouse controls aim direction in both 1st and 3rd person
      if (aimStateRef.current === 'aiming' && aimConeRef.current && enableFlightControlsRef.current) {
        const orbPosition = cameraPositionRef.current.clone(); // Orb is always at cameraPositionRef

        // Cast ray from camera through mouse position
        const raycaster = new THREE.Raycaster();
        const mouseNDC = new THREE.Vector2(rawMouseRef.current.x, rawMouseRef.current.y);
        raycaster.setFromCamera(mouseNDC, camera);

        // For 3rd person aiming: intersect ray with a virtual target plane
        // The plane is perpendicular to the camera's forward direction, at a fixed distance from the orb
        // This ensures where you click on screen is where the projectile goes
        const TARGET_PLANE_DISTANCE = 200; // How far in front of the orb the target plane is

        // Get camera forward direction
        const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

        // Create a plane at target distance from the orb, facing the camera
        const planePoint = orbPosition.clone().add(cameraForward.clone().multiplyScalar(TARGET_PLANE_DISTANCE));
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraForward.clone().negate(), planePoint);

        // Find intersection of mouse ray with this plane
        const intersectionPoint = new THREE.Vector3();
        const intersected = raycaster.ray.intersectPlane(plane, intersectionPoint);

        // Calculate aim direction from orb to intersection point (or fallback to far point method)
        let aimDir: THREE.Vector3;
        if (intersected) {
          aimDir = intersectionPoint.clone().sub(orbPosition).normalize();
        } else {
          // Fallback: use far point on ray (for edge cases where plane intersection fails)
          const farPoint = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(1000));
          aimDir = farPoint.clone().sub(orbPosition).normalize();
        }

        // Position cone at orb
        aimConeRef.current.position.copy(orbPosition);

        // Orient cone to point in aim direction
        // Create quaternion that rotates from -Z (cone default) to aim direction
        const defaultDir = new THREE.Vector3(0, 0, -1);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultDir, aimDir);
        aimConeRef.current.quaternion.copy(quaternion);
        aimConeRef.current.visible = true;

        // Animate shader uniforms for TRON effect
        const coneMat = aimConeRef.current.material as THREE.ShaderMaterial;
        if (coneMat.uniforms?.uTime) {
          coneMat.uniforms.uTime.value += 0.016; // ~60fps delta
        }

        // Update base ring halo (positioned at cone base)
        if (aimConeRingRef.current) {
          const AIM_CONE_LENGTH = 150;
          const ringPosition = orbPosition.clone().add(aimDir.clone().multiplyScalar(AIM_CONE_LENGTH));
          aimConeRingRef.current.position.copy(ringPosition);
          aimConeRingRef.current.quaternion.copy(quaternion);
          aimConeRingRef.current.visible = true;

          // Animate ring shader
          const ringMat = aimConeRingRef.current.material as THREE.ShaderMaterial;
          if (ringMat.uniforms?.uTime) {
            ringMat.uniforms.uTime.value += 0.016;
          }
        }

        // Store aim direction for firing
        aimDirectionRef.current.copy(aimDir);
      } else {
        // Hide cone when not aiming
        if (aimConeRef.current) {
          aimConeRef.current.visible = false;
        }
        if (aimConeRingRef.current) {
          aimConeRingRef.current.visible = false;
        }
      }

      // === MULTI-PROBE UPDATE ===
      // Move all probes through space and handle respawn at world boundaries
      const deltaTime = 1 / 60; // Approximate frame time
      const probesToDock: string[] = []; // Track probes that reached the orb

      for (const probe of probesRef.current) {
        if (!probe.isActive) continue;

        // RECALL MODE: Home in on the orb (camera position)
        if (probe.isRecalling) {
          const orbPosition = cameraPositionRef.current;
          const toOrb = orbPosition.clone().sub(probe.position);
          const distToOrb = toOrb.length();

          // Check if close enough to dock
          if (distToOrb < PROBE_DOCK_DISTANCE) {
            probesToDock.push(probe.id);
            continue;
          }

          // Steer toward orb with smooth homing
          const desiredDirection = toOrb.normalize();
          probe.direction.lerp(desiredDirection, 0.1); // Smooth turn
          probe.direction.normalize();
          probe.velocity.copy(probe.direction.clone().multiplyScalar(PROBE_RECALL_SPEED));

          // Move probe
          probe.position.add(probe.velocity.clone().multiplyScalar(deltaTime));
          if (probe.mesh) {
            probe.mesh.position.copy(probe.position);
          }
        } else {
          // NORMAL MODE: Move in current direction
          probe.position.add(probe.velocity.clone().multiplyScalar(deltaTime));
          if (probe.mesh) {
            probe.mesh.position.copy(probe.position);
          }

          // Check if probe reached world boundary - respawn like comet
          const distFromCenter = probe.position.length();
          if (distFromCenter > WORLD_BOUNDS) {
            // Respawn at random position on opposite edge of world
            // Pick a random point on the sphere at WORLD_BOUNDS distance
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const respawnPos = new THREE.Vector3(
              Math.sin(phi) * Math.cos(theta),
              Math.sin(phi) * Math.sin(theta),
              Math.cos(phi)
            ).multiplyScalar(WORLD_BOUNDS * 0.95); // Slightly inside boundary

            // Set direction toward center with some randomness
            const centerTarget = new THREE.Vector3(
              (Math.random() - 0.5) * WORLD_BOUNDS * 0.5,
              (Math.random() - 0.5) * WORLD_BOUNDS * 0.5,
              (Math.random() - 0.5) * WORLD_BOUNDS * 0.5
            );
            const newDirection = centerTarget.clone().sub(respawnPos).normalize();

            probe.position.copy(respawnPos);
            probe.direction.copy(newDirection);
            probe.velocity.copy(newDirection.multiplyScalar(probe.speed));

            if (probe.mesh) {
              probe.mesh.position.copy(respawnPos);
            }
          }
        }
      }

      // Dock probes that reached the orb (remove them)
      if (probesToDock.length > 0) {
        for (const probeId of probesToDock) {
          const probe = probesRef.current.find(p => p.id === probeId);
          if (probe) {
            console.log('[Recall] Probe', probeId, 'docked with orb');
            probe.isActive = false;
            if (probe.mesh) {
              scene.remove(probe.mesh);
              probe.mesh.geometry.dispose();
              (probe.mesh.material as THREE.Material).dispose();
              probe.mesh = null;
            }
          }
        }
        probesRef.current = probesRef.current.filter(p => p.isActive);
        forceProbeListUpdate();
      }

      // === FRAGMENT UPDATE ===
      // Move fragments, apply physics, handle fizzle-out
      const fragmentsToRemove: string[] = [];

      for (const fragment of fragmentsRef.current) {
        fragment.timeAlive += deltaTime;

        // Move fragment
        fragment.position.add(fragment.velocity.clone().multiplyScalar(deltaTime));
        if (fragment.mesh) {
          fragment.mesh.position.copy(fragment.position);
        }

        // Slow down fragments over time (drag effect)
        fragment.velocity.multiplyScalar(0.995);

        // Fizzle-out animation in last 0.5 seconds
        const timeRemaining = fragment.lifespan - fragment.timeAlive;
        if (timeRemaining < 0.5 && fragment.mesh) {
          const fadeProgress = 1 - (timeRemaining / 0.5);
          const scale = fragment.size * (1 - fadeProgress * 0.8); // Shrink to 20% of original
          fragment.mesh.scale.setScalar(scale);
          (fragment.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - fadeProgress);
        }

        // Remove expired fragments
        if (fragment.timeAlive >= fragment.lifespan) {
          fragmentsToRemove.push(fragment.id);
          if (fragment.mesh) {
            scene.remove(fragment.mesh);
            fragment.mesh.geometry.dispose();
            (fragment.mesh.material as THREE.Material).dispose();
          }
        }
      }

      // Clean up removed fragments
      if (fragmentsToRemove.length > 0) {
        fragmentsRef.current = fragmentsRef.current.filter(f => !fragmentsToRemove.includes(f.id));
      }

      composer.render();
    };

    animationId = requestAnimationFrame(animate);

    // Handle resize
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Capture ref values for cleanup
    const flightKeys = flightKeysRef.current;

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mouseleave", handleMouseUp);
      // Flight control cleanup
      window.removeEventListener("keydown", handleFlightKeyDown);
      window.removeEventListener("keyup", handleFlightKeyUp);
      window.removeEventListener("mousedown", handleFlightMouseDown);
      window.removeEventListener("mouseup", handleFlightMouseUp);
      window.removeEventListener("mousemove", handleFlightMouseMove);
      window.removeEventListener("auxclick", handleContextMenu);
      window.removeEventListener("wheel", handleFlightWheel);
      // Free look cleanup
      window.removeEventListener("mousedown", handleFreeLookMouseDown);
      window.removeEventListener("mouseup", handleFreeLookMouseUp);
      window.removeEventListener("mousemove", handleFreeLookMouseMove);
      // Orb repositioning cleanup
      window.removeEventListener("mousemove", handleOrbRepositionMove);
      // Mouse state reset handlers cleanup
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("mouseleave", handleDocumentMouseLeave);
      // Dispose player orb
      if (playerOrbRef.current) {
        playerOrbRef.current.geometry.dispose();
        (playerOrbRef.current.material as THREE.Material).dispose();
        scene.remove(playerOrbRef.current);
        playerOrbRef.current = null;
      }
      if (orbGlowRef.current) {
        scene.remove(orbGlowRef.current);
        orbGlowRef.current = null;
      }
      // Dispose exhaust particle system
      if (exhaustParticlesRef.current) {
        exhaustParticlesRef.current.geometry.dispose();
        (exhaustParticlesRef.current.material as THREE.Material).dispose();
        scene.remove(exhaustParticlesRef.current);
        exhaustParticlesRef.current = null;
      }
      exhaustDataRef.current = null;
      if (pulseInterval) clearInterval(pulseInterval);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      composer.dispose();
      container.removeChild(renderer.domElement);
      strands.forEach((strand) => strand.dispose());
      if (electricitySystem) electricitySystem.dispose();
      if (electricitySystem3D) electricitySystem3D.dispose();
      rendererRef.current = null;
      strandsRef.current = [];
      electricitySystemRef.current = null;
      electricitySystem3DRef.current = null;
      pulsesRef.current = [];
      flightKeys.clear();
    };
  }, [strandCount]); // colors and particleCount handled via refs to avoid animation restart

  // Toggle a probe's enabled state (and update mesh color)
  const toggleProbeEnabled = (probeId: string) => {
    const probe = probesRef.current.find(p => p.id === probeId);
    if (probe) {
      probe.isEnabled = !probe.isEnabled;
      // Update mesh color
      if (probe.mesh) {
        (probe.mesh.material as THREE.MeshBasicMaterial).color.setHex(
          probe.isEnabled ? 0x22ff44 : 0x44aaff
        );
      }
      forceProbeListUpdate();
    }
  };

  // Set all probes to enabled or disabled
  const setAllProbesEnabled = (enabled: boolean) => {
    for (const probe of probesRef.current) {
      probe.isEnabled = enabled;
      if (probe.mesh) {
        (probe.mesh.material as THREE.MeshBasicMaterial).color.setHex(
          enabled ? 0x22ff44 : 0x44aaff
        );
      }
    }
    forceProbeListUpdate();
  };

  // Recall all enabled probes (UI callable version)
  const recallProbesFromUI = () => {
    const enabledProbes = probesRef.current.filter(p => p.isActive && p.isEnabled && !p.isRecalling);
    if (enabledProbes.length === 0) return;

    for (const probe of enabledProbes) {
      probe.isRecalling = true;
      // Change color to indicate recall mode (yellow/gold)
      if (probe.mesh) {
        (probe.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xffaa00);
      }
    }
    forceProbeListUpdate();
  };

  // Get probe count for UI display (use probeListVersion to trigger re-read)
  const probeCount = probeListVersion >= 0 ? probesRef.current.length : 0;
  const enabledCount = probeListVersion >= 0 ? probesRef.current.filter(p => p.isEnabled && p.isActive).length : 0;

  return (
    <>
      <div
        ref={containerRef}
        className={`fixed inset-0 pointer-events-none z-0 ${className}`}
      />
      {/* Subtle blur overlay for extra atmospheric mist effect (fog depth handled by Three.js) */}
      {fogIntensity > 20 && (
        <div
          className="fixed inset-0 pointer-events-none z-[1] transition-opacity duration-500"
          style={{
            // No background color - Three.js fog handles the color fade
            // Just add a subtle blur for that misty feeling
            backdropFilter: `blur(${Math.min((fogIntensity - 20) / 15, 4)}px)`,
            WebkitBackdropFilter: `blur(${Math.min((fogIntensity - 20) / 15, 4)}px)`,
            opacity: Math.min((fogIntensity - 20) / 60, 0.7),
          }}
        />
      )}

      {/* Probe Management Panel - shows when TAB pressed in flight mode */}
      {showProbePanel && (
        <div
          data-ui-panel
          className="fixed bottom-4 left-4 z-50 pointer-events-auto"
          style={{
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '12px',
            minWidth: '200px',
            maxWidth: '280px',
            maxHeight: '300px',
          }}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white/90 text-sm font-medium">Probe Control</h3>
            <span className="text-white/50 text-xs">
              {probeCount}/{MAX_PROBES}
            </span>
          </div>

          {/* Stats */}
          <div className="flex gap-2 mb-3 text-xs">
            <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">
              {enabledCount} active
            </span>
            <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">
              {probeCount - enabledCount} passive
            </span>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setAllProbesEnabled(true)}
              className="flex-1 px-2 py-1.5 text-xs rounded bg-green-600/30 hover:bg-green-600/50 text-green-300 transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={() => setAllProbesEnabled(false)}
              className="flex-1 px-2 py-1.5 text-xs rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 transition-colors"
            >
              Disable All
            </button>
          </div>

          {/* Recall Button */}
          <button
            onClick={recallProbesFromUI}
            className="w-full px-2 py-1.5 mb-3 text-xs rounded bg-yellow-600/30 hover:bg-yellow-600/50 text-yellow-300 transition-colors flex items-center justify-center gap-2"
          >
            <span>⟵</span> Recall Enabled
          </button>

          {/* Probe List */}
          <div
            className="space-y-1 overflow-y-auto scrollbar-none"
            style={{ maxHeight: '150px' }}
          >
            {probesRef.current.filter(p => p.isActive).map((probe) => {
              const probeColor = probe.isRecalling ? '#ffaa00' : (probe.isEnabled ? '#22ff44' : '#44aaff');
              const bgClass = probe.isRecalling
                ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300'
                : (probe.isEnabled
                  ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300'
                  : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300');
              return (
                <button
                  key={probe.id}
                  onClick={() => !probe.isRecalling && toggleProbeEnabled(probe.id)}
                  className={`w-full px-2 py-1.5 rounded text-xs text-left flex items-center gap-2 transition-colors ${bgClass}`}
                  disabled={probe.isRecalling}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: probeColor,
                      boxShadow: `0 0 6px ${probeColor}`,
                    }}
                  />
                  <span className="truncate">{probe.id}</span>
                  {probe.isRecalling && <span className="ml-auto text-[10px] opacity-60">returning...</span>}
                </button>
              );
            })}
            {probeCount === 0 && (
              <p className="text-white/40 text-xs text-center py-2">
                No probes deployed<br />
                <span className="text-white/30">Press F twice to fire</span>
              </p>
            )}
          </div>

          {/* Hints */}
          <div className="mt-3 pt-2 border-t border-white/10 text-white/40 text-[10px]">
            <p>SHIFT+R: Recall enabled probes</p>
            <p>SHIFT+G: Explode enabled probes</p>
            <p>TAB: Toggle this panel</p>
          </div>
        </div>
      )}
    </>
  );
});

/**
 * DNA Helix Strand - intertwining tube that follows cursor
 * Uses parametric helix equation: x = r*cos(t), y = r*sin(t), z = c*t
 */
class HelixStrand {
  private scene: THREE.Scene;
  private color: THREE.Color;
  private strandIndex: number;
  private strandCount: number;
  private mesh: THREE.Mesh;
  private geometry: THREE.TubeGeometry | null = null;
  private material: THREE.MeshStandardMaterial;
  private points: THREE.Vector3[] = [];
  private maxPoints = 120;
  private currentPos: THREE.Vector3;
  private helixPhase: number;
  private accumulatedRotation: number = 0; // Track rotation separately for smooth speed transitions
  private radius: number = 0.15;

  constructor(
    scene: THREE.Scene,
    color: THREE.Color,
    index: number,
    strandCount: number,
    radius: number = 0.15
  ) {
    this.scene = scene;
    this.color = color;
    this.strandIndex = index;
    this.strandCount = strandCount;
    this.radius = radius;
    this.currentPos = new THREE.Vector3(0, 0, 0);

    // Each strand starts at different phase in the helix (evenly distributed)
    this.helixPhase = (index / strandCount) * Math.PI * 2;

    // Subtle glowing material - toned down for softer effect
    this.material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 1.0, // Reduced from 3.0
      roughness: 0.3,
      metalness: 0.5,
      transparent: true,
      opacity: 0.7, // Slightly transparent
    });

    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.frustumCulled = false; // Always render, even when camera looks away (for flight mode)
    this.scene.add(this.mesh);

    // Initialize points
    for (let i = 0; i < this.maxPoints; i++) {
      this.points.push(new THREE.Vector3(0, 0, 0));
    }
  }

  update(targetPos: THREE.Vector3, time: number, deltaTime: number, speed: number) {
    // Remap speed: slider 0 = near-stopped (0.02), slider 5 = max speed (5)
    const effectiveSpeed = 0.02 + speed * 0.996;

    // DNA Helix mathematical formula
    // Standard helix: x = r*cos(θ), y = r*sin(θ), z = c*θ
    // We apply this perpendicular to the movement direction

    const helixRadius = 1.5 + Math.sin(time * 2 + this.helixPhase) * 0.5; // Pulsing radius
    const helixFrequency = 8; // How tight the helix winds

    // Accumulate rotation incrementally based on deltaTime and speed
    // This prevents jumps when speed changes - rotation smoothly slows/speeds up
    this.accumulatedRotation += deltaTime * 3 * effectiveSpeed;

    // Calculate helix offset for this strand at current time
    const theta = this.accumulatedRotation + this.helixPhase;
    const helixX = Math.cos(theta) * helixRadius;
    const helixY = Math.sin(theta) * helixRadius;

    // Target position is cursor + helix offset
    const target = new THREE.Vector3(
      targetPos.x + helixX,
      targetPos.y + helixY,
      Math.sin(time * 2 + this.helixPhase) * 8 // Z oscillation - increased for 3D depth
    );

    // Direct follow - helix center is exactly on cursor
    this.currentPos.copy(target);

    // Build trail with helical motion
    // Each point in the trail has its own helix position based on age
    const newPoints: THREE.Vector3[] = [];

    for (let i = 0; i < this.maxPoints; i++) {
      const age = i / this.maxPoints; // 0 = head, 1 = tail
      const trailTheta = this.accumulatedRotation - age * helixFrequency + this.helixPhase;
      const trailRadius = helixRadius * (1 - age * 0.3); // Taper toward tail

      // Get base position from previous points (trail follows cursor path)
      const basePos = i === 0
        ? this.currentPos.clone()
        : this.points[i - 1]?.clone() || this.currentPos.clone();

      // Apply helix offset
      const helixOffsetX = Math.cos(trailTheta) * trailRadius;
      const helixOffsetY = Math.sin(trailTheta) * trailRadius;
      const helixOffsetZ = Math.sin(trailTheta * 0.5) * trailRadius * 1.5; // Increased for 3D depth

      newPoints.push(new THREE.Vector3(
        basePos.x + helixOffsetX * (1 - age * 0.5),
        basePos.y + helixOffsetY * (1 - age * 0.5),
        basePos.z + helixOffsetZ
      ));
    }

    // Update points with smoothing
    for (let i = 0; i < this.maxPoints; i++) {
      if (i === 0) {
        this.points[i].copy(newPoints[i]);
      } else {
        this.points[i].lerp(newPoints[i], 0.15);
      }
    }


    this.rebuildTube();
  }

  private rebuildTube() {
    if (this.points.length < 4) return;

    const curve = new THREE.CatmullRomCurve3(this.points);

    if (this.geometry) {
      this.geometry.dispose();
    }

    const tubularSegments = this.maxPoints * 2;
    const radialSegments = 12;

    this.geometry = new THREE.TubeGeometry(
      curve,
      tubularSegments,
      this.radius, // Base radius - configurable via slider
      radialSegments,
      false
    );

    const positions = this.geometry.attributes.position;
    const normals = this.geometry.attributes.normal;

    // Add vertex colors for comet tail fade effect
    const vertexCount = positions.count;
    const colorsArray = new Float32Array(vertexCount * 3);

    for (let i = 0; i < vertexCount; i++) {
      // Calculate t (0 = head, 1 = tail) based on vertex position along tube
      const segmentIndex = Math.floor(i / (radialSegments + 1));
      const t = segmentIndex / tubularSegments;

      // Dual fade: head fades in from cursor, tail fades out
      // - First 10%: fade IN from cursor (tip)
      // - 10-30%: brightest section
      // - 30-100%: fade OUT toward tail
      let brightness: number;
      if (t < 0.1) {
        // Head fade-in from cursor - starts transparent, becomes visible
        const fadeInT = t / 0.1; // 0 to 1 over first 10%
        brightness = Math.pow(fadeInT, 1.5); // Smooth fade in
      } else if (t < 0.3) {
        // Brightest middle-head section
        brightness = 1.0;
      } else {
        // Exponential fade for tail - like gas/dust dispersing
        const fadeT = (t - 0.3) / 0.7; // Normalize 0.3-1.0 to 0-1
        brightness = Math.pow(1 - fadeT, 2.5); // Exponential falloff
      }

      // Apply color with brightness
      colorsArray[i * 3] = this.color.r * brightness;
      colorsArray[i * 3 + 1] = this.color.g * brightness;
      colorsArray[i * 3 + 2] = this.color.b * brightness;

      // Taper radius - fade in at tip, thickest in middle, thin wispy tail
      let radiusScale: number;
      if (t < 0.1) {
        // Tip tapers to point near cursor
        const fadeInT = t / 0.1;
        radiusScale = Math.pow(fadeInT, 1.2) * 0.8; // Starts thin, grows
      } else if (t < 0.3) {
        // Full thickness with slight bulge in middle-head
        const bulgeT = (t - 0.1) / 0.2; // 0 to 1 over 10-30%
        radiusScale = 0.8 + Math.sin(bulgeT * Math.PI) * 0.3;
      } else {
        // Tail tapers to wisps
        const taperT = (t - 0.3) / 0.7;
        radiusScale = Math.pow(1 - taperT, 1.5) * 0.8;
      }

      // Apply taper by scaling position along normal
      const nx = normals.getX(i);
      const ny = normals.getY(i);
      const nz = normals.getZ(i);

      const currentRadius = this.radius; // Match TubeGeometry base radius
      const targetRadius = currentRadius * radiusScale;
      const radiusDiff = targetRadius - currentRadius;

      positions.setX(i, positions.getX(i) + nx * radiusDiff);
      positions.setY(i, positions.getY(i) + ny * radiusDiff);
      positions.setZ(i, positions.getZ(i) + nz * radiusDiff);
    }

    // Set vertex colors
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
    positions.needsUpdate = true;

    // Update material to use vertex colors
    this.material.vertexColors = true;

    this.mesh.geometry = this.geometry;
  }

  getPoints() {
    return this.points;
  }

  setOpacity(opacity: number) {
    // Base opacity is 0.7, scale it by the provided opacity
    this.material.opacity = 0.7 * opacity;
    // Also scale emissive intensity to reduce glow when fading
    this.material.emissiveIntensity = 1.0 * opacity;
    // Hide mesh entirely when opacity is 0 to prevent black silhouette
    this.mesh.visible = opacity > 0.01;
  }

  setColorIntensity(intensity: number) {
    // Interpolate between grayscale and full color
    // At intensity 0: grayscale (luminance-based)
    // At intensity 1: full original color
    const gray = 0.299 * this.color.r + 0.587 * this.color.g + 0.114 * this.color.b;
    const grayColor = new THREE.Color(gray, gray, gray);

    const blendedColor = grayColor.clone().lerp(this.color, intensity);
    this.material.color.copy(blendedColor);
    this.material.emissive.copy(blendedColor);
  }

  setColor(newColor: THREE.Color) {
    // Update the base color - used for seamless theme changes
    this.color = newColor;
    this.material.color.copy(newColor);
    this.material.emissive.copy(newColor);
  }

  setRadius(radius: number) {
    // Update the tube radius - takes effect on next rebuildTube() call
    this.radius = radius;
  }

  dispose() {
    this.geometry?.dispose();
    this.material.dispose();
    this.scene.remove(this.mesh);
  }
}

/**
 * Electricity particle system - sparks that jump between strands
 * Uses a fixed max buffer size but dynamically controls active count
 */
class ElectricitySystem {
  private scene: THREE.Scene;
  private particles: THREE.Points;
  private maxParticleCount = 100000; // Fixed buffer size
  private activeParticleCount: number; // How many are currently active
  private positions: Float32Array;
  private velocities: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private lifetimes: Float32Array;
  private colorPalette: THREE.Color[];
  private currentShape: ParticleShape = 'square';

  constructor(scene: THREE.Scene, colorStrings: string[], particleCount: number = 5000, shape: ParticleShape = 'square') {
    this.scene = scene;
    this.activeParticleCount = particleCount;
    this.colorPalette = colorStrings.map((c) => new THREE.Color(c));
    this.currentShape = shape;

    // Initialize arrays with MAX size (fixed buffer)
    this.positions = new Float32Array(this.maxParticleCount * 3);
    this.velocities = new Float32Array(this.maxParticleCount * 3);
    this.colors = new Float32Array(this.maxParticleCount * 3);
    this.sizes = new Float32Array(this.maxParticleCount);
    this.lifetimes = new Float32Array(this.maxParticleCount);

    // Initialize ALL particles as "dead" - they'll spawn from tubes naturally
    for (let i = 0; i < this.maxParticleCount; i++) {
      this.initParticleAsDead(i);
    }

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(this.sizes, 1));

    // Create texture for particle shape
    const texture = createParticleTexture(shape);

    // Subtle particle material - toned down
    const material = new THREE.PointsMaterial({
      size: shape === 'square' ? 0.3 : 0.5, // Textured particles need larger size
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.5, // More transparent
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(geometry, material);
    this.particles.frustumCulled = false; // Always render for flight mode
    this.scene.add(this.particles);
  }

  setActiveParticleCount(count: number) {
    this.activeParticleCount = Math.min(count, this.maxParticleCount);
  }

  setShape(shape: ParticleShape) {
    if (shape === this.currentShape) return;
    this.currentShape = shape;

    const texture = createParticleTexture(shape);
    const material = this.particles.material as THREE.PointsMaterial;

    // Dispose old texture if exists
    if (material.map) {
      material.map.dispose();
    }

    material.map = texture;
    material.size = shape === 'square' ? 0.3 : 0.5;
    material.needsUpdate = true;
  }

  private resetParticle(index: number, position?: THREE.Vector3) {
    const i3 = index * 3;

    // Random position near center or provided position
    const pos = position || new THREE.Vector3(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 5
    );

    this.positions[i3] = pos.x;
    this.positions[i3 + 1] = pos.y;
    this.positions[i3 + 2] = pos.z;

    // Random velocity - electricity is fast and erratic
    this.velocities[i3] = (Math.random() - 0.5) * 2;
    this.velocities[i3 + 1] = (Math.random() - 0.5) * 2;
    this.velocities[i3 + 2] = (Math.random() - 0.5) * 1;

    // Random color from palette
    const color = this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
    this.colors[i3] = color.r;
    this.colors[i3 + 1] = color.g;
    this.colors[i3 + 2] = color.b;

    // Random size
    this.sizes[index] = 0.2 + Math.random() * 0.4;

    // Reset lifetime
    this.lifetimes[index] = Math.random();
  }

  private initParticleAsDead(index: number) {
    const i3 = index * 3;

    // Position far off-screen (invisible)
    this.positions[i3] = 0;
    this.positions[i3 + 1] = 0;
    this.positions[i3 + 2] = -1000; // Behind camera

    // Zero velocity
    this.velocities[i3] = 0;
    this.velocities[i3 + 1] = 0;
    this.velocities[i3 + 2] = 0;

    // Transparent color
    this.colors[i3] = 0;
    this.colors[i3 + 1] = 0;
    this.colors[i3 + 2] = 0;

    // Zero size (invisible)
    this.sizes[index] = 0;

    // Dead - will respawn from tubes on next update
    this.lifetimes[index] = 0;
  }

  update(
    mousePos: THREE.Vector3,
    time: number,
    speed: number,
    strands: HelixStrand[],
    pulseToCenter: boolean = false,
    enableCollision: boolean = false,
    collisionRadius: number = 15,
    collisionStrength: number = 1.5,
    rawMousePos?: THREE.Vector3,
    pulses: Array<{ x: number; y: number; z?: number; radius: number; strength: number }> = [],
    probes: Array<{ position: THREE.Vector3; pushRadius: number; pushStrength: number; isActive: boolean }> = [],
    fragments: Array<{ position: THREE.Vector3; pushRadius: number; pushStrength: number }> = [],
    particleFriction: number = 15
  ) {
    // Remap speed: slider 0 = near-stopped (0.02), slider 5 = max speed (5)
    const effectiveSpeed = 0.02 + speed * 0.996;

    const positions = this.particles.geometry.attributes.position;
    const colors = this.particles.geometry.attributes.color;
    const sizes = this.particles.geometry.attributes.size;

    for (let i = 0; i < this.maxParticleCount; i++) {
      const i3 = i * 3;

      // Update lifetime - scales with effective speed
      this.lifetimes[i] -= 0.02 * effectiveSpeed;

      if (this.lifetimes[i] <= 0) {
        // Only respawn if within active count, otherwise stay dead
        if (i >= this.activeParticleCount) {
          // Keep particle dead (beyond active count)
          this.initParticleAsDead(i);
          continue;
        }

        // Respawn near a random strand point - heavily weighted toward the bright head (first 30%)
        const strandIndex = Math.floor(Math.random() * strands.length);
        const points = strands[strandIndex].getPoints();

        // Bias spawn toward head: 70% in first 30% of trail, 30% in rest
        let pointIndex: number;
        if (Math.random() < 0.7) {
          // Spawn in bright head region (first 30%)
          pointIndex = Math.floor(Math.random() * points.length * 0.3);
        } else {
          // Spawn in fading tail region
          pointIndex = Math.floor(points.length * 0.3 + Math.random() * points.length * 0.7);
        }

        const spawnPos = points[pointIndex];

        if (spawnPos) {
          // More spread for tail particles (like dispersing gas)
          const spread = pointIndex / points.length < 0.3 ? 0.3 : 1.0;
          this.resetParticle(i, spawnPos.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * spread,
              (Math.random() - 0.5) * spread,
              (Math.random() - 0.5) * spread * 0.5
            )
          ));
        } else {
          this.resetParticle(i, mousePos.clone());
        }
      }

      // Update position with velocity - fully controlled by effective speed
      const velocityScale = effectiveSpeed * 0.5;
      this.positions[i3] += this.velocities[i3] * velocityScale;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * velocityScale;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * velocityScale;

      // Add jitter for electricity effect - scales with effective speed
      const jitterScale = 0.3 * effectiveSpeed;
      this.positions[i3] += (Math.random() - 0.5) * jitterScale;
      this.positions[i3 + 1] += (Math.random() - 0.5) * jitterScale;
      this.positions[i3 + 2] += (Math.random() - 0.5) * jitterScale * 0.33;

      // Attract toward nearest strand
      const particlePos = new THREE.Vector3(
        this.positions[i3],
        this.positions[i3 + 1],
        this.positions[i3 + 2]
      );

      // Find nearest strand point
      let nearestDist = Infinity;
      let nearestPoint: THREE.Vector3 | null = null;

      for (const strand of strands) {
        const points = strand.getPoints();
        for (let j = 0; j < points.length; j += 5) {
          const dist = particlePos.distanceTo(points[j]);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestPoint = points[j];
          }
        }
      }

      // Attract particles - either to center (converge mode) or to nearest strand
      if (pulseToCenter) {
        // Calculate distance to center
        const distToCenter = Math.sqrt(
          particlePos.x * particlePos.x +
          particlePos.y * particlePos.y +
          particlePos.z * particlePos.z
        );

        // Strong exponential acceleration - particles rush to a tight center point
        const maxDist = 50;
        const normalizedDist = Math.min(distToCenter / maxDist, 1);
        // Steep exponential curve for aggressive pull, scaled by speed
        const exponentialFactor = Math.pow(1 - normalizedDist, 3);
        const centerAttraction = (0.15 + exponentialFactor * 0.6) * effectiveSpeed;

        this.velocities[i3] += (0 - particlePos.x) * centerAttraction;
        this.velocities[i3 + 1] += (0 - particlePos.y) * centerAttraction;
        this.velocities[i3 + 2] += (0 - particlePos.z) * centerAttraction;

        // Tight sticky center - particles lock into a small ball
        if (distToCenter < 0.5) {
          // Snap to near-zero position for tight packing
          this.positions[i3] *= 0.9;
          this.positions[i3 + 1] *= 0.9;
          this.positions[i3 + 2] *= 0.9;
          this.velocities[i3] *= 0.1;
          this.velocities[i3 + 1] *= 0.1;
          this.velocities[i3 + 2] *= 0.1;
        }
      } else if (nearestPoint && nearestDist > 0.5) {
        // Normal: attract to nearest strand point
        const attraction = 0.02 * effectiveSpeed;
        this.velocities[i3] += (nearestPoint.x - particlePos.x) * attraction;
        this.velocities[i3 + 1] += (nearestPoint.y - particlePos.y) * attraction;
        this.velocities[i3 + 2] += (nearestPoint.z - particlePos.z) * attraction;
      }

      // Mouse collision - repel particles based on 2D screen position
      // Uses X/Y distance only so ALL particles under the cursor are pushed,
      // regardless of their Z depth in the 3D scene
      // Uses rawMousePos which is always tracked, even when tube-following is disabled
      if (enableCollision && rawMousePos) {
        const dx = particlePos.x - rawMousePos.x;
        const dy = particlePos.y - rawMousePos.y;
        const dist2D = Math.sqrt(dx * dx + dy * dy);

        if (dist2D < collisionRadius && dist2D > 0.01) {
          // Push outward in X/Y (screen plane) with user-controlled strength
          this.velocities[i3] += (dx / dist2D) * collisionStrength;
          this.velocities[i3 + 1] += (dy / dist2D) * collisionStrength;

          // Slight Z scatter for visual depth variety
          this.velocities[i3 + 2] += (Math.random() - 0.5) * 0.3;
        }
      }

      // Pulse wave physics - ripples radiating outward like dropping a stone in water
      for (const pulse of pulses) {
        const ringThickness = 8; // World units - thickness of the wave ring

        if (pulse.z !== undefined) {
          // 3D SPHERICAL PULSE (flight mode) - expands as sphere from player position
          const dx = particlePos.x - pulse.x;
          const dy = particlePos.y - pulse.y;
          const dz = particlePos.z - pulse.z;
          const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

          const distFromRing = Math.abs(dist3D - pulse.radius);

          if (distFromRing < ringThickness) {
            const ringProximity = 1 - (distFromRing / ringThickness);
            const pushStrength = ringProximity * pulse.strength * 3.0;

            // Push outward in 3D (radially away from pulse center)
            if (dist3D > 0.1) {
              const normalX = dx / dist3D;
              const normalY = dy / dist3D;
              const normalZ = dz / dist3D;

              this.velocities[i3] += normalX * pushStrength;
              this.velocities[i3 + 1] += normalY * pushStrength;
              this.velocities[i3 + 2] += normalZ * pushStrength;
            }
          }
        } else {
          // 2D RADIAL PULSE (normal mode) - expands as ring in X/Y plane
          const dx = particlePos.x - pulse.x;
          const dy = particlePos.y - pulse.y;
          const distToPulse = Math.sqrt(dx * dx + dy * dy);

          const distFromRing = Math.abs(distToPulse - pulse.radius);

          if (distFromRing < ringThickness) {
            const ringProximity = 1 - (distFromRing / ringThickness);
            const pushStrength = ringProximity * pulse.strength * 3.0;

            if (distToPulse > 0.1) {
              const normalX = dx / distToPulse;
              const normalY = dy / distToPulse;

              this.velocities[i3] += normalX * pushStrength;
              this.velocities[i3 + 1] += normalY * pushStrength;

              // Add some vertical "splash" for 3D effect
              this.velocities[i3 + 2] += (Math.random() - 0.5) * pushStrength * 0.5;
            }
          }
        }
      }

      // MULTI-PROBE COLLISION - 3D spherical push away from each probe
      for (const probe of probes) {
        if (!probe.isActive) continue;
        const dx = particlePos.x - probe.position.x;
        const dy = particlePos.y - probe.position.y;
        const dz = particlePos.z - probe.position.z;
        const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist3D < probe.pushRadius && dist3D > 0.01) {
          const force = (1 - dist3D / probe.pushRadius) * probe.pushStrength;
          const nx = dx / dist3D;
          const ny = dy / dist3D;
          const nz = dz / dist3D;

          this.velocities[i3] += nx * force;
          this.velocities[i3 + 1] += ny * force;
          this.velocities[i3 + 2] += nz * force;
        }
      }

      // FRAGMENT COLLISION - 5x push strength
      for (const fragment of fragments) {
        const dx = particlePos.x - fragment.position.x;
        const dy = particlePos.y - fragment.position.y;
        const dz = particlePos.z - fragment.position.z;
        const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist3D < fragment.pushRadius && dist3D > 0.01) {
          const force = (1 - dist3D / fragment.pushRadius) * fragment.pushStrength;
          const nx = dx / dist3D;
          const ny = dy / dist3D;
          const nz = dz / dist3D;

          this.velocities[i3] += nx * force;
          this.velocities[i3 + 1] += ny * force;
          this.velocities[i3 + 2] += nz * force;
        }
      }

      // Damping - higher during converge for smooth deceleration
      // Convert friction (0-100) to damping (0.99-0.85): higher friction = lower damping = faster slowdown
      const baseDamping = 0.99 - (particleFriction / 100) * 0.14;
      const dampingFactor = pulseToCenter ? 0.85 : baseDamping;
      this.velocities[i3] *= dampingFactor;
      this.velocities[i3 + 1] *= dampingFactor;
      this.velocities[i3 + 2] *= dampingFactor;

      // Keep particles away from screen edges to prevent bloom edge artifacts
      // If particle drifts too far, push it back toward center
      const maxDist = 40; // World units from center
      const distFromCenter = Math.sqrt(
        this.positions[i3] * this.positions[i3] +
        this.positions[i3 + 1] * this.positions[i3 + 1]
      );
      if (distFromCenter > maxDist) {
        // Accelerate back toward center
        const pushBack = 0.05;
        this.velocities[i3] -= (this.positions[i3] / distFromCenter) * pushBack;
        this.velocities[i3 + 1] -= (this.positions[i3 + 1] / distFromCenter) * pushBack;
      }

      // Stable brightness
      const baseColor = this.colorPalette[i % this.colorPalette.length];
      this.colors[i3] = baseColor.r * 0.7;
      this.colors[i3 + 1] = baseColor.g * 0.7;
      this.colors[i3 + 2] = baseColor.b * 0.7;

      // Pulsing size
      this.sizes[i] = (0.2 + Math.random() * 0.3) * (0.5 + this.lifetimes[i]);
    }

    positions.needsUpdate = true;
    colors.needsUpdate = true;
    sizes.needsUpdate = true;
  }

  setOpacity(opacity: number) {
    // Base opacity is 0.5, scale it by the provided opacity
    const material = this.particles.material as THREE.PointsMaterial;
    material.opacity = 0.5 * opacity;
  }

  setColorIntensity(intensity: number) {
    // Update the color palette to blend between grayscale and full color
    // This affects newly spawned particles
    const colors = this.particles.geometry.attributes.color;
    for (let i = 0; i < this.maxParticleCount; i++) {
      const i3 = i * 3;
      const baseColor = this.colorPalette[i % this.colorPalette.length];

      // Calculate grayscale value
      const gray = 0.299 * baseColor.r + 0.587 * baseColor.g + 0.114 * baseColor.b;

      // Blend between grayscale and original color
      this.colors[i3] = (gray + (baseColor.r - gray) * intensity) * 0.7;
      this.colors[i3 + 1] = (gray + (baseColor.g - gray) * intensity) * 0.7;
      this.colors[i3 + 2] = (gray + (baseColor.b - gray) * intensity) * 0.7;
    }
    colors.needsUpdate = true;
  }

  setColorPalette(colorStrings: string[]) {
    // Update the color palette for seamless theme changes
    this.colorPalette = colorStrings.map((c) => new THREE.Color(c));

    // Update existing particle colors to new palette
    const colors = this.particles.geometry.attributes.color;
    for (let i = 0; i < this.maxParticleCount; i++) {
      const i3 = i * 3;
      const baseColor = this.colorPalette[i % this.colorPalette.length];
      this.colors[i3] = baseColor.r * 0.7;
      this.colors[i3 + 1] = baseColor.g * 0.7;
      this.colors[i3 + 2] = baseColor.b * 0.7;
    }
    colors.needsUpdate = true;
  }

  dispose() {
    this.particles.geometry.dispose();
    (this.particles.material as THREE.Material).dispose();
    this.scene.remove(this.particles);
  }
}

/**
 * 3D Instanced Particle System - true 3D meshes with depth and lighting
 * Uses InstancedMesh for performance with thousands of 3D particles
 */
class ElectricitySystem3D {
  private scene: THREE.Scene;
  private mesh: THREE.InstancedMesh;
  private maxParticleCount = 50000; // Lower than 2D due to higher GPU cost
  private activeParticleCount: number;
  private positions: Float32Array;
  private velocities: Float32Array;
  private scales: Float32Array;
  private lifetimes: Float32Array;
  private rotations: Float32Array; // Store per-particle rotations (x, y, z)
  private rotationSpeeds: Float32Array; // Store per-particle rotation speeds
  private colorIndices: Float32Array;
  private colorPalette: THREE.Color[];
  private currentShape: ParticleShape3D = 'sphere';
  private dummy = new THREE.Object3D();
  private colorAttribute: THREE.InstancedBufferAttribute;

  constructor(scene: THREE.Scene, colorStrings: string[], particleCount: number = 5000, shape: ParticleShape3D = 'sphere') {
    this.scene = scene;
    this.activeParticleCount = Math.min(particleCount, this.maxParticleCount);
    this.colorPalette = colorStrings.map((c) => new THREE.Color(c));
    this.currentShape = shape;

    // Initialize arrays
    this.positions = new Float32Array(this.maxParticleCount * 3);
    this.velocities = new Float32Array(this.maxParticleCount * 3);
    this.scales = new Float32Array(this.maxParticleCount);
    this.lifetimes = new Float32Array(this.maxParticleCount);
    this.rotations = new Float32Array(this.maxParticleCount * 3);
    this.rotationSpeeds = new Float32Array(this.maxParticleCount * 3);
    this.colorIndices = new Float32Array(this.maxParticleCount);

    // Initialize all particles as dead
    for (let i = 0; i < this.maxParticleCount; i++) {
      this.initParticleAsDead(i);
    }

    // Create geometry based on shape
    const geometry = this.createGeometry(shape);

    // Create material with vertex colors for per-instance coloring
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Create instanced mesh
    this.mesh = new THREE.InstancedMesh(geometry, material, this.maxParticleCount);
    this.mesh.frustumCulled = false; // Always render for flight mode
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Set up per-instance colors
    const colors = new Float32Array(this.maxParticleCount * 3);
    for (let i = 0; i < this.maxParticleCount; i++) {
      const color = this.colorPalette[i % this.colorPalette.length];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    this.colorAttribute = new THREE.InstancedBufferAttribute(colors, 3);
    this.mesh.instanceColor = this.colorAttribute;

    // Initialize all instances as invisible (scale 0)
    for (let i = 0; i < this.maxParticleCount; i++) {
      this.dummy.position.set(0, 0, -1000);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    this.scene.add(this.mesh);
  }

  private createGeometry(shape: ParticleShape3D): THREE.BufferGeometry {
    const size = 0.15; // Base size for 3D particles
    switch (shape) {
      case 'sphere':
        // More segments (16x12) for a smoother sphere appearance
        return new THREE.SphereGeometry(size, 16, 12);
      case 'cube':
        return new THREE.BoxGeometry(size * 1.5, size * 1.5, size * 1.5);
      case 'octahedron':
        return new THREE.OctahedronGeometry(size * 1.2);
      case 'tetrahedron':
        return new THREE.TetrahedronGeometry(size * 1.3);
      default:
        return new THREE.SphereGeometry(size, 16, 12);
    }
  }

  setActiveParticleCount(count: number) {
    this.activeParticleCount = Math.min(count, this.maxParticleCount);
  }

  setShape(shape: ParticleShape3D) {
    if (shape === this.currentShape) return;
    this.currentShape = shape;

    // Dispose old geometry and create new one
    this.mesh.geometry.dispose();
    this.mesh.geometry = this.createGeometry(shape);
  }

  private resetParticle(index: number, position?: THREE.Vector3) {
    const i3 = index * 3;

    const pos = position || new THREE.Vector3(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 5
    );

    this.positions[i3] = pos.x;
    this.positions[i3 + 1] = pos.y;
    this.positions[i3 + 2] = pos.z;

    this.velocities[i3] = (Math.random() - 0.5) * 2;
    this.velocities[i3 + 1] = (Math.random() - 0.5) * 2;
    this.velocities[i3 + 2] = (Math.random() - 0.5) * 1;

    // Random initial rotation
    this.rotations[i3] = Math.random() * Math.PI * 2;
    this.rotations[i3 + 1] = Math.random() * Math.PI * 2;
    this.rotations[i3 + 2] = Math.random() * Math.PI * 2;

    // Rotation speed (radians per frame) - noticeable tumble
    // Range: -0.05 to 0.05 radians/frame = about -3 to 3 degrees/frame at 60fps
    this.rotationSpeeds[i3] = (Math.random() - 0.5) * 0.1;
    this.rotationSpeeds[i3 + 1] = (Math.random() - 0.5) * 0.1;
    this.rotationSpeeds[i3 + 2] = (Math.random() - 0.5) * 0.1;

    this.scales[index] = 0.5 + Math.random() * 1.5;
    this.lifetimes[index] = Math.random();

    // Assign random color from palette
    const colorIndex = Math.floor(Math.random() * this.colorPalette.length);
    this.colorIndices[index] = colorIndex;
    const color = this.colorPalette[colorIndex];
    this.colorAttribute.setXYZ(index, color.r, color.g, color.b);
  }

  private initParticleAsDead(index: number) {
    const i3 = index * 3;
    this.positions[i3] = 0;
    this.positions[i3 + 1] = 0;
    this.positions[i3 + 2] = -1000;
    this.velocities[i3] = 0;
    this.velocities[i3 + 1] = 0;
    this.velocities[i3 + 2] = 0;
    this.rotations[i3] = 0;
    this.rotations[i3 + 1] = 0;
    this.rotations[i3 + 2] = 0;
    this.rotationSpeeds[i3] = 0;
    this.rotationSpeeds[i3 + 1] = 0;
    this.rotationSpeeds[i3 + 2] = 0;
    this.scales[index] = 0;
    this.lifetimes[index] = -1;
  }

  update(
    mousePos: THREE.Vector3,
    _time: number,
    speed: number,
    strands: HelixStrand[],
    pulseToCenter: boolean,
    enableCollision: boolean,
    collisionRadius: number,
    collisionStrength: number,
    rawMousePos: THREE.Vector3 | null,
    pulses: Array<{ x: number; y: number; z?: number; radius: number; strength: number }>,
    rotationSpeed: number = 50, // 0-100 scale, 50 is default
    probes: Array<{ position: THREE.Vector3; pushRadius: number; pushStrength: number; isActive: boolean }> = [],
    fragments: Array<{ position: THREE.Vector3; pushRadius: number; pushStrength: number }> = [],
    particleFriction: number = 15
  ) {
    const effectiveSpeed = 0.02 + speed * 0.996;
    // Convert rotation slider (0-100) to multiplier (0-2, where 50 = 1)
    const rotationMultiplier = rotationSpeed / 50;

    for (let i = 0; i < this.maxParticleCount; i++) {
      const i3 = i * 3;

      // Update lifetime
      this.lifetimes[i] -= 0.003 * effectiveSpeed;

      if (this.lifetimes[i] <= 0) {
        if (i >= this.activeParticleCount) {
          this.initParticleAsDead(i);
          continue;
        }

        // Respawn from a tube
        const allPoints: THREE.Vector3[] = [];
        for (const strand of strands) {
          allPoints.push(...strand.getPoints());
        }

        if (allPoints.length > 0) {
          const pointIndex = Math.floor(Math.random() * allPoints.length);
          const spawnPos = allPoints[pointIndex];
          if (spawnPos) {
            const spread = pointIndex / allPoints.length < 0.3 ? 0.3 : 1.0;
            this.resetParticle(i, spawnPos.clone().add(
              new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread * 0.5
              )
            ));
          } else {
            this.resetParticle(i, mousePos.clone());
          }
        } else {
          this.resetParticle(i, mousePos.clone());
        }
      }

      // Apply velocity with jitter
      const jitterScale = 0.02 * effectiveSpeed;
      this.positions[i3] += this.velocities[i3] * 0.1 * effectiveSpeed;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * 0.1 * effectiveSpeed;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * 0.1 * effectiveSpeed;

      this.positions[i3] += (Math.random() - 0.5) * jitterScale;
      this.positions[i3 + 1] += (Math.random() - 0.5) * jitterScale;
      this.positions[i3 + 2] += (Math.random() - 0.5) * jitterScale * 0.33;

      const particlePos = new THREE.Vector3(
        this.positions[i3],
        this.positions[i3 + 1],
        this.positions[i3 + 2]
      );

      // Find nearest strand point
      let nearestDist = Infinity;
      let nearestPoint: THREE.Vector3 | null = null;
      for (const strand of strands) {
        const points = strand.getPoints();
        for (let j = 0; j < points.length; j += 5) {
          const dist = particlePos.distanceTo(points[j]);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestPoint = points[j];
          }
        }
      }

      // Attraction logic
      if (pulseToCenter) {
        const distToCenter = particlePos.length();
        const maxDist = 50;
        const normalizedDist = Math.min(distToCenter / maxDist, 1);
        const exponentialFactor = Math.pow(1 - normalizedDist, 3);
        const centerAttraction = (0.15 + exponentialFactor * 0.6) * effectiveSpeed;

        this.velocities[i3] += (0 - particlePos.x) * centerAttraction;
        this.velocities[i3 + 1] += (0 - particlePos.y) * centerAttraction;
        this.velocities[i3 + 2] += (0 - particlePos.z) * centerAttraction;

        if (distToCenter < 0.5) {
          this.positions[i3] *= 0.9;
          this.positions[i3 + 1] *= 0.9;
          this.positions[i3 + 2] *= 0.9;
        }
      } else if (nearestPoint && nearestDist > 0.5) {
        const attraction = 0.02 * effectiveSpeed;
        this.velocities[i3] += (nearestPoint.x - particlePos.x) * attraction;
        this.velocities[i3 + 1] += (nearestPoint.y - particlePos.y) * attraction;
        this.velocities[i3 + 2] += (nearestPoint.z - particlePos.z) * attraction;
      }

      // Mouse collision
      if (enableCollision && rawMousePos) {
        const dx = particlePos.x - rawMousePos.x;
        const dy = particlePos.y - rawMousePos.y;
        const dist2D = Math.sqrt(dx * dx + dy * dy);

        if (dist2D < collisionRadius && dist2D > 0.01) {
          const force = (1 - dist2D / collisionRadius) * collisionStrength * 0.5;
          const nx = dx / dist2D;
          const ny = dy / dist2D;
          this.velocities[i3] += nx * force;
          this.velocities[i3 + 1] += ny * force;
        }
      }

      // Pulse wave physics
      for (const pulse of pulses) {
        const ringThickness = 8;

        if (pulse.z !== undefined) {
          // 3D SPHERICAL PULSE (flight mode) - expands as sphere from player position
          const dx = particlePos.x - pulse.x;
          const dy = particlePos.y - pulse.y;
          const dz = particlePos.z - pulse.z;
          const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

          const distFromRing = Math.abs(dist3D - pulse.radius);

          if (distFromRing < ringThickness) {
            const ringProximity = 1 - (distFromRing / ringThickness);
            const pushStrength = ringProximity * pulse.strength * 3.0;

            // Push outward in 3D (radially away from pulse center)
            if (dist3D > 0.1) {
              const normalX = dx / dist3D;
              const normalY = dy / dist3D;
              const normalZ = dz / dist3D;

              this.velocities[i3] += normalX * pushStrength;
              this.velocities[i3 + 1] += normalY * pushStrength;
              this.velocities[i3 + 2] += normalZ * pushStrength;
            }
          }
        } else {
          // 2D RADIAL PULSE (normal mode) - expands as ring in X/Y plane
          const dx = particlePos.x - pulse.x;
          const dy = particlePos.y - pulse.y;
          const distToPulse = Math.sqrt(dx * dx + dy * dy);

          const distFromRing = Math.abs(distToPulse - pulse.radius);

          if (distFromRing < ringThickness) {
            const ringProximity = 1 - (distFromRing / ringThickness);
            const pushStrength = ringProximity * pulse.strength * 3.0;

            if (distToPulse > 0.01) {
              const normalX = dx / distToPulse;
              const normalY = dy / distToPulse;
              this.velocities[i3] += normalX * pushStrength;
              this.velocities[i3 + 1] += normalY * pushStrength;
              this.velocities[i3 + 2] += (Math.random() - 0.5) * pushStrength * 0.3;
            }
          }
        }
      }

      // MULTI-PROBE COLLISION - 3D spherical push away from each probe
      for (const probe of probes) {
        if (!probe.isActive) continue;
        const dx = particlePos.x - probe.position.x;
        const dy = particlePos.y - probe.position.y;
        const dz = particlePos.z - probe.position.z;
        const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist3D < probe.pushRadius && dist3D > 0.01) {
          const force = (1 - dist3D / probe.pushRadius) * probe.pushStrength;
          const nx = dx / dist3D;
          const ny = dy / dist3D;
          const nz = dz / dist3D;

          this.velocities[i3] += nx * force;
          this.velocities[i3 + 1] += ny * force;
          this.velocities[i3 + 2] += nz * force;
        }
      }

      // FRAGMENT COLLISION - 5x push strength
      for (const fragment of fragments) {
        const dx = particlePos.x - fragment.position.x;
        const dy = particlePos.y - fragment.position.y;
        const dz = particlePos.z - fragment.position.z;
        const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist3D < fragment.pushRadius && dist3D > 0.01) {
          const force = (1 - dist3D / fragment.pushRadius) * fragment.pushStrength;
          const nx = dx / dist3D;
          const ny = dy / dist3D;
          const nz = dz / dist3D;

          this.velocities[i3] += nx * force;
          this.velocities[i3 + 1] += ny * force;
          this.velocities[i3 + 2] += nz * force;
        }
      }

      // Damping - convert friction (0-100) to damping (0.99-0.85)
      const dampingFactor = 0.99 - (particleFriction / 100) * 0.14;
      this.velocities[i3] *= dampingFactor;
      this.velocities[i3 + 1] *= dampingFactor;
      this.velocities[i3 + 2] *= dampingFactor;

      // Keep particles in bounds
      const maxDist = 40;
      const distFromCenter = particlePos.length();
      if (distFromCenter > maxDist) {
        const pushBack = 0.1;
        this.velocities[i3] -= (this.positions[i3] / distFromCenter) * pushBack;
        this.velocities[i3 + 1] -= (this.positions[i3 + 1] / distFromCenter) * pushBack;
        this.velocities[i3 + 2] -= (this.positions[i3 + 2] / distFromCenter) * pushBack;
      }

      // Update per-particle rotation (controlled by slider, independent of movement speed)
      // rotationMultiplier: 0 = no rotation, 1 = normal (at 50%), 2 = fast (at 100%)
      this.rotations[i3] += this.rotationSpeeds[i3] * rotationMultiplier;
      this.rotations[i3 + 1] += this.rotationSpeeds[i3 + 1] * rotationMultiplier;
      this.rotations[i3 + 2] += this.rotationSpeeds[i3 + 2] * rotationMultiplier;

      // Update instance matrix
      const scale = this.scales[i] * Math.max(0, Math.min(1, this.lifetimes[i] * 3));
      this.dummy.position.set(this.positions[i3], this.positions[i3 + 1], this.positions[i3 + 2]);
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.rotation.set(this.rotations[i3], this.rotations[i3 + 1], this.rotations[i3 + 2]);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.colorAttribute.needsUpdate = true;
  }

  setOpacity(opacity: number) {
    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * opacity;
  }

  setColorIntensity(intensity: number) {
    for (let i = 0; i < this.maxParticleCount; i++) {
      const baseColor = this.colorPalette[Math.floor(this.colorIndices[i]) % this.colorPalette.length];
      const gray = (baseColor.r + baseColor.g + baseColor.b) / 3;
      const r = gray + (baseColor.r - gray) * intensity;
      const g = gray + (baseColor.g - gray) * intensity;
      const b = gray + (baseColor.b - gray) * intensity;
      this.colorAttribute.setXYZ(i, r * 0.7, g * 0.7, b * 0.7);
    }
    this.colorAttribute.needsUpdate = true;
  }

  setColorPalette(colorStrings: string[]) {
    this.colorPalette = colorStrings.map((c) => new THREE.Color(c));
    for (let i = 0; i < this.maxParticleCount; i++) {
      const baseColor = this.colorPalette[i % this.colorPalette.length];
      this.colorAttribute.setXYZ(i, baseColor.r * 0.7, baseColor.g * 0.7, baseColor.b * 0.7);
    }
    this.colorAttribute.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.scene.remove(this.mesh);
  }
}

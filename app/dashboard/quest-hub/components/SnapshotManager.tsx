"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Trash2, Cloud, HardDrive, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  saveSnapshot,
  listSnapshots,
  getSnapshot,
  deleteSnapshot,
  encodeFloat32Array,
  decodeFloat32Array,
  type LocalSnapshot,
  type LocalSnapshotMeta,
  type SnapshotSettings,
  type CameraState as LocalCameraState,
} from "@/lib/storage/scene-snapshots";
import {
  createPreset,
  listPresets,
  deletePreset,
  getPresetCount,
} from "@/app/dashboard/visual-presets/actions";
import type { VisualPreset, CloudPresetSettings } from "@/lib/db/schema/visual-presets";
import type { TubesSnapshotAPI, CameraState, ParticleExportData } from "@/components/effects/TubesEffect";

interface SnapshotManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: SnapshotSettings;
  currentMode: "flow" | "focus";
  snapshotAPI: TubesSnapshotAPI | null;
  onLoadSettings: (settings: SnapshotSettings) => void;
  onLoadFullSnapshot: (settings: SnapshotSettings, camera: CameraState, particles: ParticleExportData) => void;
}

type TabType = "local" | "cloud";

export function SnapshotManager({
  isOpen,
  onClose,
  currentSettings,
  currentMode,
  snapshotAPI,
  onLoadSettings,
  onLoadFullSnapshot,
}: SnapshotManagerProps) {
  const [activeTab, setActiveTab] = useState<TabType>("local");
  const [localSnapshots, setLocalSnapshots] = useState<LocalSnapshotMeta[]>([]);
  const [cloudPresets, setCloudPresets] = useState<VisualPreset[]>([]);
  const [cloudCount, setCloudCount] = useState({ count: 0, max: 50 });
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadLocalSnapshots();
      loadCloudPresets();
    }
  }, [isOpen]);

  const loadLocalSnapshots = async () => {
    try {
      const snapshots = await listSnapshots();
      setLocalSnapshots(snapshots);
    } catch (error) {
      console.error("Failed to load local snapshots:", error);
    }
  };

  const loadCloudPresets = async () => {
    try {
      startTransition(async () => {
        const [presets, count] = await Promise.all([
          listPresets(),
          getPresetCount(),
        ]);
        setCloudPresets(presets);
        setCloudCount(count);
      });
    } catch (error) {
      console.error("Failed to load cloud presets:", error);
    }
  };

  const handleSaveLocal = async () => {
    if (!saveName.trim() || !snapshotAPI) return;

    setIsSaving(true);
    try {
      const camera = snapshotAPI.getCameraState();
      const particles = snapshotAPI.getParticleData();
      const thumbnail = snapshotAPI.captureScreenshot();

      if (!particles) {
        throw new Error("Could not capture particle data");
      }

      await saveSnapshot({
        name: saveName.trim(),
        settings: currentSettings,
        camera: camera as LocalCameraState,
        particles: {
          count: particles.count,
          nextIndex: particles.nextIndex,
          positions: encodeFloat32Array(particles.positions),
          colors: encodeFloat32Array(particles.colors),
          sizes: encodeFloat32Array(particles.sizes),
          lifetimes: encodeFloat32Array(particles.lifetimes),
          maxLifetimes: encodeFloat32Array(particles.maxLifetimes),
          velocities: encodeFloat32Array(particles.velocities),
        },
        thumbnail: thumbnail ?? undefined,
      });

      setSaveName("");
      await loadLocalSnapshots();
    } catch (error) {
      console.error("Failed to save local snapshot:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCloud = async () => {
    if (!saveName.trim()) return;

    setIsSaving(true);
    try {
      await createPreset({
        name: saveName.trim(),
        settings: currentSettings as CloudPresetSettings,
        mode: currentMode,
      });

      setSaveName("");
      await loadCloudPresets();
    } catch (error) {
      console.error("Failed to save cloud preset:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadLocal = async (id: string) => {
    setLoadingId(id);
    setIsLoading(true);
    try {
      const snapshot = await getSnapshot(id);
      if (!snapshot) {
        throw new Error("Snapshot not found");
      }

      const particles: ParticleExportData = {
        count: snapshot.particles.count,
        nextIndex: snapshot.particles.nextIndex,
        positions: decodeFloat32Array(snapshot.particles.positions),
        colors: decodeFloat32Array(snapshot.particles.colors),
        sizes: decodeFloat32Array(snapshot.particles.sizes),
        lifetimes: decodeFloat32Array(snapshot.particles.lifetimes),
        maxLifetimes: decodeFloat32Array(snapshot.particles.maxLifetimes),
        velocities: decodeFloat32Array(snapshot.particles.velocities),
      };

      onLoadFullSnapshot(snapshot.settings, snapshot.camera, particles);
      onClose();
    } catch (error) {
      console.error("Failed to load local snapshot:", error);
    } finally {
      setIsLoading(false);
      setLoadingId(null);
    }
  };

  const handleLoadCloud = (preset: VisualPreset) => {
    onLoadSettings(preset.settings as SnapshotSettings);
    onClose();
  };

  const handleDeleteLocal = async (id: string) => {
    try {
      await deleteSnapshot(id);
      await loadLocalSnapshots();
    } catch (error) {
      console.error("Failed to delete local snapshot:", error);
    }
  };

  const handleDeleteCloud = async (id: string) => {
    try {
      await deletePreset(id);
      await loadCloudPresets();
    } catch (error) {
      console.error("Failed to delete cloud preset:", error);
    }
  };

  const formatDate = (timestamp: number | Date) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden rounded-2xl bg-[#0a0b10]/95 backdrop-blur-xl border border-white/10 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-lg font-medium text-white/90">Snapshots & Presets</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-5 pt-4 gap-2">
            <button
              onClick={() => setActiveTab("local")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === "local"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              <HardDrive size={16} />
              Local Snapshots
            </button>
            <button
              onClick={() => setActiveTab("cloud")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === "cloud"
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              )}
            >
              <Cloud size={16} />
              Cloud Presets
              <span className="text-xs opacity-60">
                ({cloudCount.count}/{cloudCount.max})
              </span>
            </button>
          </div>

          {/* Save Form */}
          <div className="px-5 py-4 border-b border-white/5">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={activeTab === "local" ? "Snapshot name..." : "Preset name..."}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    activeTab === "local" ? handleSaveLocal() : handleSaveCloud();
                  }
                }}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/90 text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
              />
              <button
                onClick={activeTab === "local" ? handleSaveLocal : handleSaveCloud}
                disabled={!saveName.trim() || isSaving || (activeTab === "local" && !snapshotAPI)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                  activeTab === "local"
                    ? "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                    : "bg-violet-500/20 text-violet-300 hover:bg-violet-500/30"
                )}
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Save
              </button>
            </div>
            {activeTab === "local" && (
              <p className="mt-2 text-xs text-white/40">
                Saves full scene: settings, camera position, and particle state
              </p>
            )}
            {activeTab === "cloud" && (
              <p className="mt-2 text-xs text-white/40">
                Saves settings only (synced to your account)
              </p>
            )}
          </div>

          {/* List */}
          <div className="px-5 py-4 max-h-[40vh] overflow-y-auto">
            {activeTab === "local" ? (
              localSnapshots.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm">
                  No local snapshots yet
                </div>
              ) : (
                <div className="space-y-2">
                  {localSnapshots.map((snapshot) => (
                    <div
                      key={snapshot.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-colors group"
                    >
                      {/* Thumbnail */}
                      {snapshot.thumbnail ? (
                        <div className="w-16 h-12 rounded overflow-hidden flex-shrink-0">
                          <img
                            src={snapshot.thumbnail}
                            alt={snapshot.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-12 rounded bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                          <HardDrive size={20} className="text-cyan-400/50" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white/90 text-sm truncate">
                          {snapshot.name}
                        </div>
                        <div className="text-xs text-white/40">
                          {formatDate(snapshot.createdAt)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleLoadLocal(snapshot.id)}
                          disabled={isLoading}
                          className="p-2 rounded-lg hover:bg-cyan-500/20 text-cyan-400/70 hover:text-cyan-400 transition-colors"
                          title="Load snapshot"
                        >
                          {loadingId === snapshot.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Download size={16} />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteLocal(snapshot.id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-red-400/70 hover:text-red-400 transition-colors"
                          title="Delete snapshot"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : cloudPresets.length === 0 ? (
              <div className="text-center py-8 text-white/40 text-sm">
                {isPending ? (
                  <Loader2 size={24} className="animate-spin mx-auto" />
                ) : (
                  "No cloud presets yet"
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {cloudPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 hover:border-violet-500/30 transition-colors group"
                  >
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                      <Cloud size={20} className="text-violet-400/70" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white/90 text-sm truncate">
                        {preset.name}
                      </div>
                      <div className="text-xs text-white/40 flex items-center gap-2">
                        <span>{formatDate(preset.createdAt)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300/70 text-[10px] uppercase">
                          {preset.mode}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleLoadCloud(preset)}
                        className="p-2 rounded-lg hover:bg-violet-500/20 text-violet-400/70 hover:text-violet-400 transition-colors"
                        title="Load preset"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteCloud(preset.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-400/70 hover:text-red-400 transition-colors"
                        title="Delete preset"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

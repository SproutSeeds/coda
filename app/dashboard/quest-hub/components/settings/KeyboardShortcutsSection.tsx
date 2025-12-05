"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, RotateCcw } from "lucide-react";
import { SettingsSection } from "./SettingsSection";
import {
  useShortcutStore,
  useFormattedShortcuts,
  CATEGORY_LABELS,
  type ShortcutId,
  type ShortcutBinding,
  type ShortcutCategory,
} from "@/lib/shortcuts";

/**
 * Keyboard shortcuts customization section.
 * Allows users to rebind all shortcuts with a click-to-record interface.
 */
export function KeyboardShortcutsSection() {
  const shortcuts = useFormattedShortcuts();
  const { updateShortcut, resetShortcut, resetAll, isCustomized } = useShortcutStore();
  const [recordingId, setRecordingId] = useState<ShortcutId | null>(null);
  const [recordingLabel, setRecordingLabel] = useState("");

  // Start recording a new binding
  const startRecording = useCallback((id: ShortcutId, label: string) => {
    setRecordingId(id);
    setRecordingLabel(label);
  }, []);

  // Cancel recording
  const cancelRecording = useCallback(() => {
    setRecordingId(null);
    setRecordingLabel("");
  }, []);

  // Handle key recording
  useEffect(() => {
    if (!recordingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // ESC cancels recording
      if (e.key === "Escape") {
        cancelRecording();
        return;
      }

      // Ignore lone modifier keys
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
        return;
      }

      // Build the new binding
      const newBinding: ShortcutBinding = {
        key: e.key,
        modifiers: {
          shift: e.shiftKey,
          ctrl: e.ctrlKey,
          alt: e.altKey,
          meta: e.metaKey,
        },
      };

      // Clean up empty modifiers
      if (!newBinding.modifiers?.shift && !newBinding.modifiers?.ctrl &&
          !newBinding.modifiers?.alt && !newBinding.modifiers?.meta) {
        delete newBinding.modifiers;
      }

      updateShortcut(recordingId, newBinding);
      cancelRecording();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recordingId, updateShortcut, cancelRecording]);

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<ShortcutCategory, typeof shortcuts>);

  // Category order
  const categoryOrder: ShortcutCategory[] = ["flight", "animation", "zen", "cruise", "ui"];

  return (
    <>
      <SettingsSection
        title="Keyboard Shortcuts"
        icon={<Keyboard size={14} />}
        defaultOpen={false}
        accentColor="rgb(167, 139, 250)" // violet-400
      >
        <div className="space-y-4">
          {categoryOrder.map((category) => {
            const items = groupedShortcuts[category];
            if (!items || items.length === 0) return null;

            return (
              <div key={category}>
                <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">
                  {CATEGORY_LABELS[category]}
                </div>
                <div className="space-y-1">
                  {items.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between py-1.5 group"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-white/70 block truncate">
                          {shortcut.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Reset button (only if customized) */}
                        {isCustomized(shortcut.id) && (
                          <button
                            onClick={() => resetShortcut(shortcut.id)}
                            className="p-1 rounded opacity-0 group-hover:opacity-100
                                     hover:bg-white/10 text-white/40 hover:text-white/70
                                     transition-all"
                            title="Reset to default"
                          >
                            <RotateCcw size={10} />
                          </button>
                        )}
                        {/* Key binding button */}
                        <button
                          onClick={() => startRecording(shortcut.id, shortcut.label)}
                          className={`px-2 py-1 rounded text-[11px] font-mono min-w-[60px] text-center
                                    transition-all duration-200
                                    ${isCustomized(shortcut.id)
                                      ? "bg-violet-500/20 border border-violet-500/30 text-violet-300"
                                      : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80"
                                    }`}
                        >
                          {shortcut.formatted}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Reset All button */}
          <button
            onClick={resetAll}
            className="w-full mt-2 py-2 text-[10px] text-white/40 hover:text-white/60
                     hover:bg-white/5 rounded transition-colors"
          >
            Reset All to Defaults
          </button>
        </div>
      </SettingsSection>

      {/* Recording Modal */}
      <AnimatePresence>
        {recordingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center"
            onClick={cancelRecording}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative p-6 rounded-2xl bg-black/90 border border-white/20
                       text-center max-w-sm mx-4"
            >
              <div className="w-12 h-12 rounded-full bg-violet-500/20 border border-violet-500/30
                            flex items-center justify-center mx-auto mb-4">
                <Keyboard size={24} className="text-violet-400" />
              </div>
              <p className="text-white/60 text-sm mb-2">Press new key combination for:</p>
              <p className="text-white text-lg font-medium mb-4">{recordingLabel}</p>
              <p className="text-white/40 text-xs">Press ESC to cancel</p>

              {/* Animated border */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <motion.div
                  className="absolute inset-0 border-2 border-violet-500/50 rounded-2xl"
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

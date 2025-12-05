"use client";

import { useState, ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface SettingsSectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Optional accent color for the section header */
  accentColor?: string;
  /** Optional max height for scrollable content (e.g., "200px") */
  maxContentHeight?: string;
}

/**
 * Collapsible section for the settings panel.
 * Uses spring animation for smooth expand/collapse.
 */
export function SettingsSection({
  title,
  icon,
  defaultOpen = false,
  children,
  accentColor,
  maxContentHeight,
}: SettingsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/5 last:border-b-0">
      {/* Section Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between
                   text-white/70 hover:text-white hover:bg-white/5
                   transition-colors duration-200"
      >
        <div className="flex items-center gap-2">
          {icon && (
            <span
              className="opacity-60"
              style={accentColor ? { color: accentColor } : undefined}
            >
              {icon}
            </span>
          )}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <ChevronDown
          className="w-4 h-4 transition-transform duration-300"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}
        />
      </button>

      {/* Section Content */}
      <motion.div
        initial={false}
        animate={{
          height: isOpen ? "auto" : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="overflow-hidden"
      >
        <div
          className={`px-4 pb-4 pt-1 space-y-3 ${maxContentHeight ? 'overflow-y-auto overscroll-contain scrollbar-none' : ''}`}
          style={maxContentHeight ? { maxHeight: maxContentHeight } : undefined}
          onWheel={maxContentHeight ? (e) => e.stopPropagation() : undefined}
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Styled slider control for settings
 */
interface SettingsSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Show the value as a label */
  showValue?: boolean;
}

export function SettingsSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
  showValue = true,
}: SettingsSliderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-white/60 min-w-[60px]">{label}</label>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="settings-slider"
          style={{
            WebkitAppearance: 'none',
            appearance: 'none',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '9999px',
            height: '4px',
            cursor: 'pointer',
            flex: 1,
          }}
        />
        {showValue && (
          <span className="text-xs text-white/40 min-w-[40px] text-right font-mono">
            {value}
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Styled toggle switch for settings
 */
interface SettingsToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  accentColor?: string;
}

export function SettingsToggle({
  label,
  description,
  checked,
  onChange,
  accentColor = "rgb(34, 211, 238)", // cyan-400
}: SettingsToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-1 group"
    >
      <div className="text-left">
        <span className="text-xs text-white/70 group-hover:text-white/90 transition-colors">
          {label}
        </span>
        {description && (
          <span className="text-[10px] text-white/40 block">{description}</span>
        )}
      </div>
      <div
        className="w-8 h-4 rounded-full transition-all duration-300 relative"
        style={{
          backgroundColor: checked ? `${accentColor}40` : "rgba(255,255,255,0.1)",
          borderColor: checked ? `${accentColor}60` : "rgba(255,255,255,0.2)",
          borderWidth: "1px",
        }}
      >
        <div
          className="absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300"
          style={{
            left: checked ? "calc(100% - 14px)" : "2px",
            backgroundColor: checked ? accentColor : "rgba(255,255,255,0.6)",
            boxShadow: checked ? `0 0 6px ${accentColor}` : "none",
          }}
        />
      </div>
    </button>
  );
}

/**
 * Color picker button
 */
interface SettingsColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

export function SettingsColorPicker({
  label,
  value,
  onChange,
}: SettingsColorPickerProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs text-white/60">{label}</label>
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg cursor-pointer border border-white/10
                     bg-transparent appearance-none
                     [&::-webkit-color-swatch-wrapper]:p-0
                     [&::-webkit-color-swatch]:rounded-lg
                     [&::-webkit-color-swatch]:border-none"
        />
      </div>
    </div>
  );
}

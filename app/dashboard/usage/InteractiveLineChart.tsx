"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

import { formatUsageDayLabel } from "@/lib/utils/date";

export type ChartDataPoint = {
  date: string;
  [key: string]: number | string;
};

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
};

export type DateRange = 7 | 14 | 30 | "max";

type InteractiveLineChartProps = {
  data: ChartDataPoint[];
  series: ChartSeries[];
  height?: number;
  formatValue?: (value: number) => string;
  formatDate?: (date: string) => string;
  dateRange: DateRange;
  onRangeChange: (range: DateRange) => void;
};

const COLORS = {
  blue: "#3b82f6",
  purple: "#a855f7",
  cyan: "#06b6d4",
  orange: "#f97316",
  emerald: "#10b981",
  pink: "#ec4899",
  indigo: "#6366f1",
  rose: "#f43f5e",
  amber: "#f59e0b",
  teal: "#14b8a6",
};

export function InteractiveLineChart({
  data,
  series,
  height = 400,
  formatValue = (v) => `$${v.toFixed(2)}`,
  formatDate = (d) => formatUsageDayLabel(d),
  dateRange,
  onRangeChange,
}: InteractiveLineChartProps) {
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const themeMode = isMounted ? resolvedTheme : undefined;
  const axisColor = themeMode === "dark" ? "#f8fafc" : "#0f172a";
  const axisSecondary = themeMode === "dark" ? "rgba(148,163,184,0.35)" : "rgba(100,116,139,0.35)";
  const tooltipBackground = themeMode === "dark" ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.95)";
  const tooltipBorder = themeMode === "dark" ? "rgba(148,163,184,0.4)" : "rgba(15,23,42,0.15)";
  const tooltipText = themeMode === "dark" ? "#f8fafc" : "#0f172a";
  const tooltipMuted = themeMode === "dark" ? "#cbd5f5" : "#475569";
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; date: string; values: Record<string, number> } | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const rangeOptions: Array<{ value: DateRange; label: string }> = useMemo(
    () => [
      { value: 7, label: "7" },
      { value: 14, label: "14" },
      { value: 30, label: "30" },
      { value: "max", label: "MAX" },
    ],
    [],
  );
  const visibleSeries = useMemo(() => series.filter((s) => !hiddenSeries.has(s.key)), [series, hiddenSeries]);

  // Filter data based on selected date range
  const filteredData = useMemo(() => {
    if (data.length === 0 || dateRange === "max") return data;
    const endDate = new Date(data[data.length - 1].date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - dateRange);

    return data.filter((point) => {
      const pointDate = new Date(point.date);
      return pointDate >= startDate;
    });
  }, [data, dateRange]);

  // Chart dimensions - use 100% container width, no fixed width
  const padding = { top: 20, right: 20, bottom: 40, left: 70 };
  const chartHeight = height - padding.top - padding.bottom;

  // Use fixed viewBox width for consistent scaling
  const viewBoxWidth = 1200;
  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const { xScale, yScale, maxValue, minValue } = useMemo(() => {
    let max = 0;
    let min = Infinity;

    filteredData.forEach((point) => {
      visibleSeries.forEach((s) => {
        const value = Number(point[s.key]) || 0;
        if (value > 0) {
          max = Math.max(max, value);
          min = Math.min(min, value);
        }
      });
    });

    if (max === 0) {
      max = 1;
      min = 0;
    }
    if (min === Infinity) {
      min = 0;
    }

    const range = max - min;
    max = max + range * 0.2;
    min = Math.max(0, min - range * 0.1);

    const xScaleFn = (index: number) => (index / Math.max(filteredData.length - 1, 1)) * chartWidth;
    const yScaleFn = (value: number) => chartHeight - ((value - min) / (max - min || 1)) * chartHeight;

    return { xScale: xScaleFn, yScale: yScaleFn, maxValue: max, minValue: min };
  }, [filteredData, visibleSeries, chartWidth, chartHeight]);

  // Generate path for each series
  const generatePath = (seriesKey: string) => {
    const points = filteredData.map((point, i) => ({
      x: xScale(i),
      y: yScale(Number(point[seriesKey]) || 0),
    }));

    return points
      .map((point, i) => {
        if (i === 0) return `M ${point.x} ${point.y}`;

        // Smooth curves using cubic bezier
        const prevPoint = points[i - 1];
        const cpX1 = prevPoint.x + (point.x - prevPoint.x) / 3;
        const cpX2 = prevPoint.x + (2 * (point.x - prevPoint.x)) / 3;
        return `C ${cpX1} ${prevPoint.y}, ${cpX2} ${point.y}, ${point.x} ${point.y}`;
      })
      .join(" ");
  };

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) {
      return;
    }

    const relativeX = e.clientX - rect.left;
    const scaledX = (relativeX / rect.width) * viewBoxWidth;
    const x = scaledX - padding.left;

    if (x < 0 || x > chartWidth) {
      setHoveredPoint(null);
      return;
    }

    const index = Math.round((x / chartWidth) * (filteredData.length - 1));
    const point = filteredData[index];

    if (!point) return;

    const values: Record<string, number> = {};
    series.forEach((s) => {
      values[s.key] = Number(point[s.key]) || 0;
    });

    setHoveredPoint({
      x: xScale(index),
      date: point.date,
      values,
    });
  };

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const numTicks = 5;
    const ticks = [];
    for (let i = 0; i <= numTicks; i++) {
      const value = minValue + ((maxValue - minValue) / numTicks) * i;
      ticks.push(value);
    }
    return ticks;
  }, [minValue, maxValue]);

  // X-axis ticks (show every Nth day based on range)
  const xTicks = useMemo(() => {
    if (filteredData.length === 0) return filteredData;
    if (dateRange === "max") {
      const desiredTicks = 6;
      const step = Math.max(1, Math.floor(filteredData.length / desiredTicks));
      return filteredData.filter((_, i) => i % step === 0 || i === filteredData.length - 1);
    }
    const step = dateRange === 7 ? 1 : dateRange === 14 ? 2 : 5;
    return filteredData.filter((_, i) => i % step === 0 || i === filteredData.length - 1);
  }, [filteredData, dateRange]);

  const hoveredTooltip = useMemo(() => {
    if (!hoveredPoint || visibleSeries.length === 0) {
      return null;
    }

    const totalValue = visibleSeries.reduce((sum, s) => sum + (hoveredPoint.values[s.key] || 0), 0);
    const formattedTotal = formatValue(totalValue);

    const tooltipHeight = 58;
    const activePositions = visibleSeries
      .map((s) => {
        const value = hoveredPoint.values[s.key];
        if (!value) return null;
        return yScale(value);
      })
      .filter((value): value is number => typeof value === "number");

    const baseY = activePositions.length > 0 ? Math.min(...activePositions) : chartHeight / 2;
    const tooltipY = Math.max(0, baseY - tooltipHeight - 12);
    const tooltipWidth = Math.max(140, formattedTotal.length * 9 + 32);
    const tooltipX = Math.min(Math.max(hoveredPoint.x - tooltipWidth / 2, 0), chartWidth - tooltipWidth);

    return {
      value: formattedTotal,
      date: formatDate(hoveredPoint.date),
      width: tooltipWidth,
      height: tooltipHeight,
      x: tooltipX,
      y: tooltipY,
    };
  }, [hoveredPoint, visibleSeries, formatValue, formatDate, yScale, chartHeight, chartWidth]);

  return (
    <div className="w-full space-y-4">
      {/* Date Range Selector */}
      <div className="flex justify-center gap-2">
        {rangeOptions.map((option) => {
          const isActive = dateRange === option.value;
          const baseButtonClasses =
            "relative overflow-hidden rounded-full border px-5 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900/40 dark:focus-visible:ring-white/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900";
          const activeButtonClasses =
            "border-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-blue-500/30 dark:shadow-blue-400/30 scale-105";
          const inactiveButtonClasses =
            "border-slate-200/80 bg-white/70 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-slate-500";

          return (
            <button
              key={option.value}
              onClick={() => onRangeChange(option.value)}
              aria-pressed={isActive}
              className={`${baseButtonClasses} ${isActive ? activeButtonClasses : inactiveButtonClasses}`}
            >
              <span className="text-base font-bold tracking-wide">{option.label}</span>
              {option.value !== "max" && (
                <span className={`ml-1 text-xs uppercase ${isActive ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}>
                  Days
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="w-full">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${height}`}
          className="w-full h-auto"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={COLORS[s.color as keyof typeof COLORS] || s.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={COLORS[s.color as keyof typeof COLORS] || s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          <g transform={`translate(${padding.left}, ${padding.top})`} style={{ color: axisSecondary }}>
            {/* Grid lines */}
            {yTicks.map((tick, i) => (
              <line
                key={i}
                x1={0}
                x2={chartWidth}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeWidth={1}
              />
            ))}

            {/* X-axis */}
            <line
              x1={0}
              x2={chartWidth}
              y1={chartHeight}
              y2={chartHeight}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeWidth={2}
            />

            {/* Y-axis */}
            <line
              x1={0}
              x2={0}
              y1={0}
              y2={chartHeight}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeWidth={2}
            />

            {/* Y-axis labels */}
            {yTicks.map((tick, i) => (
              <text
                key={i}
                x={-10}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill={axisColor}
                style={{ fill: axisColor }}
                className="text-xs font-semibold"
              >
                {formatValue(tick)}
              </text>
            ))}

            {/* X-axis labels */}
            {xTicks.map((point, i) => {
              const index = filteredData.indexOf(point);
              return (
                <text
                  key={i}
                  x={xScale(index)}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fill={axisColor}
                  style={{ fill: axisColor }}
                  className="text-xs font-semibold"
                >
                  {formatDate(point.date)}
                </text>
              );
            })}

            {/* Area fills */}
            {visibleSeries
              .filter((s) => {
                // Only show if there's any non-zero data
                return filteredData.some((point) => Number(point[s.key]) > 0);
              })
              .map((s) => {
                const linePath = generatePath(s.key);
                const areaPath = `${linePath} L ${xScale(filteredData.length - 1)} ${chartHeight} L 0 ${chartHeight} Z`;

                return (
                  <path
                    key={`area-${s.key}`}
                    d={areaPath}
                    fill={`url(#gradient-${s.key})`}
                    opacity={0.3}
                  />
                );
              })}

            {/* Lines */}
            {visibleSeries
              .filter((s) => {
                // Only show if there's any non-zero data
                return filteredData.some((point) => Number(point[s.key]) > 0);
              })
              .map((s) => (
                <motion.path
                  key={s.key}
                  d={generatePath(s.key)}
                  fill="none"
                  stroke={COLORS[s.color as keyof typeof COLORS] || s.color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1, ease: "easeInOut" }}
                />
              ))}

            {/* Hover line and points */}
            {hoveredPoint && (
              <>
                <line
                  x1={hoveredPoint.x}
                  x2={hoveredPoint.x}
                  y1={0}
                  y2={chartHeight}
                  stroke="currentColor"
                  strokeOpacity={0.3}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />

                {visibleSeries.map((s) => {
                    const value = hoveredPoint.values[s.key];
                    if (value === undefined || value === 0) return null;

                    return (
                      <circle
                        key={s.key}
                        cx={hoveredPoint.x}
                        cy={yScale(value)}
                        r={5}
                        fill={COLORS[s.color as keyof typeof COLORS] || s.color}
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  })}

                {hoveredTooltip && (
                  <g transform={`translate(${hoveredTooltip.x}, ${hoveredTooltip.y})`} pointerEvents="none">
                    <rect
                      width={hoveredTooltip.width}
                      height={hoveredTooltip.height}
                      rx={12}
                      fill={tooltipBackground}
                      stroke={tooltipBorder}
                      strokeWidth={1}
                      opacity={0.98}
                    />
                    <text
                      x={hoveredTooltip.width / 2}
                      y={hoveredTooltip.height / 2 - 4}
                      textAnchor="middle"
                      fill={tooltipText}
                      style={{ fontSize: 18, fontWeight: 700 }}
                    >
                      {hoveredTooltip.value}
                    </text>
                    <text
                      x={hoveredTooltip.width / 2}
                      y={hoveredTooltip.height - 14}
                      textAnchor="middle"
                      fill={tooltipMuted}
                      style={{ fontSize: 12, fontWeight: 500 }}
                    >
                      {hoveredTooltip.date}
                    </text>
                  </g>
                )}
              </>
            )}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3">
        {series.map((s) => {
          const isHidden = hiddenSeries.has(s.key);
          const hasData = filteredData.some((point) => Number(point[s.key]) > 0);

          return (
            <button
              key={s.key}
              onClick={() => toggleSeries(s.key)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                isHidden
                  ? "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:text-white"
                  : "border-slate-200 bg-white text-slate-900 shadow-sm hover:-translate-y-0.5 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              }`}
            >
              <div
                className="h-3 w-3 rounded-full border border-white/50 transition-all dark:border-slate-900/60"
                style={{
                  backgroundColor: hasData
                    ? COLORS[s.color as keyof typeof COLORS] || s.color
                    : `${(COLORS[s.color as keyof typeof COLORS] || s.color)}40`,
                  boxShadow: !hasData ? "inset 0 0 0 1px rgba(0,0,0,0.1)" : undefined,
                  opacity: isHidden ? 0.4 : 1,
                }}
              />
              <span className={`${isHidden ? "line-through opacity-70" : ""} text-slate-800 dark:text-slate-100`}>{s.label}</span>
              {!hasData && <span className="text-xs text-slate-400 dark:text-slate-400">(no data)</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

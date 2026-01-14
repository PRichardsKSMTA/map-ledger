import React, { useState } from 'react';
import { formatCurrencyAmount } from '../../utils/currency';

interface SparklineProps {
  data: number[];
  labels?: string[];
  width?: number;
  height?: number;
  strokeColor?: string;
  fillColor?: string;
  className?: string;
  /** If true, tooltip "value" label uses blue (revenue). If false, uses red (expense). Default: true */
  isRevenue?: boolean;
}

interface TooltipData {
  x: number;
  y: number;
  label: string;
  value: number;
}

/**
 * Lightweight SVG-based sparkline component for trend visualization with hover tooltips.
 * No external dependencies required.
 */
const Sparkline: React.FC<SparklineProps> = ({
  data,
  labels,
  width = 400,
  height = 80,
  strokeColor = '#3b82f6',
  fillColor = '#3b82f6',
  className = '',
  isRevenue = true,
}) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  if (!data || data.length === 0) {
    return null;
  }

  const padding = { top: 10, right: 10, bottom: 20, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxValue = Math.max(...data, 1);
  const minValue = Math.min(...data, 0);
  const valueRange = maxValue - minValue || 1;

  // Calculate points
  const points = data.map((value, index) => {
    const x = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
    return { x, y, value };
  });

  // Create path for the line
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Create path for the fill area
  const fillPath = `
    M ${points[0].x} ${padding.top + chartHeight}
    ${points.map(point => `L ${point.x} ${point.y}`).join(' ')}
    L ${points[points.length - 1].x} ${padding.top + chartHeight}
    Z
  `;

  const handlePointHover = (index: number, x: number, y: number, value: number) => {
    const label = labels?.[index] ?? `Point ${index + 1}`;
    setTooltip({ x, y, label, value });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  // Calculate tooltip position to keep it within bounds
  const getTooltipStyle = (): React.CSSProperties => {
    if (!tooltip) return {};

    const tooltipWidth = 140;
    const tooltipHeight = 50;

    let left = tooltip.x - tooltipWidth / 2;
    let top = tooltip.y - tooltipHeight - 12;

    // Keep within left/right bounds
    if (left < 5) left = 5;
    if (left + tooltipWidth > width - 5) left = width - tooltipWidth - 5;

    // If tooltip would go above chart, show below
    if (top < 5) {
      top = tooltip.y + 12;
    }

    return {
      left: `${left}px`,
      top: `${top}px`,
    };
  };

  return (
    <div className={`relative ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-label="Trend chart"
        onMouseLeave={handleMouseLeave}
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id="sparkline-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <path d={fillPath} fill="url(#sparkline-gradient)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Invisible hover zones for each data point (larger hit area) */}
        {points.map((point, index) => (
          <rect
            key={`hover-${index}`}
            x={point.x - 15}
            y={padding.top}
            width={30}
            height={chartHeight}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => handlePointHover(index, point.x, point.y, point.value)}
          />
        ))}

        {/* Data points */}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={tooltip?.label === (labels?.[index] ?? `Point ${index + 1}`) ? 5 : 3}
            fill="white"
            stroke={strokeColor}
            strokeWidth="2"
            className="pointer-events-none transition-all duration-150"
          />
        ))}

        {/* Vertical indicator line when hovering */}
        {tooltip && (
          <line
            x1={tooltip.x}
            y1={padding.top}
            x2={tooltip.x}
            y2={padding.top + chartHeight}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="3,3"
            className="pointer-events-none"
          />
        )}

        {/* X-axis labels */}
        {labels && labels.length === data.length && (
          <g className="text-xs fill-slate-500 dark:fill-slate-400">
            {labels.map((label, index) => {
              const x = padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
              return (
                <text
                  key={index}
                  x={x}
                  y={height - 4}
                  textAnchor="middle"
                  fontSize="10"
                  className="fill-slate-500 dark:fill-slate-400"
                >
                  {label}
                </text>
              );
            })}
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-800"
          style={getTooltipStyle()}
        >
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {tooltip.label}
          </div>
          <div className="mt-0.5 text-sm">
            <span className={isRevenue ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}>value : </span>
            <span className="font-medium text-slate-900 dark:text-white">
              {formatCurrencyAmount(tooltip.value)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sparkline;

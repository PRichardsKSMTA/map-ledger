import React, { useState } from 'react';
import { formatCurrencyAmount } from '../../utils/currency';

interface DualLineChartProps {
  revenueData: number[];
  expenseData: number[];
  labels: string[];
  width?: number;
  height?: number;
  className?: string;
}

interface TooltipData {
  x: number;
  y: number;
  label: string;
  revenue: number;
  expenses: number;
}

/**
 * Dual-line SVG chart showing Revenue and Expenses trends with hover tooltips.
 */
const DualLineChart: React.FC<DualLineChartProps> = ({
  revenueData,
  expenseData,
  labels,
  width = 800,
  height = 250,
  className = '',
}) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  if (!revenueData || revenueData.length === 0) {
    return null;
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate min/max across both datasets
  const allValues = [...revenueData, ...expenseData];
  const maxValue = Math.max(...allValues, 1);
  const minValue = 0; // Start from 0 for financial charts

  const valueRange = maxValue - minValue || 1;

  // Generate Y-axis ticks
  const yTickCount = 5;
  const yTicks: number[] = [];
  for (let i = 0; i <= yTickCount; i++) {
    yTicks.push(minValue + (valueRange * i) / yTickCount);
  }

  // Calculate points for revenue line
  const revenuePoints = revenueData.map((value, index) => {
    const x = padding.left + (index / Math.max(revenueData.length - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
    return { x, y, value };
  });

  // Calculate points for expense line
  const expensePoints = expenseData.map((value, index) => {
    const x = padding.left + (index / Math.max(expenseData.length - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
    return { x, y, value };
  });

  // Create path for revenue line
  const revenuePath = revenuePoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Create path for expense line
  const expensePath = expensePoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Create fill path for revenue (above expense)
  const revenueFillPath = `
    M ${revenuePoints[0].x} ${padding.top + chartHeight}
    ${revenuePoints.map(point => `L ${point.x} ${point.y}`).join(' ')}
    L ${revenuePoints[revenuePoints.length - 1].x} ${padding.top + chartHeight}
    Z
  `;

  // Create fill path for expense
  const expenseFillPath = `
    M ${expensePoints[0].x} ${padding.top + chartHeight}
    ${expensePoints.map(point => `L ${point.x} ${point.y}`).join(' ')}
    L ${expensePoints[expensePoints.length - 1].x} ${padding.top + chartHeight}
    Z
  `;

  const formatYLabel = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(0)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const handlePointHover = (index: number, x: number, y: number) => {
    setTooltip({
      x,
      y,
      label: labels[index],
      revenue: revenueData[index],
      expenses: expenseData[index],
    });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  // Calculate tooltip position to keep it within bounds
  const getTooltipStyle = (): React.CSSProperties => {
    if (!tooltip) return {};

    const tooltipWidth = 180;
    const tooltipHeight = 80;

    let left = tooltip.x - tooltipWidth / 2;
    let top = tooltip.y - tooltipHeight - 15;

    // Keep within left/right bounds
    if (left < 10) left = 10;
    if (left + tooltipWidth > width - 10) left = width - tooltipWidth - 10;

    // If tooltip would go above chart, show below
    if (top < 5) {
      top = tooltip.y + 15;
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
        aria-label="Revenue and Expenses trend chart"
        onMouseLeave={handleMouseLeave}
      >
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="revenue-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="expense-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {yTicks.map((tick, index) => {
          const y = padding.top + chartHeight - ((tick - minValue) / valueRange) * chartHeight;
          return (
            <g key={index}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + chartWidth}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
                strokeDasharray={index === 0 ? '0' : '4,4'}
                className="dark:stroke-slate-700"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                className="fill-slate-500 dark:fill-slate-400"
              >
                {formatYLabel(tick)}
              </text>
            </g>
          );
        })}

        {/* Revenue fill area */}
        <path d={revenueFillPath} fill="url(#revenue-gradient)" />

        {/* Expense fill area */}
        <path d={expenseFillPath} fill="url(#expense-gradient)" />

        {/* Revenue line */}
        <path
          d={revenuePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Expense line */}
        <path
          d={expensePath}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Invisible hover zones for each data point (larger hit area) */}
        {revenuePoints.map((point, index) => (
          <rect
            key={`hover-${index}`}
            x={point.x - 20}
            y={padding.top}
            width={40}
            height={chartHeight}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => handlePointHover(index, point.x, Math.min(point.y, expensePoints[index].y))}
          />
        ))}

        {/* Revenue data points */}
        {revenuePoints.map((point, index) => (
          <circle
            key={`rev-${index}`}
            cx={point.x}
            cy={point.y}
            r={tooltip?.label === labels[index] ? 6 : 4}
            fill="white"
            stroke="#3b82f6"
            strokeWidth="2"
            className="pointer-events-none transition-all duration-150"
          />
        ))}

        {/* Expense data points */}
        {expensePoints.map((point, index) => (
          <circle
            key={`exp-${index}`}
            cx={point.x}
            cy={point.y}
            r={tooltip?.label === labels[index] ? 6 : 4}
            fill="white"
            stroke="#ef4444"
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
            strokeDasharray="4,4"
            className="pointer-events-none"
          />
        )}

        {/* X-axis labels */}
        {labels.map((label, index) => {
          const x = padding.left + (index / Math.max(labels.length - 1, 1)) * chartWidth;
          return (
            <text
              key={index}
              x={x}
              y={height - 12}
              textAnchor="middle"
              fontSize="12"
              className="fill-slate-500 dark:fill-slate-400"
            >
              {label}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg dark:border-slate-700 dark:bg-slate-800"
          style={getTooltipStyle()}
        >
          <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            {tooltip.label}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400">Revenue :</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {formatCurrencyAmount(tooltip.revenue)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-600 dark:text-red-400">Expenses :</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {formatCurrencyAmount(tooltip.expenses)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-4 rounded bg-blue-500" />
          <span className="text-slate-600 dark:text-slate-400">Revenue</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-4 rounded bg-red-500" />
          <span className="text-slate-600 dark:text-slate-400">Expenses</span>
        </div>
      </div>
    </div>
  );
};

export default DualLineChart;

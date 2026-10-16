import React, { useState, useId } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { TestSession, BiomarkerResult, ResultStatus } from '../types/clinical';

export interface BiomarkerSparklineProps {
  biomarkerId: string;
  currentResult: BiomarkerResult;
  currentSessionDate: string;
  allSessions: TestSession[];
  windowMonths?: number; // default 6
  width?: number; // default 110
  height?: number; // default 32
  onSelectBiomarker?: (biomarkerId: string) => void;
}

interface SparklinePoint {
  date: string;
  value: number;
  status: ResultStatus;
  flag?: string;
  refLow: number;
  refHigh: number;
  isCurrent: boolean;
  x: number;
  y: number;
}

export const BiomarkerSparkline: React.FC<BiomarkerSparklineProps> = ({
  biomarkerId,
  currentResult,
  currentSessionDate,
  allSessions,
  windowMonths = 6,
  width = 110,
  height = 32,
  onSelectBiomarker,
}) => {
  const gradientId = useId();
  const [hoveredPoint, setHoveredPoint] = useState<SparklinePoint | null>(null);

  // 1. Gather all chronological data points for this biomarker up to current session date
  const sortedSessions = [...allSessions].sort(
    (a, b) => new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime()
  );

  const currentDateObj = new Date(currentSessionDate);
  // Trailing window (e.g., 6 months ≈ 185 days buffer for bi-annual cadence)
  const windowDays = windowMonths === 6 ? 195 : windowMonths * 31;
  const cutoffTime = currentDateObj.getTime() - windowDays * 24 * 60 * 60 * 1000;

  // Filter to window up to current session
  const windowSessions = sortedSessions.filter((sess) => {
    const sessTime = new Date(sess.collectionDate).getTime();
    return sessTime <= currentDateObj.getTime() && sessTime >= cutoffTime;
  });

  // Extract analyte results for these sessions
  const rawPoints: {
    date: string;
    value: number;
    status: ResultStatus;
    flag?: string;
    refLow: number;
    refHigh: number;
    isCurrent: boolean;
  }[] = [];

  for (const sess of windowSessions) {
    const res = sess.results.find((r) => r.biomarkerId === biomarkerId);
    if (res && typeof res.resultValue === 'number' && !isNaN(res.resultValue)) {
      rawPoints.push({
        date: sess.collectionDate,
        value: res.resultValue,
        status: res.status,
        flag: res.flag,
        refLow: res.refLow,
        refHigh: res.refHigh,
        isCurrent: sess.collectionDate === currentSessionDate,
      });
    }
  }

  // Ensure current result is included if for some reason not in windowSessions
  if (rawPoints.length === 0 && currentResult) {
    rawPoints.push({
      date: currentSessionDate,
      value: currentResult.resultValue,
      status: currentResult.status,
      flag: currentResult.flag,
      refLow: currentResult.refLow,
      refHigh: currentResult.refHigh,
      isCurrent: true,
    });
  }

  // Check if earlier historical sessions exist outside this 6mo window
  const allHistoricalResults = sortedSessions
    .map((s) => ({
      date: s.collectionDate,
      res: s.results.find((r) => r.biomarkerId === biomarkerId),
    }))
    .filter((item) => item.res && new Date(item.date).getTime() < cutoffTime);

  const priorOutdatedCount = allHistoricalResults.length;
  const lastPriorResult = priorOutdatedCount > 0 ? allHistoricalResults[priorOutdatedCount - 1] : null;

  // 2. Metrics calculation
  const pointCount = rawPoints.length;
  const firstPoint = rawPoints[0];
  const lastPoint = rawPoints[rawPoints.length - 1];
  const delta = pointCount >= 2 ? lastPoint.value - firstPoint.value : 0;
  const deltaPct =
    pointCount >= 2 && firstPoint.value !== 0
      ? ((lastPoint.value - firstPoint.value) / Math.abs(firstPoint.value)) * 100
      : 0;

  // Trend direction
  const isUp = delta > 0 && Math.abs(deltaPct) >= 1.0;
  const isDown = delta < 0 && Math.abs(deltaPct) >= 1.0;
  const isStable = Math.abs(deltaPct) < 1.0;

  // Determine line/accent color based on status and shift
  const isAbnormalLatest =
    lastPoint.status !== 'Normal' || (lastPoint.flag && lastPoint.flag !== '');
  const isCritical =
    lastPoint.status.includes('Critical') || (lastPoint.flag && lastPoint.flag.includes('C'));

  const strokeColor = isCritical
    ? '#e11d48' // rose-600
    : isAbnormalLatest
    ? '#d97706' // amber-600
    : '#059669'; // emerald-600

  const fillColor = isCritical
    ? 'rgba(225, 29, 72, 0.12)'
    : isAbnormalLatest
    ? 'rgba(217, 119, 6, 0.12)'
    : 'rgba(5, 150, 105, 0.12)';

  // 3. SVG Coordinates mapping
  const paddingX = 6;
  const paddingY = 6;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const values = rawPoints.map((p) => p.value);
  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);

  // If min and max are equal (or only 1 point), create synthetic bounds
  if (minVal === maxVal) {
    const val = minVal;
    minVal = val * 0.95;
    maxVal = val * 1.05;
    if (minVal === maxVal) {
      minVal = 0;
      maxVal = 10;
    }
  } else {
    // Add 10% breathing room
    const range = maxVal - minVal;
    minVal -= range * 0.12;
    maxVal += range * 0.12;
  }

  const valSpan = maxVal - minVal || 1;

  // Calculate points on SVG
  const points: SparklinePoint[] = rawPoints.map((pt, idx) => {
    const x =
      pointCount === 1
        ? paddingX + innerWidth / 2
        : paddingX + (idx / (pointCount - 1)) * innerWidth;
    const y = paddingY + innerHeight - ((pt.value - minVal) / valSpan) * innerHeight;
    return {
      ...pt,
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
    };
  });

  // Build SVG Path
  let linePath = '';
  let areaPath = '';

  if (points.length >= 2) {
    linePath = points.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');

    const first = points[0];
    const last = points[points.length - 1];
    areaPath = `${linePath} L ${last.x} ${height - paddingY} L ${first.x} ${height - paddingY} Z`;
  }

  // Calculate reference bounds inside SVG if visible
  const refLowY =
    currentResult.refLow >= minVal && currentResult.refLow <= maxVal
      ? paddingY + innerHeight - ((currentResult.refLow - minVal) / valSpan) * innerHeight
      : null;

  const refHighY =
    currentResult.refHigh >= minVal && currentResult.refHigh <= maxVal
      ? paddingY + innerHeight - ((currentResult.refHigh - minVal) / valSpan) * innerHeight
      : null;

  return (
    <div className="relative inline-flex items-center gap-2 group select-none">
      {/* Sparkline Canvas Container */}
      <div
        className="relative bg-slate-50/80 rounded-md border border-slate-200/80 p-0.5 hover:border-slate-300 transition-colors cursor-pointer"
        onClick={() => onSelectBiomarker?.(biomarkerId)}
        title="Click to view full biomarker longitudinal trend"
      >
        <svg
          width={width}
          height={height}
          className="overflow-visible block"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id={`grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Reference range faint guideline band if both present */}
          {refLowY !== null && refHighY !== null && (
            <rect
              x={paddingX}
              y={Math.min(refLowY, refHighY)}
              width={innerWidth}
              height={Math.abs(refLowY - refHighY)}
              fill="rgba(16, 185, 129, 0.05)"
              stroke="none"
            />
          )}

          {/* Faint reference threshold guide lines */}
          {refHighY !== null && (
            <line
              x1={paddingX}
              y1={refHighY}
              x2={width - paddingX}
              y2={refHighY}
              stroke="#94a3b8"
              strokeWidth="0.75"
              strokeDasharray="2,2"
              opacity="0.5"
            />
          )}
          {refLowY !== null && (
            <line
              x1={paddingX}
              y1={refLowY}
              x2={width - paddingX}
              y2={refLowY}
              stroke="#94a3b8"
              strokeWidth="0.75"
              strokeDasharray="2,2"
              opacity="0.5"
            />
          )}

          {/* Sparkline Area Fill */}
          {areaPath && <path d={areaPath} fill={`url(#grad-${gradientId})`} />}

          {/* Sparkline Stroke Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Single Point Baseline Line if only 1 test in window */}
          {pointCount === 1 && (
            <line
              x1={paddingX}
              y1={points[0].y}
              x2={width - paddingX}
              y2={points[0].y}
              stroke={strokeColor}
              strokeWidth="1.2"
              strokeDasharray="3,3"
              opacity="0.6"
            />
          )}

          {/* Data Points */}
          {points.map((pt, idx) => {
            const isHovered = hoveredPoint?.date === pt.date;
            return (
              <g key={pt.date} onMouseEnter={() => setHoveredPoint(pt)} className="cursor-pointer">
                {/* Hit area */}
                <circle cx={pt.x} cy={pt.y} r={7} fill="transparent" />

                {/* Outer ring for current point */}
                {pt.isCurrent && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 5.5 : 4.5}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    opacity="0.4"
                    className="animate-pulse"
                  />
                )}

                {/* Solid Dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={pt.isCurrent ? 3 : isHovered ? 3.5 : 2}
                  fill={isHovered ? '#1e293b' : strokeColor}
                  stroke="#ffffff"
                  strokeWidth={pt.isCurrent ? 1.5 : 1}
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip for hovered point */}
        {hoveredPoint && (
          <div
            className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-slate-900 text-white text-3xs rounded-md shadow-lg pointer-events-none whitespace-nowrap min-w-[120px]"
            style={{ animation: 'fadeIn 0.15s ease-out' }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-0.5 mb-1 font-mono">
              <span className="text-slate-400">{hoveredPoint.date}</span>
              {hoveredPoint.isCurrent && (
                <span className="text-2xs text-blue-400 font-sans font-semibold">Current</span>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-xs text-white">
                {hoveredPoint.value} {currentResult.unitMeasured}
              </span>
              <span
                className={`font-semibold ${
                  hoveredPoint.status === 'Normal'
                    ? 'text-emerald-400'
                    : hoveredPoint.status.includes('Critical')
                    ? 'text-rose-400'
                    : 'text-amber-400'
                }`}
              >
                {hoveredPoint.status}
              </span>
            </div>
            <div className="text-slate-400 text-3xs mt-0.5">
              Ref: {hoveredPoint.refLow} – {hoveredPoint.refHigh} {currentResult.unitMeasured}
            </div>
          </div>
        )}
      </div>

      {/* Delta Badge & Status Summary */}
      <div className="flex flex-col text-left shrink-0 min-w-[58px]">
        {pointCount >= 2 ? (
          <>
            <div
              className={`flex items-center gap-0.5 text-2xs font-bold font-mono tabular-nums ${
                isAbnormalLatest && (isUp || isDown)
                  ? 'text-amber-700'
                  : isUp
                  ? 'text-emerald-700'
                  : isDown
                  ? 'text-blue-700'
                  : 'text-slate-600'
              }`}
            >
              {isUp && <TrendingUp className="w-3 h-3 shrink-0" />}
              {isDown && <TrendingDown className="w-3 h-3 shrink-0" />}
              {isStable && <Minus className="w-3 h-3 shrink-0 text-slate-400" />}
              <span>
                {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-3xs text-slate-500 font-mono">
              <span>{deltaPct > 0 ? `+${deltaPct.toFixed(0)}%` : `${deltaPct.toFixed(0)}%`}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-400 font-sans">{pointCount} pts</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col text-3xs text-slate-500 leading-tight">
            <span className="font-medium text-slate-600 flex items-center gap-1">
              <span>Baseline</span>
              {priorOutdatedCount > 0 && (
                <span
                  title={`${priorOutdatedCount} older test(s) prior to 6-mo window (Last: ${lastPriorResult?.date})`}
                  className="cursor-help text-indigo-600 font-bold"
                >
                  *
                </span>
              )}
            </span>
            <span className="text-slate-400 text-3xs font-mono">1 pt in 6mo</span>
          </div>
        )}
      </div>
    </div>
  );
};

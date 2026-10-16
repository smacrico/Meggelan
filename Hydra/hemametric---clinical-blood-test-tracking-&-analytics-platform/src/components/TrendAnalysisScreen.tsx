import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Filter,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Search,
  X,
  SlidersHorizontal,
  Activity,
  Sparkles,
} from 'lucide-react';
import {
  PatientProfile,
  TestSession,
  BiomarkerCategory,
} from '../types/clinical';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';
import { PatientTrendAiSummary } from './PatientTrendAiSummary';

interface TrendAnalysisScreenProps {
  profile: PatientProfile;
  sessions: TestSession[];
}

const CLINICAL_CATEGORIES: string[] = [
  'All',
  'Lipid Profile',
  'Hematology & CBC',
  'Metabolic & Glycemic',
  'Liver Function',
  'Renal & Electrolytes',
  'Iron Status',
  'Inflammatory Markers',
  'Vitamins & Minerals',
];

export const TrendAnalysisScreen: React.FC<TrendAnalysisScreenProps> = ({
  profile,
  sessions,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [primaryBiomarkerId, setPrimaryBiomarkerId] = useState<string>('bm-ferr');
  const [secondaryBiomarkerId, setSecondaryBiomarkerId] = useState<string>('bm-hgb');
  const [dateRange, setDateRange] = useState<'all' | '1y' | '2y'>('all');
  const [showSecondaryOverlay, setShowSecondaryOverlay] = useState<boolean>(true);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: MASTER_BIOMARKER_CATALOG.length };
    MASTER_BIOMARKER_CATALOG.forEach((b) => {
      counts[b.category] = (counts[b.category] || 0) + 1;
    });
    return counts;
  }, []);

  // Filtered biomarkers matching search and category
  const filteredCatalog = useMemo(() => {
    let list = MASTER_BIOMARKER_CATALOG;

    if (selectedCategory !== 'All') {
      list = list.filter((b) => b.category === selectedCategory);
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((b) => {
        const nameMatch = b.name.toLowerCase().includes(q);
        const codeMatch = b.code.toLowerCase().includes(q);
        const catMatch = b.category.toLowerCase().includes(q);
        const idMatch = b.biomarkerId.toLowerCase().includes(q);
        const descMatch = b.description.toLowerCase().includes(q);

        // Clinical panel aliases
        const isCbcQuery = (q === 'cbc' || q === 'blood count') && b.category === 'Hematology & CBC';
        const isLipidQuery = (q === 'lipid' || q === 'lipids' || q === 'lipid panel') && b.category === 'Lipid Profile';
        const isLiverQuery = (q === 'lft' || q === 'liver' || q === 'hepatic') && b.category === 'Liver Function';
        const isRenalQuery = (q === 'kft' || q === 'renal' || q === 'kidney') && b.category === 'Renal & Electrolytes';
        const isMetabolicQuery = (q === 'cmp' || q === 'bmp' || q === 'metabolic') && (b.category === 'Metabolic & Glycemic' || b.category === 'Renal & Electrolytes');

        return nameMatch || codeMatch || catMatch || idMatch || descMatch || isCbcQuery || isLipidQuery || isLiverQuery || isRenalQuery || isMetabolicQuery;
      });
    }

    return list;
  }, [selectedCategory, searchQuery]);

  // Chronologically sorted sessions
  const sortedSessions = useMemo(() => {
    return [...sessions].sort(
      (a, b) => new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime()
    );
  }, [sessions]);

  // Filter sessions by observation time horizon
  const filteredSessions = useMemo(() => {
    if (dateRange === 'all' || sortedSessions.length === 0) return sortedSessions;
    const latestDate = new Date(sortedSessions[sortedSessions.length - 1].collectionDate);
    const monthsBack = dateRange === '1y' ? 12 : 24;
    const cutoff = new Date(latestDate.getFullYear(), latestDate.getMonth() - monthsBack, latestDate.getDate());
    const subset = sortedSessions.filter((s) => new Date(s.collectionDate) >= cutoff);
    return subset.length > 0 ? subset : sortedSessions;
  }, [sortedSessions, dateRange]);

  // Real-time biomarker baseline & trend insights for the quick-pick grid
  const biomarkerInsights = useMemo(() => {
    const map = new Map<string, { latestVal?: number; latestStatus?: string; latestUnit?: string; trend?: 'up' | 'down' | 'stable' }>();

    MASTER_BIOMARKER_CATALOG.forEach((item) => {
      const history: { val: number; date: string; status: string; unit: string }[] = [];
      sortedSessions.forEach((s) => {
        const res = s.results.find((r) => r.biomarkerId === item.biomarkerId);
        if (res) {
          history.push({ val: res.resultValue, date: s.collectionDate, status: res.status, unit: res.unitMeasured });
        }
      });

      if (history.length > 0) {
        const latest = history[history.length - 1];
        const prev = history.length > 1 ? history[history.length - 2] : null;
        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (prev) {
          if (latest.val > prev.val * 1.03) trend = 'up';
          else if (latest.val < prev.val * 0.97) trend = 'down';
        }
        map.set(item.biomarkerId, {
          latestVal: latest.val,
          latestStatus: latest.status,
          latestUnit: latest.unit,
          trend,
        });
      }
    });

    return map;
  }, [sortedSessions]);

  // Extract time series for primary biomarker
  const primarySeries = useMemo(() => {
    const list: { date: string; value: number; unit: string; sessionId: string; status: string }[] = [];
    filteredSessions.forEach((sess) => {
      const match = sess.results.find((r) => r.biomarkerId === primaryBiomarkerId);
      if (match) {
        list.push({
          date: sess.collectionDate,
          value: match.resultValue,
          unit: match.unitMeasured,
          sessionId: sess.sessionId,
          status: match.status,
        });
      }
    });
    return list;
  }, [filteredSessions, primaryBiomarkerId]);

  // Extract time series for secondary biomarker
  const secondarySeries = useMemo(() => {
    if (!showSecondaryOverlay || !secondaryBiomarkerId) return [];
    const list: { date: string; value: number; unit: string; sessionId: string }[] = [];
    filteredSessions.forEach((sess) => {
      const match = sess.results.find((r) => r.biomarkerId === secondaryBiomarkerId);
      if (match) {
        list.push({
          date: sess.collectionDate,
          value: match.resultValue,
          unit: match.unitMeasured,
          sessionId: sess.sessionId,
        });
      }
    });
    return list;
  }, [filteredSessions, secondaryBiomarkerId, showSecondaryOverlay]);

  const primaryItem = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === primaryBiomarkerId);
  const secondaryItem = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === secondaryBiomarkerId);

  const isFemale = profile.gender === 'Female';
  const refLow = primaryItem ? (isFemale ? primaryItem.refLowFemale : primaryItem.refLowMale) : 0;
  const refHigh = primaryItem ? (isFemale ? primaryItem.refHighFemale : primaryItem.refHighMale) : 100;

  // Chart layout calculations
  const chartGeometry = useMemo(() => {
    if (primarySeries.length === 0) return null;

    const values = primarySeries.map((s) => s.value);
    const minVal = Math.min(...values, refLow) * 0.85;
    const maxVal = Math.max(...values, refHigh) * 1.15;
    const valRange = maxVal - minVal || 1;

    const width = 760;
    const height = 260;
    const padX = 45;
    const padY = 30;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    const t0 = new Date(primarySeries[0].date).getTime();
    const tEnd = new Date(primarySeries[primarySeries.length - 1].date).getTime();
    const timeSpan = tEnd - t0 || 1;

    const getX = (dateStr: string) => {
      if (primarySeries.length === 1) return padX + plotW / 2;
      const t = new Date(dateStr).getTime();
      return padX + ((t - t0) / timeSpan) * plotW;
    };

    const getY = (val: number) => {
      return padY + plotH - ((val - minVal) / valRange) * plotH;
    };

    const primaryPoints = primarySeries.map((s) => ({
      x: getX(s.date),
      y: getY(s.value),
      ...s,
    }));

    // Secondary points mapped onto secondary Y-range if exists
    let secondaryPoints: { x: number; y: number; value: number; unit: string; date: string }[] = [];
    if (secondarySeries.length > 0) {
      const sVals = secondarySeries.map((s) => s.value);
      const sMin = Math.min(...sVals) * 0.9;
      const sMax = Math.max(...sVals) * 1.1;
      const sRange = sMax - sMin || 1;

      secondaryPoints = secondarySeries.map((s) => ({
        x: getX(s.date),
        y: padY + plotH - ((s.value - sMin) / sRange) * plotH,
        ...s,
      }));
    }

    const refLowY = getY(refLow);
    const refHighY = getY(refHigh);

    return {
      width,
      height,
      minVal,
      maxVal,
      primaryPoints,
      secondaryPoints,
      refLowY,
      refHighY,
      refLow,
      refHigh,
    };
  }, [primarySeries, secondarySeries, refLow, refHigh]);

  // Overall metric deltas
  const firstVal = primarySeries[0]?.value;
  const lastVal = primarySeries[primarySeries.length - 1]?.value;
  const netDelta = lastVal !== undefined && firstVal !== undefined ? Number((lastVal - firstVal).toFixed(2)) : 0;
  const pctDelta = firstVal ? Number(((netDelta / firstVal) * 100).toFixed(1)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
              <TrendingUp className="w-4 h-4" />
              <span>Longitudinal Biomarker Surveillance</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Biomarker Trend Analytics
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              High-resolution time-series tracking with normal reference interval overlays, multi-biomarker correlation projections, and visit-over-visit delta percentages.
            </p>
          </div>
        </div>
      </div>

      {/* AI Longitudinal Trend Summary Component */}
      <PatientTrendAiSummary
        profile={profile}
        sessions={sessions}
        onSelectBiomarker={(id) => {
          setPrimaryBiomarkerId(id);
          const el = document.getElementById('primary-chart-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Search and Clinical Category Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        {/* Row 1: Search Input & Active Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search biomarkers by name, LOINC, or panel (e.g. Ferritin, LDL, CBC, Hemoglobin, 718-7)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-9 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active Filter Indicators & Reset Action */}
          <div className="flex items-center gap-2 shrink-0">
            {(searchQuery.trim() !== '' || selectedCategory !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="px-3 py-2 text-2xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Clinical Diagnostic Category Panels */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Clinical Diagnostic Panels</span>
            </span>
            <span className="text-2xs font-mono text-slate-500">
              {filteredCatalog.length} of {MASTER_BIOMARKER_CATALOG.length} Analytes Isolated
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-2xs scrollbar-thin">
            {CLINICAL_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat] || 0;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    const matching = MASTER_BIOMARKER_CATALOG.filter((b) => cat === 'All' || b.category === cat);
                    if (matching.length > 0 && !matching.some((b) => b.biomarkerId === primaryBiomarkerId)) {
                      setPrimaryBiomarkerId(matching[0].biomarkerId);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-700 text-white font-semibold shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/60'
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`text-3xs font-mono px-1.5 py-0.2 rounded-xs ${
                      isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Quick-Pick Biomarker Strip / Grid */}
        {filteredCatalog.length > 0 ? (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-2xs">
              <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Quick-Select Biomarker to Monitor:</span>
              </span>
              <span className="text-3xs text-slate-400 italic">Click card to isolate analyte</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto pr-1">
              {filteredCatalog.map((b) => {
                const isSelected = b.biomarkerId === primaryBiomarkerId;
                const isSecondary = b.biomarkerId === secondaryBiomarkerId && showSecondaryOverlay;
                const insights = biomarkerInsights.get(b.biomarkerId);

                return (
                  <button
                    key={b.biomarkerId}
                    onClick={() => setPrimaryBiomarkerId(b.biomarkerId)}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 shadow-xs ring-1 ring-blue-500'
                        : isSecondary
                        ? 'border-amber-400 bg-amber-50/50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-2xs font-bold leading-tight line-clamp-1 ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                          {b.name}
                        </span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1"></span>
                        )}
                      </div>
                      <div className="text-3xs text-slate-400 font-mono mt-0.5">
                        {b.standardUnit} {b.code ? `· ${b.code}` : ''}
                      </div>
                    </div>

                    <div className="mt-2 pt-1 border-t border-slate-100 flex items-baseline justify-between text-3xs font-mono">
                      {insights?.latestVal !== undefined ? (
                        <>
                          <span className="font-bold text-slate-800">
                            {insights.latestVal}
                          </span>
                          <span
                            className={
                              insights.latestStatus !== 'Normal'
                                ? 'text-amber-700 font-semibold'
                                : 'text-emerald-700'
                            }
                          >
                            {insights.latestStatus}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">No data</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-50 rounded-lg text-center text-xs text-slate-500 border border-dashed border-slate-200">
            No biomarkers found matching "{searchQuery}" in {selectedCategory}.
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="block mx-auto mt-2 text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
            >
              Clear search & reset filters
            </button>
          </div>
        )}

        {/* Row 4: Primary, Secondary, and Time Horizon Dropdowns */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-2xs font-semibold text-slate-600 uppercase mb-1">
              Primary Monitored Analyte
            </label>
            <select
              value={primaryBiomarkerId}
              onChange={(e) => setPrimaryBiomarkerId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 font-semibold text-slate-900 focus:outline-none cursor-pointer"
            >
              {filteredCatalog.map((b) => (
                <option key={b.biomarkerId} value={b.biomarkerId}>
                  {b.name} ({b.standardUnit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-2xs font-semibold text-slate-600 uppercase">
                Secondary Comparison Overlay
              </label>
              <label className="flex items-center gap-1 text-2xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSecondaryOverlay}
                  onChange={(e) => setShowSecondaryOverlay(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Enable Overlay</span>
              </label>
            </div>
            <select
              disabled={!showSecondaryOverlay}
              value={secondaryBiomarkerId}
              onChange={(e) => setSecondaryBiomarkerId(e.target.value)}
              className={`w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-slate-900 focus:outline-none cursor-pointer ${
                !showSecondaryOverlay ? 'opacity-50' : 'font-medium'
              }`}
            >
              {MASTER_BIOMARKER_CATALOG.filter((b) => b.biomarkerId !== primaryBiomarkerId).map((b) => (
                <option key={b.biomarkerId} value={b.biomarkerId}>
                  {b.name} ({b.standardUnit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-600 uppercase mb-1">
              Observation Time Horizon
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(['all', '2y', '1y'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`py-2 text-xs rounded-md font-medium text-center transition-colors cursor-pointer ${
                    dateRange === r
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {r === 'all' ? 'All History' : r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div id="primary-chart-section" className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {primaryItem?.name} Longitudinal Chart
            </h2>
            <div className="text-xs text-slate-500 mt-0.5">
              Standard Reference Range: {refLow} – {refHigh} {primaryItem?.standardUnit} ({profile.gender} Baseline)
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-blue-700 rounded-sm"></span>
              <span className="font-semibold text-slate-900">{primaryItem?.name}</span>
            </div>
            {showSecondaryOverlay && secondarySeries.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-amber-600 rounded-sm"></span>
                <span className="font-semibold text-slate-900">{secondaryItem?.name}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-slate-500">
              <span className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded-2xs"></span>
              <span>Nominal Reference Band</span>
            </div>
          </div>
        </div>

        {/* SVG Longitudinal Canvas */}
        {chartGeometry && primarySeries.length > 0 ? (
          <div className="w-full overflow-x-auto bg-slate-50/50 p-2 rounded-lg border border-slate-100">
            <svg
              viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
              className="w-full h-auto max-h-80 select-none"
            >
              {/* Safe Reference Interval Shaded Band */}
              <rect
                x={45}
                y={Math.min(chartGeometry.refHighY, chartGeometry.refLowY)}
                width={chartGeometry.width - 90}
                height={Math.max(4, Math.abs(chartGeometry.refLowY - chartGeometry.refHighY))}
                fill="#10b981"
                fillOpacity="0.08"
              />

              {/* High Reference Line */}
              <line
                x1={45}
                y1={chartGeometry.refHighY}
                x2={chartGeometry.width - 45}
                y2={chartGeometry.refHighY}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth="1.2"
              />
              <text
                x={chartGeometry.width - 42}
                y={chartGeometry.refHighY + 3}
                fontSize="9"
                fill="#059669"
                fontFamily="monospace"
              >
                Ref High: {chartGeometry.refHigh}
              </text>

              {/* Low Reference Line */}
              <line
                x1={45}
                y1={chartGeometry.refLowY}
                x2={chartGeometry.width - 45}
                y2={chartGeometry.refLowY}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth="1.2"
              />
              <text
                x={chartGeometry.width - 42}
                y={chartGeometry.refLowY + 3}
                fontSize="9"
                fill="#059669"
                fontFamily="monospace"
              >
                Ref Low: {chartGeometry.refLow}
              </text>

              {/* Secondary Overlay Polyline if active */}
              {chartGeometry.secondaryPoints.length > 0 && (
                <>
                  <polyline
                    fill="none"
                    stroke="#d97706"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                    points={chartGeometry.secondaryPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  />
                  {chartGeometry.secondaryPoints.map((p, i) => (
                    <circle key={`sec-${i}`} cx={p.x} cy={p.y} r="3.5" fill="#d97706" stroke="#ffffff" strokeWidth="1.5" />
                  ))}
                </>
              )}

              {/* Primary Biomarker Polyline */}
              <polyline
                fill="none"
                stroke="#1d4ed8"
                strokeWidth="2.5"
                points={chartGeometry.primaryPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              />

              {/* Primary Data Point Circles & Tooltip Labels */}
              {chartGeometry.primaryPoints.map((p, i) => {
                const isAbnormal = p.status !== 'Normal';
                return (
                  <g key={`pri-${i}`}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="5"
                      fill={isAbnormal ? '#dc2626' : '#1d4ed8'}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    <text
                      x={p.x}
                      y={p.y - 10}
                      fontSize="10"
                      textAnchor="middle"
                      fill="#0f172a"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {p.value}
                    </text>
                    <text
                      x={p.x}
                      y={chartGeometry.height - 8}
                      fontSize="9"
                      textAnchor="middle"
                      fill="#64748b"
                      fontFamily="monospace"
                    >
                      {p.date}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-500">
            No historical recordings found for {primaryItem?.name} in this patient's profile.
          </div>
        )}

        {/* Statistical Summary Ribbon */}
        {primarySeries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-2xs text-slate-500">Current Measured</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                {lastVal} <span className="text-2xs font-sans text-slate-500 font-normal">{primaryItem?.standardUnit}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-2xs text-slate-500">Net Delta (Baseline to Present)</div>
              <div
                className={`text-lg font-bold font-mono tabular-nums mt-0.5 flex items-center gap-1 ${
                  netDelta > 0 ? 'text-blue-700' : netDelta < 0 ? 'text-amber-700' : 'text-slate-900'
                }`}
              >
                {netDelta > 0 ? '+' : ''}{netDelta}
                <span className="text-2xs font-sans text-slate-500 font-normal">({pctDelta > 0 ? '+' : ''}{pctDelta}%)</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-2xs text-slate-500">Historical Extremes</div>
              <div className="text-xs font-mono font-semibold text-slate-800 mt-1">
                Min: {Math.min(...primarySeries.map((s) => s.value))} · Max: {Math.max(...primarySeries.map((s) => s.value))}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-2xs text-slate-500">Clinical Significance</div>
              <div className="text-2xs text-slate-600 mt-1 line-clamp-2">
                {primaryItem?.clinicalSignificance}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Longitudinal Data Table with Range Gauges */}
      {primarySeries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900">
            Recorded Time Series ({primaryItem?.name})
          </h3>

          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Test Date</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Recorded Value</th>
                  <th className="py-2.5 px-3 font-semibold">Interval Position Gauge</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Delta vs Prior</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {primarySeries.map((s, idx) => {
                  const prev = idx > 0 ? primarySeries[idx - 1] : null;
                  const delta = prev ? Number((s.value - prev.value).toFixed(2)) : null;
                  const deltaPct = prev && prev.value > 0 ? Number(((delta! / prev.value) * 100).toFixed(1)) : null;

                  // Needle position percentage in reference interval
                  const rangeSpan = (refHigh - refLow) || 1;
                  const pctPos = Math.max(0, Math.min(100, ((s.value - refLow) / rangeSpan) * 100));

                  return (
                    <tr key={s.sessionId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                        {s.date}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-slate-900">
                        {s.value} <span className="text-2xs font-normal text-slate-500">{s.unit}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="w-48 bg-slate-200 h-2 rounded-full relative overflow-hidden">
                          <div className="absolute inset-y-0 left-0 w-full bg-linear-to-r from-amber-200 via-emerald-200 to-amber-200 opacity-60"></div>
                          <div
                            style={{ left: `${pctPos}%` }}
                            className="absolute top-0 bottom-0 w-2 -ml-1 bg-blue-700 rounded-full shadow-xs"
                          ></div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">
                        {delta !== null ? (
                          <span className={delta > 0 ? 'text-blue-700 font-semibold' : delta < 0 ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                            {delta > 0 ? '+' : ''}{delta} {deltaPct !== null ? `(${deltaPct > 0 ? '+' : ''}${deltaPct}%)` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">Baseline</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-2xs font-semibold ${
                            s.status === 'Normal' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

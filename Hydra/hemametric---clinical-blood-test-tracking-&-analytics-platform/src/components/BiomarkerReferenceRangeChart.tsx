import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowUpDown,
  Layers,
} from 'lucide-react';
import {
  BiomarkerResult,
  ResultStatus,
} from '../types/clinical';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';

interface BiomarkerReferenceRangeChartProps {
  results: BiomarkerResult[];
  sessionDate: string;
}

type StatusFilter = 'all' | 'out-of-range' | 'normal';
type SortOption = 'deviation' | 'out-of-range-first' | 'category' | 'name';
type ChartViewMode = 'overlay' | 'diverging';

export const BiomarkerReferenceRangeChart: React.FC<BiomarkerReferenceRangeChartProps> = ({
  results,
  sessionDate,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('out-of-range-first');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ChartViewMode>('overlay');
  const [expandedBiomarkerId, setExpandedBiomarkerId] = useState<string | null>(null);

  // Categories extracted from results
  const categories = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => {
      const cat = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === r.biomarkerId);
      if (cat?.category) set.add(cat.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [results]);

  // Enhanced analyte records with deviation metrics
  const enhancedAnalytes = useMemo(() => {
    return results.map((res) => {
      const cat = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === res.biomarkerId);
      const isNormal = res.status === 'Normal';
      const isHigh = res.status === 'High' || res.status === 'Critical High';
      const isLow = res.status === 'Low' || res.status === 'Critical Low';
      const isCritical = res.status.includes('Critical');

      // Reference range metrics
      const refLow = res.refLow;
      const refHigh = res.refHigh;
      const rangeSpan = Math.max(0.001, refHigh - refLow);
      const val = res.resultValue;

      // Deviation percentage from boundary
      let deviationPct = 0;
      let deviationLabel = 'In Range';

      if (val > refHigh) {
        deviationPct = refHigh > 0 ? Number((((val - refHigh) / refHigh) * 100).toFixed(1)) : 0;
        deviationLabel = `+${deviationPct}% above ULN`;
      } else if (val < refLow) {
        deviationPct = refLow > 0 ? Number((((refLow - val) / refLow) * 100).toFixed(1)) : 0;
        deviationLabel = `-${deviationPct}% below LLN`;
      }

      // Normalized overlay scale calculations:
      // We position refLow at roughly 25% and refHigh at roughly 75% on the track,
      // giving generous 25% wings on both sides for below-limit and above-limit values.
      // Normal range takes up 50% of the visual track width.
      const normalTrackPct = 50; // width of normal range
      const leftPadPct = 25; // position of refLow

      let valPositionPct = 50;
      if (val <= refLow) {
        // Between 0 and leftPadPct
        const underRatio = Math.max(0, (refLow - val) / rangeSpan);
        valPositionPct = Math.max(3, leftPadPct - underRatio * leftPadPct);
      } else if (val >= refHigh) {
        // Between leftPadPct + normalTrackPct and 100%
        const overRatio = Math.max(0, (val - refHigh) / rangeSpan);
        valPositionPct = Math.min(97, leftPadPct + normalTrackPct + overRatio * 25);
      } else {
        // Inside normal range
        const insideRatio = (val - refLow) / rangeSpan;
        valPositionPct = leftPadPct + insideRatio * normalTrackPct;
      }

      return {
        ...res,
        catalogItem: cat,
        name: cat?.name || res.biomarkerId,
        category: cat?.category || 'General',
        loinc: cat?.code || '',
        description: cat?.description || '',
        significance: cat?.clinicalSignificance || '',
        isNormal,
        isHigh,
        isLow,
        isCritical,
        deviationPct,
        deviationLabel,
        leftPadPct,
        normalTrackPct,
        valPositionPct,
      };
    });
  }, [results]);

  // Summary counts
  const summary = useMemo(() => {
    const total = enhancedAnalytes.length;
    const normalCount = enhancedAnalytes.filter((a) => a.isNormal).length;
    const highCount = enhancedAnalytes.filter((a) => a.isHigh).length;
    const lowCount = enhancedAnalytes.filter((a) => a.isLow).length;
    const criticalCount = enhancedAnalytes.filter((a) => a.isCritical).length;
    const outOfRangeCount = total - normalCount;
    const inRangePct = total > 0 ? Math.round((normalCount / total) * 100) : 100;

    return {
      total,
      normalCount,
      highCount,
      lowCount,
      criticalCount,
      outOfRangeCount,
      inRangePct,
    };
  }, [enhancedAnalytes]);

  // Filter and sort items
  const filteredAnalytes = useMemo(() => {
    let list = [...enhancedAnalytes];

    // Status filter
    if (statusFilter === 'out-of-range') {
      list = list.filter((a) => !a.isNormal);
    } else if (statusFilter === 'normal') {
      list = list.filter((a) => a.isNormal);
    }

    // Category filter
    if (selectedCategory !== 'All') {
      list = list.filter((a) => a.category === selectedCategory);
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          a.loinc.toLowerCase().includes(q)
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'deviation') {
        return b.deviationPct - a.deviationPct;
      }
      if (sortBy === 'out-of-range-first') {
        if (a.isCritical && !b.isCritical) return -1;
        if (!a.isCritical && b.isCritical) return 1;
        if (!a.isNormal && b.isNormal) return -1;
        if (a.isNormal && !b.isNormal) return 1;
        return b.deviationPct - a.deviationPct;
      }
      if (sortBy === 'category') {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return list;
  }, [enhancedAnalytes, statusFilter, selectedCategory, searchQuery, sortBy]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
            <BarChart3 className="w-4 h-4" />
            <span>Diagnostic Range Analytics</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Reference Range Overlay & Out-of-Range Visualization
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            Direct visual comparison of measured blood analyte concentrations against validated laboratory reference intervals (LLN to ULN), color-coded by clinical alert tier.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0 self-start md:self-auto text-2xs">
          <button
            onClick={() => setViewMode('overlay')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              viewMode === 'overlay'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Range Overlay Bars
          </button>
          <button
            onClick={() => setViewMode('diverging')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              viewMode === 'diverging'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            % Deviation Delta
          </button>
        </div>
      </div>

      {/* Summary KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200">
          <span className="text-3xs font-semibold text-slate-500 uppercase tracking-wider block">
            Total Analytes
          </span>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
            {summary.total}
          </div>
          <span className="text-3xs text-slate-400">Measured panel</span>
        </div>

        <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
          <span className="text-3xs font-semibold text-emerald-700 uppercase tracking-wider block">
            Within Interval
          </span>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-800 mt-0.5">
            {summary.normalCount}{' '}
            <span className="text-xs font-normal text-emerald-600">({summary.inRangePct}%)</span>
          </div>
          <span className="text-3xs text-emerald-600">Nominal values</span>
        </div>

        <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200">
          <span className="text-3xs font-semibold text-amber-700 uppercase tracking-wider block">
            Elevated (High)
          </span>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-800 mt-0.5">
            {summary.highCount}
          </div>
          <span className="text-3xs text-amber-600">Exceeds ULN threshold</span>
        </div>

        <div className="p-3 bg-sky-50/60 rounded-lg border border-sky-200">
          <span className="text-3xs font-semibold text-sky-700 uppercase tracking-wider block">
            Sub-optimal (Low)
          </span>
          <div className="text-xl font-bold font-mono tabular-nums text-sky-800 mt-0.5">
            {summary.lowCount}
          </div>
          <span className="text-3xs text-sky-600">Below LLN threshold</span>
        </div>

        <div className={`p-3 rounded-lg border ${summary.criticalCount > 0 ? 'bg-rose-50/80 border-rose-300' : 'bg-slate-50/80 border-slate-200'}`}>
          <span className={`text-3xs font-semibold uppercase tracking-wider block ${summary.criticalCount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
            Critical Alerts
          </span>
          <div className={`text-xl font-bold font-mono tabular-nums mt-0.5 ${summary.criticalCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {summary.criticalCount}
          </div>
          <span className={`text-3xs ${summary.criticalCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            Immediate review
          </span>
        </div>

        <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200">
          <span className="text-3xs font-semibold text-slate-500 uppercase tracking-wider block">
            Out-of-Range Total
          </span>
          <div className={`text-xl font-bold font-mono tabular-nums mt-0.5 ${summary.outOfRangeCount > 0 ? 'text-slate-900' : 'text-emerald-700'}`}>
            {summary.outOfRangeCount}
          </div>
          <span className="text-3xs text-slate-400">Total non-nominal</span>
        </div>
      </div>

      {/* Control Bar: Triage filter, Search, Sort & Categories */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-semibold text-slate-500 mr-1">Status:</span>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Analytes ({summary.total})
            </button>
            <button
              onClick={() => setStatusFilter('out-of-range')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'out-of-range'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Out-of-Range Only ({summary.outOfRangeCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('normal')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                statusFilter === 'normal'
                  ? 'bg-emerald-700 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Within Range ({summary.normalCount})
            </button>
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search biomarker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-400"
              />
            </div>

            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Sort biomarkers by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="out-of-range-first">Out-of-Range First</option>
                <option value="deviation">Largest % Deviation</option>
                <option value="category">Group by Category</option>
                <option value="name">Alphabetical (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Pills Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-2xs scrollbar-thin">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-700 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Chart Legend */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-2xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-slate-700">Chart Key:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block"></span>
            <span>Within Reference Interval</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block"></span>
            <span>Elevated (&gt; Upper Limit)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-sky-500 inline-block"></span>
            <span>Sub-optimal (&lt; Lower Limit)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-rose-600 inline-block"></span>
            <span>Critical Threshold Breached</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-500 text-3xs font-mono">
          <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-xs">LLN: Lower Limit</span>
          <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded-xs">ULN: Upper Limit</span>
        </div>
      </div>

      {/* Main Bar Chart Rows List */}
      {filteredAnalytes.length > 0 ? (
        <div className="space-y-3">
          {filteredAnalytes.map((item) => {
            const isExpanded = expandedBiomarkerId === item.biomarkerId;

            // Bar color selection based on status
            let barColor = 'bg-emerald-500';
            let barBorderColor = 'border-emerald-600';
            let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            let statusTextColor = 'text-emerald-700';

            if (item.isCritical) {
              barColor = 'bg-rose-600';
              barBorderColor = 'border-rose-700';
              badgeBg = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
              statusTextColor = 'text-rose-700 font-bold';
            } else if (item.isHigh) {
              barColor = 'bg-amber-500';
              barBorderColor = 'border-amber-600';
              badgeBg = 'bg-amber-100 text-amber-800 border-amber-300 font-semibold';
              statusTextColor = 'text-amber-700 font-bold';
            } else if (item.isLow) {
              barColor = 'bg-sky-500';
              barBorderColor = 'border-sky-600';
              badgeBg = 'bg-sky-100 text-sky-800 border-sky-300 font-semibold';
              statusTextColor = 'text-sky-700 font-bold';
            }

            return (
              <div
                key={item.resultId}
                className={`rounded-xl border transition-all ${
                  item.isCritical
                    ? 'border-rose-300 bg-rose-50/20 shadow-2xs'
                    : !item.isNormal
                    ? 'border-amber-200 bg-amber-50/15'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="p-4 space-y-3">
                  {/* Row Top Header: Analyte Name, Category, Result Value & Out-of-Range Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="pt-0.5">
                        {item.isCritical ? (
                          <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : !item.isNormal ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{item.name}</span>
                          {item.loinc && (
                            <span className="text-3xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-xs">
                              LOINC {item.loinc}
                            </span>
                          )}
                        </div>
                        <div className="text-2xs text-slate-500 mt-0.5">
                          {item.category}
                        </div>
                      </div>
                    </div>

                    {/* Numeric Value & Status Badge */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <div className="text-right">
                        <div className="font-mono font-bold text-base tabular-nums text-slate-900">
                          {item.resultValue}{' '}
                          <span className="text-2xs font-normal text-slate-500 font-sans">
                            {item.unitMeasured}
                          </span>
                        </div>
                        <div className="text-3xs font-mono text-slate-500">
                          Ref: {item.refLow} – {item.refHigh} {item.unitMeasured}
                        </div>
                      </div>

                      {/* Pill-free structured badge */}
                      <div className={`px-2.5 py-1 rounded-md border text-2xs uppercase tracking-wider ${badgeBg}`}>
                        {item.status}
                      </div>

                      {/* Expand Details Button */}
                      <button
                        onClick={() => setExpandedBiomarkerId(isExpanded ? null : item.biomarkerId)}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title="Toggle clinical significance notes"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Visualization Bar Mode 1: Range Overlay Track */}
                  {viewMode === 'overlay' && (
                    <div className="space-y-1.5 pt-1">
                      {/* Sub-label indicators: LLN, Normal Range, ULN, Deviation */}
                      <div className="flex items-center justify-between text-3xs font-mono text-slate-500 px-1">
                        <span className="flex items-center gap-1">
                          <span>Low Sub-Zone</span>
                          <span className="text-slate-400">(&lt;{item.refLow})</span>
                        </span>
                        <span className="font-semibold text-emerald-800">
                          Standard Reference Window [{item.refLow} – {item.refHigh} {item.unitMeasured}]
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-slate-400">(&gt;{item.refHigh})</span>
                          <span>High Supra-Zone</span>
                        </span>
                      </div>

                      {/* Normalized Horizontal Range Track */}
                      <div className="relative h-6 bg-slate-100 rounded-md overflow-hidden border border-slate-200 flex items-center">
                        {/* 1. Low Sub-Reference Region (0% to 25%) */}
                        <div
                          style={{ width: `${item.leftPadPct}%` }}
                          className="h-full bg-sky-50/50 border-r border-dashed border-sky-300 relative"
                        ></div>

                        {/* 2. Normal Reference Region (25% to 75%) */}
                        <div
                          style={{ width: `${item.normalTrackPct}%` }}
                          className="h-full bg-emerald-100/40 border-r border-dashed border-emerald-300 relative"
                        >
                          <div className="absolute inset-0 flex items-center justify-center opacity-30 text-3xs font-mono font-bold text-emerald-700 tracking-widest pointer-events-none select-none">
                            NOMINAL ZONE
                          </div>
                        </div>

                        {/* 3. High Supra-Reference Region (75% to 100%) */}
                        <div className="flex-1 h-full bg-amber-50/50"></div>

                        {/* Reference Range Bound Markers */}
                        <div
                          style={{ left: `${item.leftPadPct}%` }}
                          className="absolute top-0 bottom-0 w-0.5 bg-slate-400 z-10"
                          title={`Lower Reference Limit: ${item.refLow}`}
                        ></div>
                        <div
                          style={{ left: `${item.leftPadPct + item.normalTrackPct}%` }}
                          className="absolute top-0 bottom-0 w-0.5 bg-slate-400 z-10"
                          title={`Upper Reference Limit: ${item.refHigh}`}
                        ></div>

                        {/* 4. Patient Value Bar (Horizontal fill from baseline or pin) */}
                        <div
                          style={{
                            left: 0,
                            width: `${item.valPositionPct}%`,
                          }}
                          className={`h-3 rounded-r-xs opacity-85 transition-all duration-300 ${barColor}`}
                        ></div>

                        {/* 5. Pointer Needle & Indicator Marker */}
                        <div
                          style={{ left: `calc(${item.valPositionPct}% - 6px)` }}
                          className={`absolute top-0 bottom-0 w-3 z-20 flex items-center justify-center`}
                        >
                          <div
                            className={`w-3.5 h-5 rounded-xs shadow-xs border-2 border-white ${barColor} flex items-center justify-center`}
                          >
                            <div className="w-1 h-1 bg-white rounded-full"></div>
                          </div>
                        </div>
                      </div>

                      {/* Deviation Callout below track */}
                      <div className="flex items-center justify-between text-2xs pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-mono text-3xs">
                            Lower Limit: <strong className="text-slate-700">{item.refLow}</strong>
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500 font-mono text-3xs">
                            Upper Limit: <strong className="text-slate-700">{item.refHigh}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {item.isHigh ? (
                            <span className="font-mono font-bold text-amber-700 flex items-center gap-0.5">
                              <TrendingUp className="w-3.5 h-3.5" />
                              <span>{item.deviationLabel}</span>
                            </span>
                          ) : item.isLow ? (
                            <span className="font-mono font-bold text-sky-700 flex items-center gap-0.5">
                              <TrendingDown className="w-3.5 h-3.5" />
                              <span>{item.deviationLabel}</span>
                            </span>
                          ) : (
                            <span className="font-mono font-medium text-emerald-700 flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Centered within nominal range</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Visualization Bar Mode 2: % Deviation Diverging Bar Chart */}
                  {viewMode === 'diverging' && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-3xs font-mono text-slate-500 px-1">
                        <span>Negative Deviation (&lt; LLN)</span>
                        <span className="font-bold text-slate-700">0% Normal Boundary Baseline</span>
                        <span>Positive Deviation (&gt; ULN)</span>
                      </div>

                      {/* Diverging Bar Track with 0% at center */}
                      <div className="relative h-6 bg-slate-100 rounded-md overflow-hidden border border-slate-200 flex items-center">
                        {/* Center Zero Line */}
                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400 z-10"></div>

                        {/* Negative bar to the left */}
                        {item.isLow && (
                          <div
                            style={{
                              right: '50%',
                              width: `${Math.min(48, item.deviationPct * 0.8)}%`,
                            }}
                            className="absolute top-1 bottom-1 bg-sky-500 rounded-l-xs opacity-90"
                          ></div>
                        )}

                        {/* Positive bar to the right */}
                        {item.isHigh && (
                          <div
                            style={{
                              left: '50%',
                              width: `${Math.min(48, item.deviationPct * 0.8)}%`,
                            }}
                            className={`absolute top-1 bottom-1 rounded-r-xs opacity-90 ${item.isCritical ? 'bg-rose-600' : 'bg-amber-500'}`}
                          ></div>
                        )}

                        {/* Nominal marker at center */}
                        {item.isNormal && (
                          <div className="absolute left-1/2 -ml-1 w-2 h-4 bg-emerald-500 rounded-xs z-10 opacity-80"></div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-2xs pt-0.5 font-mono">
                        <span className="text-slate-400 text-3xs">
                          {item.isLow ? `-${item.deviationPct}% departure` : '0%'}
                        </span>
                        <span className={`text-xs font-bold ${statusTextColor}`}>
                          {item.deviationLabel}
                        </span>
                        <span className="text-slate-400 text-3xs">
                          {item.isHigh ? `+${item.deviationPct}% departure` : '0%'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Expandable Clinical Context Drawer */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-200/80 bg-slate-50/70 -mx-4 -mb-4 p-4 rounded-b-xl space-y-2 text-xs">
                      <div>
                        <span className="font-semibold text-slate-900">Physiological Description: </span>
                        <span className="text-slate-700">{item.description || 'Standard diagnostic laboratory analyte.'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Clinical Significance: </span>
                        <span className="text-slate-700">{item.significance || 'Assesses systemic metabolic and biochemical homeostasis.'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 pt-1 text-2xs text-slate-500 font-mono">
                        <span>Report Date: {sessionDate}</span>
                        <span>·</span>
                        <span>Standard Unit: {item.unitMeasured}</span>
                        <span>·</span>
                        <span>Lower Limit (LLN): {item.refLow}</span>
                        <span>·</span>
                        <span>Upper Limit (ULN): {item.refHigh}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No biomarkers match the selected filter criteria ({statusFilter}, {selectedCategory}).
        </div>
      )}
    </div>
  );
};

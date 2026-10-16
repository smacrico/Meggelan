import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Download,
  Info,
  Layers,
  ArrowRight,
  ShieldAlert,
  Search,
} from 'lucide-react';
import {
  PatientProfile,
  TestSession,
  Laboratory,
  BiomarkerResult,
  ResultStatus,
} from '../types/clinical';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';

interface BiomarkerComparisonScreenProps {
  profile: PatientProfile;
  sessions: TestSession[];
  labs: Laboratory[];
}

type DeviationFilter = 'all' | 'significant' | 'marked' | 'status-change';

interface AnalyteDifferential {
  biomarkerId: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  refLow: number;
  refHigh: number;
  valA?: number;
  statusA?: ResultStatus;
  valB?: number;
  statusB?: ResultStatus;
  deltaAbs?: number;
  deltaPct?: number;
  isStatusChanged: boolean;
  isSignificant: boolean; // >= 15%
  isMarked: boolean; // >= 30%
  clinicalDirection: 'favorable' | 'unfavorable' | 'neutral' | 'stable';
  deviationLabel: string;
}

export const BiomarkerComparisonScreen: React.FC<BiomarkerComparisonScreenProps> = ({
  profile,
  sessions,
  labs,
}) => {
  // Sort sessions chronologically ascending
  const sortedSessions = useMemo(() => {
    return [...sessions].sort(
      (a, b) => new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime()
    );
  }, [sessions]);

  // Default Session A (first or second to last) and Session B (latest)
  const defaultSessionAId = sortedSessions.length >= 2 ? sortedSessions[sortedSessions.length - 2].sessionId : sortedSessions[0]?.sessionId || '';
  const defaultSessionBId = sortedSessions.length >= 1 ? sortedSessions[sortedSessions.length - 1].sessionId : '';

  const [sessionAId, setSessionAId] = useState<string>(defaultSessionAId);
  const [sessionBId, setSessionBId] = useState<string>(defaultSessionBId);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [deviationFilter, setDeviationFilter] = useState<DeviationFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const sessionA = sortedSessions.find((s) => s.sessionId === sessionAId);
  const sessionB = sortedSessions.find((s) => s.sessionId === sessionBId);

  const labA = sessionA ? labs.find((l) => l.labId === sessionA.labId) : null;
  const labB = sessionB ? labs.find((l) => l.labId === sessionB.labId) : null;

  // Days between sessions
  const daysDifference = useMemo(() => {
    if (!sessionA || !sessionB) return 0;
    const tA = new Date(sessionA.collectionDate).getTime();
    const tB = new Date(sessionB.collectionDate).getTime();
    return Math.round(Math.abs(tB - tA) / (1000 * 60 * 60 * 24));
  }, [sessionA, sessionB]);

  // Swap session A and B
  const handleSwapSessions = () => {
    const temp = sessionAId;
    setSessionAId(sessionBId);
    setSessionBId(temp);
  };

  // Compute differentials for all analytes present in either session
  const differentials = useMemo(() => {
    if (!sessionA || !sessionB) return [];

    const mapA = new Map<string, BiomarkerResult>(sessionA.results.map((r) => [r.biomarkerId, r]));
    const mapB = new Map<string, BiomarkerResult>(sessionB.results.map((r) => [r.biomarkerId, r]));

    const allBiomarkerIds = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
    const isFemale = profile.gender === 'Female';

    const list: AnalyteDifferential[] = [];

    allBiomarkerIds.forEach((bId) => {
      const resA = mapA.get(bId);
      const resB = mapB.get(bId);
      const catItem = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === bId);

      const refLow = catItem ? (isFemale ? catItem.refLowFemale : catItem.refLowMale) : 0;
      const refHigh = catItem ? (isFemale ? catItem.refHighFemale : catItem.refHighMale) : 100;

      const valA = resA?.resultValue;
      const valB = resB?.resultValue;
      const statusA = resA?.status;
      const statusB = resB?.status;

      let deltaAbs: number | undefined;
      let deltaPct: number | undefined;

      if (valA !== undefined && valB !== undefined) {
        deltaAbs = Number((valB - valA).toFixed(2));
        deltaPct = valA !== 0 ? Number(((deltaAbs / valA) * 100).toFixed(1)) : 0;
      }

      const isStatusChanged = statusA !== undefined && statusB !== undefined && statusA !== statusB;
      const absPct = deltaPct !== undefined ? Math.abs(deltaPct) : 0;
      const isSignificant = absPct >= 15;
      const isMarked = absPct >= 30;

      // Clinical direction assessment:
      let clinicalDirection: AnalyteDifferential['clinicalDirection'] = 'stable';
      if (deltaPct !== undefined && absPct >= 8) {
        const isAdverseMarker = ['bm-ldl', 'bm-tg', 'bm-glu', 'bm-hba1c', 'bm-crp', 'bm-alt', 'bm-ast', 'bm-chol', 'bm-nonhdl'].includes(bId);
        const isReserveMarker = ['bm-ferr', 'bm-hdl', 'bm-hgb', 'bm-vitd', 'bm-b12'].includes(bId);

        if (isAdverseMarker) {
          clinicalDirection = deltaPct < 0 ? 'favorable' : 'unfavorable';
        } else if (isReserveMarker) {
          clinicalDirection = deltaPct > 0 ? 'favorable' : 'unfavorable';
        } else {
          clinicalDirection = 'neutral';
        }
      }

      let deviationLabel = 'Stable';
      if (isMarked) {
        deviationLabel = deltaPct! > 0 ? 'Marked Increase' : 'Marked Decrease';
      } else if (isSignificant) {
        deviationLabel = deltaPct! > 0 ? 'Moderate Increase' : 'Moderate Decrease';
      } else if (absPct >= 8) {
        deviationLabel = deltaPct! > 0 ? 'Mild Increase' : 'Mild Decrease';
      }

      if (isStatusChanged) {
        deviationLabel += ` (${statusA} → ${statusB})`;
      }

      list.push({
        biomarkerId: bId,
        name: catItem?.name || bId,
        code: catItem?.code || '',
        category: catItem?.category || 'General',
        unit: catItem?.standardUnit || resA?.unitMeasured || resB?.unitMeasured || '',
        refLow,
        refHigh,
        valA,
        statusA,
        valB,
        statusB,
        deltaAbs,
        deltaPct,
        isStatusChanged,
        isSignificant,
        isMarked,
        clinicalDirection,
        deviationLabel,
      });
    });

    return list;
  }, [sessionA, sessionB, profile]);

  // Filtered differentials
  const filteredDifferentials = useMemo(() => {
    return differentials.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (deviationFilter === 'significant' && !item.isSignificant && !item.isStatusChanged) return false;
      if (deviationFilter === 'marked' && !item.isMarked && !item.isStatusChanged) return false;
      if (deviationFilter === 'status-change' && !item.isStatusChanged) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [differentials, categoryFilter, deviationFilter, searchQuery]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const totalCompared = differentials.filter((d) => d.valA !== undefined && d.valB !== undefined).length;
    const markedDeviations = differentials.filter((d) => d.isMarked).length;
    const significantDeviations = differentials.filter((d) => d.isSignificant).length;
    const statusChanges = differentials.filter((d) => d.isStatusChanged).length;
    const favorableCount = differentials.filter((d) => d.clinicalDirection === 'favorable').length;
    const unfavorableCount = differentials.filter((d) => d.clinicalDirection === 'unfavorable').length;

    return {
      totalCompared,
      markedDeviations,
      significantDeviations,
      statusChanges,
      favorableCount,
      unfavorableCount,
    };
  }, [differentials]);

  // Derived metrics comparison map
  const derivedDifferentials = useMemo(() => {
    if (!sessionA || !sessionB) return [];

    const mapA = new Map(sessionA.derivedMetrics.map((dm) => [dm.metricName, dm]));
    const mapB = new Map(sessionB.derivedMetrics.map((dm) => [dm.metricName, dm]));

    const allMetricNames = Array.from(new Set([...mapA.keys(), ...mapB.keys()]));

    return allMetricNames.map((name) => {
      const dmA = mapA.get(name);
      const dmB = mapB.get(name);
      const valA = dmA?.metricValue;
      const valB = dmB?.metricValue;
      const delta = valA !== undefined && valB !== undefined ? Number((valB - valA).toFixed(2)) : undefined;
      const deltaPct = valA !== undefined && valB !== undefined && valA !== 0 ? Number(((delta! / valA) * 100).toFixed(1)) : undefined;

      return {
        name,
        unit: dmA?.unit || dmB?.unit || 'ratio',
        target: dmA?.targetOptimalRange || dmB?.targetOptimalRange || '',
        valA,
        statusA: dmA?.status,
        valB,
        statusB: dmB?.status,
        delta,
        deltaPct,
        interpB: dmB?.clinicalInterpretation || dmA?.clinicalInterpretation || '',
      };
    });
  }, [sessionA, sessionB]);

  // Export CSV
  const handleExportDifferentialCsv = () => {
    if (!sessionA || !sessionB) return;
    const headers = 'Biomarker,LOINC,Category,SessionA_Date,SessionA_Val,SessionA_Status,SessionB_Date,SessionB_Val,SessionB_Status,Absolute_Delta,Percent_Delta,Deviation_Flag\n';
    const rows = differentials.map((d) => {
      return `"${d.name}","${d.code}","${d.category}","${sessionA.collectionDate}",${d.valA ?? ''},"${d.statusA ?? ''}","${sessionB.collectionDate}",${d.valB ?? ''},"${d.statusB ?? ''}",${d.deltaAbs ?? ''},${d.deltaPct !== undefined ? `${d.deltaPct}%` : ''},"${d.deviationLabel}"`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Biomarker_Differentials_${sessionA.collectionDate}_vs_${sessionB.collectionDate}_${profile.lastName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
              <ArrowRightLeft className="w-4 h-4" />
              <span>Biomarker Trajectory Differential Comparator</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Clinical Biomarker Comparison Dashboard
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Select two clinical examination sessions to compute paired numerical differentials, identify out-of-bounds cross-interval breaches, and highlight significant physiological deviations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportDifferentialCsv}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Export Differential CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Session Selection Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Baseline Session (A) */}
          <div className="flex-1 p-3.5 bg-blue-50/40 rounded-xl border border-blue-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-blue-800">
                Baseline Session (A)
              </span>
              <span className="text-2xs font-mono font-medium text-blue-700">
                {sessionA?.results.length || 0} Analytes
              </span>
            </div>

            <select
              aria-label="Select Baseline Session A"
              value={sessionAId}
              onChange={(e) => setSessionAId(e.target.value)}
              className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
            >
              {sortedSessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.collectionDate} · Fasting {s.fastingHours}h · {s.orderingPhysician}
                </option>
              ))}
            </select>

            <div className="text-2xs text-slate-500 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{labA?.labName || 'Clinical Facility'}</span>
            </div>
          </div>

          {/* Swap Button & Interval Badge */}
          <div className="flex lg:flex-col items-center justify-center gap-2 self-center shrink-0">
            <button
              onClick={handleSwapSessions}
              title="Swap Baseline and Comparison Sessions"
              className="p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shadow-2xs cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
            <div className="text-3xs font-mono font-semibold text-slate-500 whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded-sm">
              {daysDifference} days interval
            </div>
          </div>

          {/* Comparison Session (B) */}
          <div className="flex-1 p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-bold uppercase tracking-wider text-indigo-800">
                Follow-up / Comparison Session (B)
              </span>
              <span className="text-2xs font-mono font-medium text-indigo-700">
                {sessionB?.results.length || 0} Analytes
              </span>
            </div>

            <select
              aria-label="Select Comparison Session B"
              value={sessionBId}
              onChange={(e) => setSessionBId(e.target.value)}
              className="w-full bg-white border border-indigo-200 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
            >
              {sortedSessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.collectionDate} · Fasting {s.fastingHours}h · {s.orderingPhysician}
                </option>
              ))}
            </select>

            <div className="text-2xs text-slate-500 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{labB?.labName || 'Clinical Facility'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Differential Highlights Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-3xs font-semibold text-slate-500 uppercase">Analytes Compared</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {summaryStats.totalCompared}
          </div>
          <div className="text-3xs text-slate-400 mt-0.5">Paired values available</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-3xs font-semibold text-slate-500 uppercase">Marked Deviations</div>
          <div className={`text-2xl font-bold font-mono tabular-nums mt-1 ${summaryStats.markedDeviations > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {summaryStats.markedDeviations}
          </div>
          <div className="text-3xs text-slate-400 mt-0.5">≥ ±30% Amplitude shift</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-3xs font-semibold text-slate-500 uppercase">Significant Shifts</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {summaryStats.significantDeviations}
          </div>
          <div className="text-3xs text-slate-400 mt-0.5">≥ ±15% Numerical delta</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-3xs font-semibold text-slate-500 uppercase">Status Boundary Crossings</div>
          <div className={`text-2xl font-bold font-mono tabular-nums mt-1 ${summaryStats.statusChanges > 0 ? 'text-indigo-700' : 'text-slate-900'}`}>
            {summaryStats.statusChanges}
          </div>
          <div className="text-3xs text-slate-400 mt-0.5">Normal ↔ Out-of-range</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-3xs font-semibold text-slate-500 uppercase">Favorable Progressions</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {summaryStats.favorableCount}
          </div>
          <div className="text-3xs text-slate-400 mt-0.5">Positive clinical shifts</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="text-3xs font-semibold text-slate-500 uppercase">Unfavorable Drifts</div>
          <div className={`text-2xl font-bold font-mono tabular-nums mt-1 ${summaryStats.unfavorableCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {summaryStats.unfavorableCount}
          </div>
          <div className="text-3xs text-slate-400 mt-0.5">Worsening parameters</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Deviation Filter Buttons */}
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-semibold mr-1">Deviation Filter:</span>
            {[
              { id: 'all', label: 'All Markers' },
              { id: 'significant', label: 'Significant (≥ ±15%)' },
              { id: 'marked', label: 'Marked (≥ ±30%)' },
              { id: 'status-change', label: 'Status Crossings Only' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDeviationFilter(f.id as DeviationFilter)}
                className={`px-2.5 py-1.5 rounded-md transition-colors cursor-pointer ${
                  deviationFilter === f.id
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search biomarker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-slate-900 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pt-2 border-t border-slate-100 text-2xs">
          {['All', 'Lipid Profile', 'Metabolic & Glycemic', 'Liver Function', 'Iron Status', 'Hematology & CBC', 'Inflammatory Markers', 'Vitamins & Minerals'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-blue-700 text-white font-semibold'
                  : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Differential Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Biomarker Differentials: {sessionA?.collectionDate} → {sessionB?.collectionDate}
            </h2>
            <p className="text-xs text-slate-500">
              Showing {filteredDifferentials.length} of {differentials.length} paired biomarkers across surveillance visits.
            </p>
          </div>

          <div className="flex items-center gap-3 text-2xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-600"></span> Unfavorable drift
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Favorable shift
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-300"></span> Stable (&lt; 8%)
            </span>
          </div>
        </div>

        {filteredDifferentials.length > 0 ? (
          <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-2xs">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Analyte</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Standard Range</th>
                  <th className="py-2.5 px-3 font-semibold text-right bg-blue-50/50 text-blue-950">
                    Session A ({sessionA?.collectionDate})
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right bg-indigo-50/50 text-indigo-950">
                    Session B ({sessionB?.collectionDate})
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right">Absolute Δ</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Relative % Δ</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Trajectory Shift</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDifferentials.map((item) => {
                  const hasBoth = item.valA !== undefined && item.valB !== undefined;
                  const deltaPct = item.deltaPct;

                  const rowBg = item.isMarked
                    ? item.clinicalDirection === 'unfavorable'
                      ? 'bg-rose-50/30'
                      : item.clinicalDirection === 'favorable'
                      ? 'bg-emerald-50/30'
                      : 'hover:bg-slate-50/60'
                    : 'hover:bg-slate-50/60';

                  return (
                    <tr key={item.biomarkerId} className={`transition-colors ${rowBg}`}>
                      {/* Biomarker info */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-3xs text-slate-500 font-mono">
                          {item.category} · {item.code ? `LOINC ${item.code}` : ''}
                        </div>
                      </td>

                      {/* Reference Range */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-2xs text-slate-500">
                        {item.refLow} – {item.refHigh} {item.unit}
                      </td>

                      {/* Session A */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums bg-blue-50/20">
                        {item.valA !== undefined ? (
                          <div>
                            <span className={`font-semibold ${item.statusA !== 'Normal' ? 'text-amber-800' : 'text-slate-900'}`}>
                              {item.valA}
                            </span>
                            <span className="text-3xs text-slate-400 font-sans ml-1">{item.unit}</span>
                            <div className="text-3xs text-slate-500">{item.statusA}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Session B */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums bg-indigo-50/20">
                        {item.valB !== undefined ? (
                          <div>
                            <span className={`font-semibold ${item.statusB !== 'Normal' ? 'text-amber-800' : 'text-slate-900'}`}>
                              {item.valB}
                            </span>
                            <span className="text-3xs text-slate-400 font-sans ml-1">{item.unit}</span>
                            <div className="text-3xs text-slate-500">{item.statusB}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Absolute Delta */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs">
                        {item.deltaAbs !== undefined ? (
                          <span className={item.deltaAbs > 0 ? 'text-slate-900 font-medium' : item.deltaAbs < 0 ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                            {item.deltaAbs > 0 ? `+${item.deltaAbs}` : item.deltaAbs} {item.unit}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Relative % Delta */}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {deltaPct !== undefined ? (
                          <div className="inline-flex items-center gap-1">
                            {deltaPct > 0 ? (
                              <TrendingUp className={`w-3.5 h-3.5 ${item.clinicalDirection === 'unfavorable' ? 'text-rose-600' : item.clinicalDirection === 'favorable' ? 'text-emerald-600' : 'text-blue-600'}`} />
                            ) : deltaPct < 0 ? (
                              <TrendingDown className={`w-3.5 h-3.5 ${item.clinicalDirection === 'unfavorable' ? 'text-rose-600' : item.clinicalDirection === 'favorable' ? 'text-emerald-600' : 'text-blue-600'}`} />
                            ) : (
                              <Minus className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <span
                              className={`font-bold ${
                                item.clinicalDirection === 'unfavorable'
                                  ? 'text-rose-700'
                                  : item.clinicalDirection === 'favorable'
                                  ? 'text-emerald-700'
                                  : 'text-slate-900'
                              }`}
                            >
                              {deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Trajectory / Deviation classification */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-2xs font-semibold px-2 py-0.5 rounded-sm inline-block ${
                            item.isMarked
                              ? item.clinicalDirection === 'unfavorable'
                                ? 'bg-rose-100 text-rose-800 font-bold'
                                : 'bg-emerald-100 text-emerald-800 font-bold'
                              : item.isSignificant
                              ? item.clinicalDirection === 'unfavorable'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                              : 'text-slate-500'
                          }`}
                        >
                          {item.deviationLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-500">
            No biomarkers match the selected category and deviation filter.
          </div>
        )}
      </div>

      {/* Derived Clinical Metrics Differentials */}
      {derivedDifferentials.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Automated Clinical Ratios & Index Differentials
              </h2>
              <p className="text-xs text-slate-500">
                Longitudinal shift in calculated atherogenic, inflammatory, and hepatic prognostic scores.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {derivedDifferentials.map((dm) => {
              const isUp = dm.delta !== undefined && dm.delta > 0;
              const isDown = dm.delta !== undefined && dm.delta < 0;

              return (
                <div
                  key={dm.name}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{dm.name}</span>
                    <span className="text-3xs text-slate-500 font-mono">Target: {dm.target}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 py-1 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-3xs text-slate-400 block font-medium">Session A</span>
                      <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                        {dm.valA !== undefined ? dm.valA : 'N/A'}
                      </div>
                      <span className="text-3xs font-semibold text-slate-500">{dm.statusA || 'N/A'}</span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-3xs text-slate-400 block font-medium">Session B</span>
                      <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                        {dm.valB !== undefined ? dm.valB : 'N/A'}
                      </div>
                      <span className="text-3xs font-semibold text-slate-500">{dm.statusB || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-2xs text-slate-500">Differential:</span>
                    {dm.delta !== undefined ? (
                      <span className={`font-mono font-bold ${isUp ? 'text-blue-700' : isDown ? 'text-amber-700' : 'text-slate-600'}`}>
                        {isUp ? `+${dm.delta}` : dm.delta} ({dm.deltaPct! > 0 ? `+${dm.deltaPct}%` : `${dm.deltaPct}%`})
                      </span>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

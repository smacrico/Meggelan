import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Share2,
  Stethoscope,
  HeartPulse,
  Brain,
  Info,
  Clock,
  ArrowRight,
  Filter,
  Search,
} from 'lucide-react';
import { PatientProfile, TestSession } from '../types/clinical';
import {
  fetchAiTrendSummary,
  formatEhrExport,
  AiTrendSummaryResult,
  SignificantShift,
  SummaryTone,
  TimeHorizon,
} from '../services/aiTrendService';

interface PatientTrendAiSummaryProps {
  profile: PatientProfile;
  sessions: TestSession[];
  onSelectBiomarker?: (biomarkerId: string) => void;
  defaultExpanded?: boolean;
}

export const PatientTrendAiSummary: React.FC<PatientTrendAiSummaryProps> = ({
  profile,
  sessions,
  onSelectBiomarker,
  defaultExpanded = true,
}) => {
  const [tone, setTone] = useState<SummaryTone>('specialist');
  const [horizon, setHorizon] = useState<TimeHorizon>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [viewMode, setViewMode] = useState<'dual' | 'narrative' | 'shifts'>('dual');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [shiftSearchQuery, setShiftSearchQuery] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<AiTrendSummaryResult | null>(null);
  const [copiedEhr, setCopiedEhr] = useState<boolean>(false);
  const [checkedActions, setCheckedActions] = useState<Record<number, boolean>>({});

  // Check if patient has enough sessions for longitudinal trend analysis
  const hasEnoughSessions = sessions.length >= 2;

  // Sorted sessions
  const sortedSessions = useMemo(() => {
    return [...sessions].sort(
      (a, b) => new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime()
    );
  }, [sessions]);

  // Load summary on mount or profile / tone / horizon change
  useEffect(() => {
    if (!hasEnoughSessions) return;

    let isMounted = true;
    let stepTimer: NodeJS.Timeout;

    const loadSummary = async () => {
      setLoading(true);
      setError(null);
      setLoadingStep(1);

      stepTimer = setTimeout(() => {
        if (isMounted) setLoadingStep(2);
      }, 600);

      try {
        const result = await fetchAiTrendSummary(profile, sessions, tone, horizon);
        if (isMounted) {
          setSummaryData(result);
          setLoadingStep(3);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to synthesize blood test trends');
        }
      } finally {
        if (isMounted) {
          setTimeout(() => {
            if (isMounted) setLoading(false);
          }, 350);
        }
      }
    };

    loadSummary();

    return () => {
      isMounted = false;
      clearTimeout(stepTimer);
    };
  }, [profile.profileId, sessions.length, tone, horizon, hasEnoughSessions]);

  // Handle manual force-refresh
  const handleRefresh = async () => {
    if (!hasEnoughSessions || loading) return;
    setLoading(true);
    setError(null);
    setLoadingStep(1);

    const stepTimer = setTimeout(() => {
      setLoadingStep(2);
    }, 600);

    try {
      const result = await fetchAiTrendSummary(profile, sessions, tone, horizon, true);
      setSummaryData(result);
      setLoadingStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh blood test trends');
    } finally {
      clearTimeout(stepTimer);
      setTimeout(() => setLoading(false), 350);
    }
  };

  // Handle copy to EHR
  const handleCopyEhr = () => {
    if (!summaryData) return;
    const text = formatEhrExport(summaryData);
    navigator.clipboard.writeText(text);
    setCopiedEhr(true);
    setTimeout(() => setCopiedEhr(false), 2500);
  };

  // Filter significant shifts
  const filteredShifts = useMemo(() => {
    if (!summaryData) return [];
    let list = summaryData.significantShifts;

    if (categoryFilter !== 'All') {
      list = list.filter((s) => s.category === categoryFilter);
    }

    if (shiftSearchQuery.trim() !== '') {
      const q = shiftSearchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.clinicalInterpretation.toLowerCase().includes(q)
      );
    }

    return list;
  }, [summaryData, categoryFilter, shiftSearchQuery]);

  // Categories present in shifts
  const availableCategories = useMemo(() => {
    if (!summaryData) return ['All'];
    const cats = new Set(summaryData.significantShifts.map((s) => s.category));
    return ['All', ...Array.from(cats)];
  }, [summaryData]);

  if (!hasEnoughSessions) {
    return (
      <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/80 rounded-xl p-5 shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-xl text-blue-700 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                AI Longitudinal Trend Analysis
              </h3>
              <span className="px-2 py-0.5 text-3xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This patient currently has {sessions.length} recorded laboratory session. Longitudinal trend synthesis and biomarker shift velocity tracking require at least two distinct specimen collection sessions to compute baseline-to-present deltas.
            </p>
            <div className="pt-2 text-2xs text-blue-700 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Import additional test sessions via CSV, OCR, or simulated LIS polling to activate AI trend insights.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden transition-all">
      {/* Component Header with AI Branding & Quick Actions */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Patient Context */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-2xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30 backdrop-blur-xs">
                <Sparkles className="w-3.5 h-3.5 text-blue-300 animate-pulse" />
                <span>AI Clinical Trend Synthesizer</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-3xs font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {summaryData?.source === 'gemini-3.8-flash' ? 'Gemini 3.8 Flash' : 'Clinical Heuristic Engine'}
              </span>
              <span className="text-3xs text-slate-300 font-mono">
                MRN: {profile.mrn} · {sortedSessions.length} Sessions
              </span>
            </div>

            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Longitudinal Blood Test Trend Summary</span>
              <span className="text-xs font-normal text-slate-300">
                ({profile.firstName} {profile.lastName}, {profile.gender})
              </span>
            </h2>

            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Automated multi-session delta velocity calculations, out-of-range boundary crossings, and pathophysiological trend interpretation.
            </p>
          </div>

          {/* Action Bar: Controls, Regenerate, Copy EHR, Collapse */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Tone Selector */}
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/80 text-2xs">
              <button
                onClick={() => setTone('specialist')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  tone === 'specialist'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Specialist / Physician: Pathophysiology and clinical diagnosis"
              >
                Specialist
              </button>
              <button
                onClick={() => setTone('patient')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  tone === 'patient'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Patient-Friendly: Accessible, clear consultation language"
              >
                Patient
              </button>
              <button
                onClick={() => setTone('brief')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                  tone === 'brief'
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Executive Rounds: Bullet points and high-yield delta velocities"
              >
                Rounds Brief
              </button>
            </div>

            {/* Time Horizon Selector */}
            <select
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as TimeHorizon)}
              className="bg-slate-800/80 border border-slate-700/80 text-slate-200 text-2xs font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400 cursor-pointer"
              title="Observation Time Horizon"
            >
              <option value="all">All Visits ({sortedSessions.length})</option>
              <option value="latest-two">Latest vs Prior Visit</option>
              <option value="1y">Past 12 Months</option>
              <option value="2y">Past 24 Months</option>
            </select>

            {/* Refresh / Regenerate Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-lg text-2xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Regenerate Trend Analysis"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{loading ? 'Synthesizing...' : 'Re-analyze'}</span>
            </button>

            {/* Copy to EHR Button */}
            <button
              onClick={handleCopyEhr}
              disabled={!summaryData || loading}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-2xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copy clinical report to EHR clipboard"
            >
              {copiedEhr ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span className="hidden sm:inline">Copy EHR</span>
                </>
              )}
            </button>

            {/* Expand / Collapse Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse Summary' : 'Expand Summary'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="p-5 space-y-6">
          {/* Loading Skeleton with Progress Steps */}
          {loading && (
            <div className="py-8 px-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4 text-center">
              <div className="inline-flex p-3 bg-blue-100 text-blue-700 rounded-2xl animate-pulse">
                <Brain className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">
                  Synthesizing Longitudinal Biomarker Trends
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {loadingStep === 1 && 'Step 1/3: Parsing serial blood test sessions and baseline dates...'}
                  {loadingStep === 2 && 'Step 2/3: Calculating biomarker delta shift percentages and reference thresholds...'}
                  {loadingStep >= 3 && 'Step 3/3: Synthesizing natural language clinical insights with Gemini 3.8 Flash...'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-sm mx-auto bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(loadingStep / 3) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && !loading && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start justify-between gap-3 text-rose-800 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Unable to generate AI trend summary</p>
                  <p className="text-rose-600 mt-0.5">{error}</p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-semibold text-2xs cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Main Content when Summary Ready */}
          {summaryData && !loading && (
            <>
              {/* Executive Clinical Synopsis Card */}
              <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 border border-blue-200 rounded-xl p-4.5 relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2.5">
                  <span className="text-2xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-blue-600" />
                    <span>Executive Clinical Synopsis</span>
                  </span>

                  <div className="flex items-center gap-2 text-3xs font-mono text-slate-500">
                    <span>Window: {summaryData.timeHorizon.baselineDate} → {summaryData.timeHorizon.latestDate}</span>
                    <span>({summaryData.timeHorizon.horizonDays} days, {summaryData.timeHorizon.sessionCount} sessions)</span>
                  </div>
                </div>

                <p className="text-xs text-slate-800 font-medium leading-relaxed">
                  {summaryData.executiveSynopsis}
                </p>

                {/* Patient Context Badges */}
                <div className="mt-3 pt-2.5 border-t border-blue-200/60 flex flex-wrap items-center gap-2 text-2xs">
                  <span className="text-slate-500 font-medium">Patient Context:</span>
                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-medium">
                    {summaryData.patient.age}y {summaryData.patient.gender}
                  </span>
                  {summaryData.patient.conditions.map((cond) => (
                    <span
                      key={cond}
                      className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 rounded font-medium"
                    >
                      {cond}
                    </span>
                  ))}
                  {summaryData.patient.medications.map((med) => (
                    <span
                      key={med}
                      className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-800 rounded font-medium"
                    >
                      Rx: {med}
                    </span>
                  ))}
                </div>
              </div>

              {/* View Mode Tabs: Dual View, Significant Shifts Table, Comprehensive Narrative */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-2xs font-semibold">
                  <button
                    onClick={() => setViewMode('dual')}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                      viewMode === 'dual'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>Integrated Dual View</span>
                  </button>
                  <button
                    onClick={() => setViewMode('shifts')}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                      viewMode === 'shifts'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Significant Shifts Grid ({summaryData.significantShifts.length})</span>
                  </button>
                  <button
                    onClick={() => setViewMode('narrative')}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                      viewMode === 'narrative'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Clinical Narrative & Actions</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-2xs text-slate-500">
                  <span className="font-semibold text-slate-700 font-mono">
                    {summaryData.significantShifts.filter((s) => s.significance !== 'stable').length}
                  </span>
                  <span>biomarkers with active velocity</span>
                </div>
              </div>

              {/* 1. SIGNIFICANT BIOMARKER SHIFTS SECTION (Visible in 'dual' and 'shifts') */}
              {(viewMode === 'dual' || viewMode === 'shifts') && (
                <div className="space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <span>Significant Biomarker Shifts & Delta Velocities</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Ranked by clinical significance, critical thresholds, and longitudinal percentage change from baseline ({summaryData.timeHorizon.baselineDate}).
                      </p>
                    </div>

                    {/* Quick Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                        <input
                          type="text"
                          placeholder="Search shifts..."
                          value={shiftSearchQuery}
                          onChange={(e) => setShiftSearchQuery(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2 py-1 text-2xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 w-36 sm:w-44"
                        />
                      </div>

                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-2xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        {availableCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Shifts Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredShifts.slice(0, viewMode === 'shifts' ? 50 : 6).map((shift) => {
                      const isUp = shift.direction === 'up';
                      const isDown = shift.direction === 'down';
                      const isCrit = shift.significance === 'critical';
                      const isHigh = shift.significance === 'high';
                      const isWorsening = shift.statusTransition.isWorsening;
                      const isImproving = shift.statusTransition.isImproving;

                      // Pill styling
                      let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                      if (isCrit) {
                        badgeColor = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
                      } else if (isWorsening) {
                        badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
                      } else if (isImproving) {
                        badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                      }

                      return (
                        <div
                          key={shift.biomarkerId}
                          onClick={() => onSelectBiomarker?.(shift.biomarkerId)}
                          className={`bg-white border rounded-xl p-3.5 space-y-2.5 transition-all hover:shadow-sm cursor-pointer ${
                            isCrit
                              ? 'border-rose-200 bg-rose-50/20'
                              : isWorsening
                              ? 'border-amber-200/80 bg-amber-50/10'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* Row 1: Biomarker Title & Category */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900">
                                  {shift.name}
                                </span>
                                {isCrit && (
                                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                )}
                              </div>
                              <span className="text-3xs text-slate-500 font-medium">
                                {shift.category}
                              </span>
                            </div>

                            {/* Significance Badge */}
                            <span
                              className={`px-2 py-0.5 text-3xs font-semibold rounded-full border ${badgeColor}`}
                            >
                              {isCrit
                                ? 'Critical Departure'
                                : isHigh
                                ? 'Significant Shift'
                                : isImproving
                                ? 'Normalization'
                                : isWorsening
                                ? 'Deterioration'
                                : 'Mild Fluctuation'}
                            </span>
                          </div>

                          {/* Row 2: Baseline vs Latest Metric Row */}
                          <div className="flex items-center justify-between bg-slate-50 border border-slate-200/60 rounded-lg p-2 text-2xs">
                            <div className="space-y-0.5">
                              <span className="text-3xs text-slate-400 block font-mono">
                                Baseline ({shift.baselineDate})
                              </span>
                              <span className="font-mono font-semibold text-slate-700">
                                {shift.baselineValue} {shift.unit}
                              </span>
                              <span className="text-3xs text-slate-500 block">
                                ({shift.statusTransition.from})
                              </span>
                            </div>

                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

                            <div className="space-y-0.5 text-right">
                              <span className="text-3xs text-slate-400 block font-mono">
                                Latest ({shift.latestDate})
                              </span>
                              <span className="font-mono font-bold text-slate-900">
                                {shift.latestValue} {shift.unit}
                              </span>
                              <span
                                className={`text-3xs font-semibold block ${
                                  shift.statusTransition.to === 'Normal'
                                    ? 'text-emerald-600'
                                    : shift.statusTransition.to.includes('Critical')
                                    ? 'text-rose-600'
                                    : 'text-amber-600'
                                }`}
                              >
                                ({shift.statusTransition.to})
                              </span>
                            </div>

                            {/* Delta Pill */}
                            <div
                              className={`px-2 py-1 rounded-md text-2xs font-mono font-bold flex items-center gap-1 shrink-0 ${
                                isWorsening || isCrit
                                  ? 'bg-rose-100 text-rose-800'
                                  : isImproving
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-800'
                              }`}
                            >
                              {isUp ? (
                                <TrendingUp className="w-3.5 h-3.5" />
                              ) : isDown ? (
                                <TrendingDown className="w-3.5 h-3.5" />
                              ) : (
                                <Minus className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {shift.percentChange > 0 ? '+' : ''}
                                {shift.percentChange}%
                              </span>
                            </div>
                          </div>

                          {/* Row 3: Clinical Interpretation Note */}
                          <p className="text-2xs text-slate-600 leading-snug">
                            {shift.clinicalInterpretation}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {viewMode === 'dual' && filteredShifts.length > 6 && (
                    <div className="text-center pt-1">
                      <button
                        onClick={() => setViewMode('shifts')}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        View all {filteredShifts.length} biomarker shifts in full table →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. PANEL-BY-PANEL STATUS CARDS */}
              {summaryData.panelSummaries.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-2xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>Organ System & Panel Health Status</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {summaryData.panelSummaries.map((panel) => {
                      let border = 'border-slate-200 bg-white';
                      let statusBadge = 'bg-slate-100 text-slate-700';

                      if (panel.status === 'critical') {
                        border = 'border-rose-200 bg-rose-50/30';
                        statusBadge = 'bg-rose-100 text-rose-800 font-bold';
                      } else if (panel.status === 'attention-required') {
                        border = 'border-amber-200 bg-amber-50/30';
                        statusBadge = 'bg-amber-100 text-amber-800';
                      } else if (panel.status === 'improved') {
                        border = 'border-emerald-200 bg-emerald-50/30';
                        statusBadge = 'bg-emerald-100 text-emerald-800';
                      }

                      return (
                        <div
                          key={panel.category}
                          className={`p-3 rounded-lg border text-2xs space-y-1.5 ${border}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{panel.category}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-3xs font-semibold uppercase tracking-wider ${statusBadge}`}
                            >
                              {panel.status.replace('-', ' ')}
                            </span>
                          </div>
                          <p className="text-slate-600 leading-snug line-clamp-2">
                            {panel.highlight}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. CLINICAL NARRATIVE & SURVEILLANCE ACTIONS (Visible in 'dual' and 'narrative') */}
              {(viewMode === 'dual' || viewMode === 'narrative') && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
                  {/* Left Column: Markdown Narrative */}
                  <div className="lg:col-span-8 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>Synthesized Clinical Narrative</span>
                      </h4>
                      <span className="text-3xs text-slate-400 font-mono">
                        Tone: {tone.toUpperCase()}
                      </span>
                    </div>

                    <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 text-xs text-slate-800 space-y-3 leading-relaxed whitespace-pre-line font-normal">
                      {summaryData.narrativeSummary}
                    </div>

                    {/* Key Takeaways */}
                    {summaryData.clinicalKeyTakeaways.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                        <span className="text-2xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Clinical Key Takeaways</span>
                        </span>
                        <ul className="space-y-1.5 text-xs text-slate-700">
                          {summaryData.clinicalKeyTakeaways.map((takeaway, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-emerald-600 font-bold mt-0.5">•</span>
                              <span>{takeaway}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Suggested Actions & Surveillance Checklist */}
                  <div className="lg:col-span-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Actionable Surveillance Plan</span>
                      </h4>
                      <span className="text-3xs text-indigo-600 font-semibold">Interactive</span>
                    </div>

                    <div className="bg-white border border-indigo-100 rounded-xl p-4 space-y-3 shadow-2xs">
                      <p className="text-2xs text-slate-500">
                        Guideline-directed follow-up actions based on detected biomarker shift velocity:
                      </p>

                      <div className="space-y-2">
                        {summaryData.suggestedActions.map((action, idx) => {
                          const isChecked = !!checkedActions[idx];
                          return (
                            <label
                              key={idx}
                              onClick={() =>
                                setCheckedActions((prev) => ({ ...prev, [idx]: !prev[idx] }))
                              }
                              className={`flex items-start gap-2.5 p-2 rounded-lg text-xs transition-colors cursor-pointer border ${
                                isChecked
                                  ? 'bg-emerald-50/60 border-emerald-200 text-slate-500 line-through'
                                  : 'bg-slate-50/60 border-slate-200/80 text-slate-800 hover:bg-slate-100/60'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded text-blue-600 focus:ring-blue-500 mt-0.5 cursor-pointer"
                              />
                              <span className="text-2xs leading-relaxed">{action}</span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-3xs text-slate-500">
                        <span>Check off items as completed</span>
                        <button
                          onClick={handleCopyEhr}
                          className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                        >
                          Export to EHR note
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import {
  Hourglass,
  Activity,
  Heart,
  Flame,
  Zap,
  TrendingDown,
  TrendingUp,
  Minus,
  Sparkles,
  Info,
  Sliders,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import {
  PatientProfile,
  TestSession,
  BiometricAgeEstimation,
  BiometricAgeWeights,
} from '../types/clinical';
import {
  calculateBiometricAge,
  DEFAULT_BIOMETRIC_AGE_WEIGHTS,
} from '../services/biometricAgeEngine';

interface BiometricAgeCardProps {
  profile: PatientProfile;
  sessions: TestSession[];
  initialEstimation?: BiometricAgeEstimation;
}

export const BiometricAgeCard: React.FC<BiometricAgeCardProps> = ({
  profile,
  sessions,
  initialEstimation,
}) => {
  // Custom interactive domain weights
  const [weights, setWeights] = useState<BiometricAgeWeights>(DEFAULT_BIOMETRIC_AGE_WEIGHTS);
  const [showWeightControls, setShowWeightControls] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [activeDomainTab, setActiveDomainTab] = useState<'all' | 'inflammation' | 'cardiovascular' | 'metabolic'>('all');

  // Simulation toggles
  const [simSuppressedCrp, setSimSuppressedCrp] = useState(false);
  const [simOptimizedLipids, setSimOptimizedLipids] = useState(false);
  const [simTightGlucose, setSimTightGlucose] = useState(false);

  // Recalculate baseline estimation with active weights
  const baseEstimation = useMemo(() => {
    return calculateBiometricAge(profile, sessions, weights);
  }, [profile, sessions, weights]);

  // Simulated estimation if toggled
  const simulatedEstimation = useMemo(() => {
    if (!simSuppressedCrp && !simOptimizedLipids && !simTightGlucose) {
      return baseEstimation;
    }

    // Clone sessions and simulate biomarker modifications on latest session
    const sorted = [...sessions].sort(
      (a, b) => new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime()
    );
    if (sorted.length === 0) return baseEstimation;

    const modifiedSessions = sorted.map((s, idx) => {
      if (idx !== sorted.length - 1) return s;
      const newResults = s.results.map((r) => {
        if (r.biomarkerId === 'bm-crp' && simSuppressedCrp) {
          return { ...r, resultValue: 0.6, status: 'Normal' as const };
        }
        if (r.biomarkerId === 'bm-ldl' && simOptimizedLipids) {
          return { ...r, resultValue: 78, status: 'Normal' as const };
        }
        if (r.biomarkerId === 'bm-tg' && simOptimizedLipids) {
          return { ...r, resultValue: 85, status: 'Normal' as const };
        }
        if (r.biomarkerId === 'bm-hdl' && simOptimizedLipids) {
          return { ...r, resultValue: 62, status: 'Normal' as const };
        }
        if (r.biomarkerId === 'bm-hba1c' && simTightGlucose) {
          return { ...r, resultValue: 5.1, status: 'Normal' as const };
        }
        if (r.biomarkerId === 'bm-glu' && simTightGlucose) {
          return { ...r, resultValue: 84, status: 'Normal' as const };
        }
        return r;
      });
      return { ...s, results: newResults };
    });

    return calculateBiometricAge(profile, modifiedSessions, weights);
  }, [baseEstimation, profile, sessions, weights, simSuppressedCrp, simOptimizedLipids, simTightGlucose]);

  const estimation = simulatedEstimation;
  const isSimulating = simSuppressedCrp || simOptimizedLipids || simTightGlucose;

  const {
    chronologicalAge,
    biometricAge,
    ageDelta,
    agingPace,
    agingTier,
    domains,
    historicalTrajectory,
    rejuvenationLevers,
    overallAssessment,
  } = estimation;

  const isYounger = ageDelta < -0.4;
  const isOlder = ageDelta > 0.4;

  const deltaBadgeColor = isYounger
    ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
    : isOlder
    ? ageDelta > 3.0
      ? 'text-rose-800 bg-rose-50 border-rose-300'
      : 'text-amber-800 bg-amber-50 border-amber-300'
    : 'text-slate-700 bg-slate-100 border-slate-300';

  // SVG Chart Geometry for Historical Biometric Age Trajectory
  const trajectoryChart = useMemo(() => {
    if (!historicalTrajectory || historicalTrajectory.length < 2) return null;

    const points = historicalTrajectory;
    const allAges = points.flatMap((p) => [p.chronologicalAge, p.biometricAge]);
    const minAge = Math.floor(Math.min(...allAges) - 1.5);
    const maxAge = Math.ceil(Math.max(...allAges) + 1.5);
    const ageRange = maxAge - minAge || 1;

    const width = 560;
    const height = 180;
    const padL = 40;
    const padR = 30;
    const padT = 20;
    const padB = 30;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const t0 = new Date(points[0].collectionDate).getTime();
    const tEnd = new Date(points[points.length - 1].collectionDate).getTime();
    const timeSpan = tEnd - t0 || 1;

    const getX = (dateStr: string) => {
      const t = new Date(dateStr).getTime();
      return padL + ((t - t0) / timeSpan) * plotW;
    };

    const getY = (ageVal: number) => {
      return padT + plotH - ((ageVal - minAge) / ageRange) * plotH;
    };

    const chronoPathPts = points.map((p) => `${getX(p.collectionDate)},${getY(p.chronologicalAge)}`);
    const bioPathPts = points.map((p) => `${getX(p.collectionDate)},${getY(p.biometricAge)}`);

    return {
      width,
      height,
      minAge,
      maxAge,
      points: points.map((p) => ({
        ...p,
        x: getX(p.collectionDate),
        chronoY: getY(p.chronologicalAge),
        bioY: getY(p.biometricAge),
      })),
      chronoPath: `M ${chronoPathPts.join(' L ')}`,
      bioPath: `M ${bioPathPts.join(' L ')}`,
    };
  }, [historicalTrajectory]);

  // Quick weight presets
  const applyPreset = (preset: 'default' | 'inflammation' | 'cardio' | 'metabolic' | 'equal') => {
    if (preset === 'default') setWeights(DEFAULT_BIOMETRIC_AGE_WEIGHTS);
    else if (preset === 'inflammation') setWeights({ inflammation: 0.50, cardiovascular: 0.25, metabolic: 0.25 });
    else if (preset === 'cardio') setWeights({ inflammation: 0.20, cardiovascular: 0.60, metabolic: 0.20 });
    else if (preset === 'metabolic') setWeights({ inflammation: 0.20, cardiovascular: 0.20, metabolic: 0.60 });
    else if (preset === 'equal') setWeights({ inflammation: 0.333, cardiovascular: 0.333, metabolic: 0.334 });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
      {/* Top Header & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Hourglass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Biometric Age Longevity Engine
                </h2>
                <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Weighted Multi-Analyte Clock
                </span>
                {isSimulating && (
                  <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                    Simulation Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Weighted algorithmic estimation analyzing systemic inflammation (hs-CRP), cardiovascular lipids, and metabolic kinetics.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls: Weights Toggle & Simulation Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showSimulator || isSimulating
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Rejuvenation Simulator</span>
            {showSimulator ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setShowWeightControls(!showWeightControls)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showWeightControls
                ? 'bg-slate-100 border-slate-300 text-slate-900 font-semibold'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Adjust Weights</span>
            {showWeightControls ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Customizable Weights Drawer */}
      {showWeightControls && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Custom Domain Weighting Ratios</h4>
              <p className="text-2xs text-slate-500">
                Calibrate biological weighting according to patient's clinical focus or family history.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-2xs">
              <span className="text-slate-400 font-medium">Presets:</span>
              <button
                onClick={() => applyPreset('default')}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
              >
                Standard (30/40/30)
              </button>
              <button
                onClick={() => applyPreset('inflammation')}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
              >
                Inflammatory Focus
              </button>
              <button
                onClick={() => applyPreset('cardio')}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
              >
                Lipid Focus
              </button>
              <button
                onClick={() => applyPreset('metabolic')}
                className="px-2 py-0.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
              >
                Glycemic Focus
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <span className="flex items-center gap-1.5 text-rose-700">
                  <Flame className="w-3.5 h-3.5" /> Inflammation (hs-CRP)
                </span>
                <span className="font-mono text-xs">{Math.round(domains.inflammation.weight * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.05"
                value={weights.inflammation}
                onChange={(e) => setWeights({ ...weights, inflammation: parseFloat(e.target.value) })}
                className="w-full accent-rose-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="text-3xs text-slate-400 block">Weighted Impact: {domains.inflammation.ageDelta > 0 ? '+' : ''}{domains.inflammation.ageDelta} yrs</span>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <span className="flex items-center gap-1.5 text-blue-700">
                  <Heart className="w-3.5 h-3.5" /> Cardiovascular (Lipids)
                </span>
                <span className="font-mono text-xs">{Math.round(domains.cardiovascular.weight * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.05"
                value={weights.cardiovascular}
                onChange={(e) => setWeights({ ...weights, cardiovascular: parseFloat(e.target.value) })}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="text-3xs text-slate-400 block">Weighted Impact: {domains.cardiovascular.ageDelta > 0 ? '+' : ''}{domains.cardiovascular.ageDelta} yrs</span>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <span className="flex items-center gap-1.5 text-amber-700">
                  <Zap className="w-3.5 h-3.5" /> Metabolic (Glucose/A1c)
                </span>
                <span className="font-mono text-xs">{Math.round(domains.metabolic.weight * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.05"
                value={weights.metabolic}
                onChange={(e) => setWeights({ ...weights, metabolic: parseFloat(e.target.value) })}
                className="w-full accent-amber-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
              <span className="text-3xs text-slate-400 block">Weighted Impact: {domains.metabolic.ageDelta > 0 ? '+' : ''}{domains.metabolic.ageDelta} yrs</span>
            </div>
          </div>
        </div>
      )}

      {/* Rejuvenation "What-If" Simulator Drawer */}
      {showSimulator && (
        <div className="p-4 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 border border-indigo-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <div>
                <h4 className="text-xs font-bold text-slate-900">Interactive Clinical Rejuvenation Simulator</h4>
                <p className="text-2xs text-slate-600">
                  Simulate targeted pharmacological and nutritional interventions to observe projected biological age rollback.
                </p>
              </div>
            </div>
            {isSimulating && (
              <button
                onClick={() => {
                  setSimSuppressedCrp(false);
                  setSimOptimizedLipids(false);
                  setSimTightGlucose(false);
                }}
                className="text-2xs text-indigo-700 hover:text-indigo-900 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset Simulation
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              onClick={() => setSimSuppressedCrp(!simSuppressedCrp)}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                simSuppressedCrp
                  ? 'bg-white border-indigo-500 shadow-xs ring-1 ring-indigo-400'
                  : 'bg-white/70 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Suppress hs-CRP &lt; 0.8</span>
                <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${simSuppressedCrp ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  -1.8 yrs
                </span>
              </div>
              <p className="text-3xs text-slate-500 mt-1">High-dose EPA/DHA (2-3g) + anti-inflammatory nutrition</p>
            </button>

            <button
              onClick={() => setSimOptimizedLipids(!simOptimizedLipids)}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                simOptimizedLipids
                  ? 'bg-white border-indigo-500 shadow-xs ring-1 ring-indigo-400'
                  : 'bg-white/70 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Optimize Lipids (LDL &lt; 80)</span>
                <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${simOptimizedLipids ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  -2.2 yrs
                </span>
              </div>
              <p className="text-3xs text-slate-500 mt-1">Atherogenic lipid normalization & TG &lt; 90 mg/dL</p>
            </button>

            <button
              onClick={() => setSimTightGlucose(!simTightGlucose)}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                simTightGlucose
                  ? 'bg-white border-indigo-500 shadow-xs ring-1 ring-indigo-400'
                  : 'bg-white/70 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">HbA1c &lt; 5.2% & Euglycemia</span>
                <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${simTightGlucose ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  -1.6 yrs
                </span>
              </div>
              <p className="text-3xs text-slate-500 mt-1">Muscle glucose disposal & carbohydrate moderation</p>
            </button>
          </div>
        </div>
      )}

      {/* Main Hero Age Display Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Side: Chronological vs. Biometric Age Hero Card */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 rounded-xl p-6 text-white flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-indigo-900/60">
              <span className="text-2xs uppercase tracking-wider font-semibold text-indigo-300">
                Cellular Aging Assessment
              </span>
              <span className={`text-2xs font-bold px-2 py-0.5 rounded-full border ${
                isYounger
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : isOlder
                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {agingTier}
              </span>
            </div>

            {/* Core Age Differential Display */}
            <div className="grid grid-cols-2 gap-4 mt-5">
              <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 text-center">
                <span className="text-3xs uppercase tracking-wider font-medium text-slate-400 block mb-1">
                  Chronological Age
                </span>
                <div className="text-3xl font-extrabold font-mono tabular-nums text-slate-200">
                  {chronologicalAge}
                  <span className="text-xs font-normal text-slate-400 font-sans ml-1">yrs</span>
                </div>
                <div className="text-3xs text-slate-400 mt-1">
                  DOB: {profile.dob}
                </div>
              </div>

              <div className={`p-3.5 rounded-lg text-center border ${
                isYounger
                  ? 'bg-emerald-950/40 border-emerald-500/40'
                  : isOlder
                  ? 'bg-amber-950/40 border-amber-500/40'
                  : 'bg-white/10 border-white/20'
              }`}>
                <span className="text-3xs uppercase tracking-wider font-medium text-indigo-300 block mb-1">
                  Estimated Biometric Age
                </span>
                <div className={`text-3xl font-extrabold font-mono tabular-nums ${
                  isYounger ? 'text-emerald-300' : isOlder ? 'text-amber-300' : 'text-white'
                }`}>
                  {biometricAge}
                  <span className="text-xs font-normal text-indigo-200 font-sans ml-1">yrs</span>
                </div>
                <div className="text-3xs text-indigo-200 mt-1">
                  {isSimulating ? 'Managed Projection' : 'Current Clinical Velocity'}
                </div>
              </div>
            </div>

            {/* Delta Callout Ribbon */}
            <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isYounger ? (
                  <TrendingDown className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : isOlder ? (
                  <TrendingUp className="w-5 h-5 text-rose-400 shrink-0" />
                ) : (
                  <Minus className="w-5 h-5 text-slate-400 shrink-0" />
                )}
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5 font-mono">
                    <span>{ageDelta > 0 ? `+${ageDelta}` : ageDelta} Years</span>
                    <span className="text-2xs font-sans font-normal text-slate-300">
                      {isYounger ? 'Biological Deceleration' : isOlder ? 'Biological Acceleration' : 'Biological Parity'}
                    </span>
                  </div>
                  <div className="text-3xs text-slate-400">
                    Velocity Pace: <span className="font-mono font-semibold text-slate-200">{agingPace}x</span> biological rate / calendar year
                  </div>
                </div>
              </div>

              <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded-md border ${
                isYounger
                  ? 'bg-emerald-900/60 text-emerald-200 border-emerald-600'
                  : isOlder
                  ? 'bg-rose-900/60 text-rose-200 border-rose-600'
                  : 'bg-slate-800 text-slate-300 border-slate-600'
              }`}>
                {isYounger ? `${Math.abs(ageDelta)}y Younger` : isOlder ? `+${ageDelta}y Older` : 'Synced'}
              </span>
            </div>
          </div>

          <p className="mt-4 text-3xs text-indigo-200/80 leading-relaxed italic border-t border-indigo-900/40 pt-3">
            {overallAssessment}
          </p>
        </div>

        {/* Right Side: Longitudinal Trajectory Chart or Domain Differential Summary */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Longitudinal Biological vs Chronological Trajectory
                </h3>
              </div>
              <span className="text-2xs text-slate-500 font-mono">
                {historicalTrajectory.length} Test Sessions
              </span>
            </div>

            {/* Trajectory SVG */}
            {trajectoryChart ? (
              <div className="mt-3">
                <div className="flex items-center justify-between text-2xs text-slate-500 mb-1">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-slate-400 inline-block border-dashed" />
                      <span>Chronological (Calendar)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-indigo-600 inline-block" />
                      <span className="font-medium text-indigo-700">Biometric Age</span>
                    </span>
                  </div>
                  <span className="text-3xs text-slate-400">Scale: {trajectoryChart.minAge}y - {trajectoryChart.maxAge}y</span>
                </div>

                <div className="w-full overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${trajectoryChart.width} ${trajectoryChart.height}`}
                    className="w-full h-auto max-h-[160px] select-none"
                  >
                    {/* Grid lines */}
                    <line x1="40" y1="20" x2="530" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="40" y1="85" x2="530" y2="85" stroke="#f1f5f9" strokeWidth="1" />
                    <line x1="40" y1="150" x2="530" y2="150" stroke="#e2e8f0" strokeWidth="1" />

                    {/* Chronological baseline line (dashed slate) */}
                    <path
                      d={trajectoryChart.chronoPath}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />

                    {/* Biometric Age curve (indigo line) */}
                    <path
                      d={trajectoryChart.bioPath}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="2.5"
                    />

                    {/* Data Points */}
                    {trajectoryChart.points.map((pt, i) => (
                      <g key={pt.sessionId}>
                        {/* Chrono dot */}
                        <circle cx={pt.x} cy={pt.chronoY} r="3" fill="#64748b" />
                        {/* Bio dot */}
                        <circle
                          cx={pt.x}
                          cy={pt.bioY}
                          r="4.5"
                          fill={pt.deltaYears < 0 ? '#10b981' : pt.deltaYears > 1.5 ? '#f43f5e' : '#eab308'}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                        />
                        {/* Value labels on last point */}
                        {i === trajectoryChart.points.length - 1 && (
                          <>
                            <text
                              x={pt.x}
                              y={pt.bioY - 8}
                              fontSize="9"
                              fontWeight="bold"
                              fill="#1e1b4b"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              {pt.biometricAge}y
                            </text>
                            <text
                              x={pt.x}
                              y={pt.chronoY + 12}
                              fontSize="8"
                              fill="#64748b"
                              textAnchor="middle"
                              fontFamily="monospace"
                            >
                              {pt.chronologicalAge}y
                            </text>
                          </>
                        )}
                        {/* Date micro-label */}
                        <text
                          x={pt.x}
                          y="164"
                          fontSize="7"
                          fill="#94a3b8"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {pt.collectionDate.slice(5)}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Single session recorded. A multi-visit trajectory will display here as additional visits are ingested.
              </div>
            )}
          </div>

          {/* Quick Domain Contribution Summary Bar */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-2xs text-slate-500 mb-2">
              <span className="font-semibold text-slate-700">Domain Delta Composition:</span>
              <span>Normalized Net: {ageDelta > 0 ? `+${ageDelta}` : ageDelta} yrs</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-2xs">
              <div className="p-2 bg-rose-50/70 border border-rose-200/60 rounded-lg">
                <span className="text-rose-800 font-semibold block text-3xs">Inflammation (CRP)</span>
                <span className="font-mono font-bold text-rose-950 text-xs">
                  {domains.inflammation.ageDelta > 0 ? `+${domains.inflammation.ageDelta}` : domains.inflammation.ageDelta}y
                </span>
                <span className="text-3xs text-rose-600 block mt-0.5">
                  Weight: {Math.round(domains.inflammation.weight * 100)}%
                </span>
              </div>

              <div className="p-2 bg-blue-50/70 border border-blue-200/60 rounded-lg">
                <span className="text-blue-800 font-semibold block text-3xs">Cardiovascular (Lipids)</span>
                <span className="font-mono font-bold text-blue-950 text-xs">
                  {domains.cardiovascular.ageDelta > 0 ? `+${domains.cardiovascular.ageDelta}` : domains.cardiovascular.ageDelta}y
                </span>
                <span className="text-3xs text-blue-600 block mt-0.5">
                  Weight: {Math.round(domains.cardiovascular.weight * 100)}%
                </span>
              </div>

              <div className="p-2 bg-amber-50/70 border border-amber-200/60 rounded-lg">
                <span className="text-amber-800 font-semibold block text-3xs">Metabolic (A1c/Glu)</span>
                <span className="font-mono font-bold text-amber-950 text-xs">
                  {domains.metabolic.ageDelta > 0 ? `+${domains.metabolic.ageDelta}` : domains.metabolic.ageDelta}y
                </span>
                <span className="text-3xs text-amber-600 block mt-0.5">
                  Weight: {Math.round(domains.metabolic.weight * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Domain Breakdown Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Weighted Biomarker Domain Analysis & Trends
            </h3>
            <p className="text-2xs text-slate-500">
              Granular breakdown of analytes contributing to biological age acceleration or deceleration.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 text-xs">
            {(['all', 'inflammation', 'cardiovascular', 'metabolic'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveDomainTab(tab)}
                className={`px-2.5 py-1 text-2xs rounded-md transition-colors cursor-pointer capitalize ${
                  activeDomainTab === tab
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'all' ? 'All Domains' : tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. INFLAMMATION DOMAIN */}
          {(activeDomainTab === 'all' || activeDomainTab === 'inflammation') && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Inflammation Domain</h4>
                      <span className="text-3xs text-slate-500">Weight: {Math.round(domains.inflammation.weight * 100)}%</span>
                    </div>
                  </div>
                  <span className={`text-2xs font-bold font-mono px-2 py-0.5 rounded-md ${
                    domains.inflammation.ageDelta <= 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {domains.inflammation.ageDelta > 0 ? `+${domains.inflammation.ageDelta}` : domains.inflammation.ageDelta} yrs
                  </span>
                </div>

                <p className="text-2xs text-slate-600 mt-2 leading-relaxed">
                  {domains.inflammation.clinicalSummary}
                </p>

                {/* Analyte Drivers List */}
                <div className="mt-3 space-y-2">
                  {domains.inflammation.drivingBiomarkers.map((driver) => (
                    <div
                      key={driver.biomarkerId}
                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1 text-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{driver.name}</span>
                        <span className="font-mono font-bold text-slate-900">
                          {driver.value} {driver.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-3xs text-slate-500">
                        <span>Target: {driver.optimalRange}</span>
                        <span className="flex items-center gap-1 font-medium">
                          {driver.trendDirection === 'Improving' && (
                            <span className="text-emerald-600 flex items-center gap-0.5">
                              <TrendingDown className="w-2.5 h-2.5" /> Improving
                            </span>
                          )}
                          {driver.trendDirection === 'Worsening' && (
                            <span className="text-rose-600 flex items-center gap-0.5">
                              <TrendingUp className="w-2.5 h-2.5" /> Worsening
                            </span>
                          )}
                          {driver.trendDirection === 'Stable' && (
                            <span className="text-slate-500 flex items-center gap-0.5">
                              <Minus className="w-2.5 h-2.5" /> Stable
                            </span>
                          )}
                          <span className="font-mono font-bold ml-1 text-slate-700">
                            ({driver.contributionYears > 0 ? `+${driver.contributionYears}` : driver.contributionYears}y)
                          </span>
                        </span>
                      </div>
                      <p className="text-3xs text-slate-600 italic leading-snug">
                        {driver.clinicalRationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-3xs text-slate-600">
                <span className="font-semibold text-slate-800">Action: </span>
                {domains.inflammation.optimizationAdvice}
              </div>
            </div>
          )}

          {/* 2. CARDIOVASCULAR DOMAIN */}
          {(activeDomainTab === 'all' || activeDomainTab === 'cardiovascular') && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                      <Heart className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Cardiovascular Domain</h4>
                      <span className="text-3xs text-slate-500">Weight: {Math.round(domains.cardiovascular.weight * 100)}%</span>
                    </div>
                  </div>
                  <span className={`text-2xs font-bold font-mono px-2 py-0.5 rounded-md ${
                    domains.cardiovascular.ageDelta <= 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {domains.cardiovascular.ageDelta > 0 ? `+${domains.cardiovascular.ageDelta}` : domains.cardiovascular.ageDelta} yrs
                  </span>
                </div>

                <p className="text-2xs text-slate-600 mt-2 leading-relaxed">
                  {domains.cardiovascular.clinicalSummary}
                </p>

                {/* Analyte Drivers List */}
                <div className="mt-3 space-y-2">
                  {domains.cardiovascular.drivingBiomarkers.map((driver) => (
                    <div
                      key={driver.biomarkerId}
                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1 text-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{driver.name}</span>
                        <span className="font-mono font-bold text-slate-900">
                          {driver.value} {driver.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-3xs text-slate-500">
                        <span>Target: {driver.optimalRange}</span>
                        <span className="flex items-center gap-1 font-medium">
                          {driver.trendDirection === 'Improving' && (
                            <span className="text-emerald-600 flex items-center gap-0.5">
                              <TrendingDown className="w-2.5 h-2.5" /> Improving
                            </span>
                          )}
                          {driver.trendDirection === 'Worsening' && (
                            <span className="text-rose-600 flex items-center gap-0.5">
                              <TrendingUp className="w-2.5 h-2.5" /> Worsening
                            </span>
                          )}
                          {driver.trendDirection === 'Stable' && (
                            <span className="text-slate-500 flex items-center gap-0.5">
                              <Minus className="w-2.5 h-2.5" /> Stable
                            </span>
                          )}
                          <span className="font-mono font-bold ml-1 text-slate-700">
                            ({driver.contributionYears > 0 ? `+${driver.contributionYears}` : driver.contributionYears}y)
                          </span>
                        </span>
                      </div>
                      <p className="text-3xs text-slate-600 italic leading-snug">
                        {driver.clinicalRationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-3xs text-slate-600">
                <span className="font-semibold text-slate-800">Action: </span>
                {domains.cardiovascular.optimizationAdvice}
              </div>
            </div>
          )}

          {/* 3. METABOLIC DOMAIN */}
          {(activeDomainTab === 'all' || activeDomainTab === 'metabolic') && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Metabolic Domain</h4>
                      <span className="text-3xs text-slate-500">Weight: {Math.round(domains.metabolic.weight * 100)}%</span>
                    </div>
                  </div>
                  <span className={`text-2xs font-bold font-mono px-2 py-0.5 rounded-md ${
                    domains.metabolic.ageDelta <= 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {domains.metabolic.ageDelta > 0 ? `+${domains.metabolic.ageDelta}` : domains.metabolic.ageDelta} yrs
                  </span>
                </div>

                <p className="text-2xs text-slate-600 mt-2 leading-relaxed">
                  {domains.metabolic.clinicalSummary}
                </p>

                {/* Analyte Drivers List */}
                <div className="mt-3 space-y-2">
                  {domains.metabolic.drivingBiomarkers.map((driver) => (
                    <div
                      key={driver.biomarkerId}
                      className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1 text-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{driver.name}</span>
                        <span className="font-mono font-bold text-slate-900">
                          {driver.value} {driver.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-3xs text-slate-500">
                        <span>Target: {driver.optimalRange}</span>
                        <span className="flex items-center gap-1 font-medium">
                          {driver.trendDirection === 'Improving' && (
                            <span className="text-emerald-600 flex items-center gap-0.5">
                              <TrendingDown className="w-2.5 h-2.5" /> Improving
                            </span>
                          )}
                          {driver.trendDirection === 'Worsening' && (
                            <span className="text-rose-600 flex items-center gap-0.5">
                              <TrendingUp className="w-2.5 h-2.5" /> Worsening
                            </span>
                          )}
                          {driver.trendDirection === 'Stable' && (
                            <span className="text-slate-500 flex items-center gap-0.5">
                              <Minus className="w-2.5 h-2.5" /> Stable
                            </span>
                          )}
                          <span className="font-mono font-bold ml-1 text-slate-700">
                            ({driver.contributionYears > 0 ? `+${driver.contributionYears}` : driver.contributionYears}y)
                          </span>
                        </span>
                      </div>
                      <p className="text-3xs text-slate-600 italic leading-snug">
                        {driver.clinicalRationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-3xs text-slate-600">
                <span className="font-semibold text-slate-800">Action: </span>
                {domains.metabolic.optimizationAdvice}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clinical Rejuvenation & Optimization Levers */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Evidence-Based Biological Age Reversal Opportunities
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {rejuvenationLevers.map((lever, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-slate-900">{lever.title}</h5>
                <span className="text-2xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {lever.impactYears} yrs
                </span>
              </div>
              <p className="text-3xs text-slate-600 leading-relaxed">
                {lever.description}
              </p>
              <div className="text-3xs text-slate-400 font-medium">
                Target Analytes: {lever.targetBiomarkers.join(', ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

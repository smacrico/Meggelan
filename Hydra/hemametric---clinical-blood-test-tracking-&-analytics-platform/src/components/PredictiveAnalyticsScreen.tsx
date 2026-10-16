import React, { useState, useMemo } from 'react';
import {
  BrainCircuit,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  Calendar,
  Activity,
  ChevronRight,
  ShieldAlert,
  Gauge,
  Flame,
} from 'lucide-react';
import {
  PatientProfile,
  TestSession,
  BiomarkerTrajectory,
  HealthRiskCategory,
  ProjectedVolatilityRiskAssessment,
  SystemicInflammatoryGaugeData,
} from '../types/clinical';
import { generatePredictiveReport } from '../services/predictiveEngine';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';
import { BiometricAgeCard } from './BiometricAgeCard';

// Systemic Inflammatory Risk Gauge Component
interface InflammatoryGaugeProps {
  data: SystemicInflammatoryGaugeData;
}

const SystemicInflammatoryGauge: React.FC<InflammatoryGaugeProps> = ({ data }) => {
  const { score, riskTier, crpValue, nlrValue, plrValue, clinicalSummary } = data;

  // Semicircular Arc Geometry (180deg sweep, 0 left to 100 right)
  const cx = 140;
  const cy = 120;
  const rOuter = 92;
  const rInner = 70;

  const createArc = (startPct: number, endPct: number) => {
    const startAngle = 180 - startPct * 1.8;
    const endAngle = 180 - endPct * 1.8;
    const sRad = (startAngle * Math.PI) / 180;
    const eRad = (endAngle * Math.PI) / 180;

    const x1 = cx + rOuter * Math.cos(sRad);
    const y1 = cy - rOuter * Math.sin(sRad);
    const x2 = cx + rOuter * Math.cos(eRad);
    const y2 = cy - rOuter * Math.sin(eRad);

    const x3 = cx + rInner * Math.cos(eRad);
    const y3 = cy - rInner * Math.sin(eRad);
    const x4 = cx + rInner * Math.cos(sRad);
    const y4 = cy - rInner * Math.sin(sRad);

    return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 0 0 ${x4} ${y4} Z`;
  };

  // Needle calculations
  const needleAngle = 180 - Math.min(100, Math.max(0, score)) * 1.8;
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleLen = 78;
  const tipX = cx + needleLen * Math.cos(needleRad);
  const tipY = cy - needleLen * Math.sin(needleRad);

  const baseLeftX = cx + 5 * Math.cos(needleRad + Math.PI / 2);
  const baseLeftY = cy - 5 * Math.sin(needleRad + Math.PI / 2);
  const baseRightX = cx + 5 * Math.cos(needleRad - Math.PI / 2);
  const baseRightY = cy - 5 * Math.sin(needleRad - Math.PI / 2);

  const isCrit = riskTier === 'Critical';
  const isElev = riskTier === 'Elevated';
  const isMod = riskTier === 'Moderate';

  const tierColor = isCrit
    ? 'text-rose-700 bg-rose-50 border-rose-200'
    : isElev
    ? 'text-orange-700 bg-orange-50 border-orange-200'
    : isMod
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-emerald-700 bg-emerald-50 border-emerald-200';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between space-y-4 h-full">
      <div>
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-600" />
            <h3 className="text-sm font-bold text-slate-900">Systemic Inflammatory Risk</h3>
          </div>
          <span className={`text-2xs font-semibold px-2 py-0.5 rounded-md border ${tierColor}`}>
            {riskTier}
          </span>
        </div>
        <p className="text-2xs text-slate-500 mt-1.5 leading-snug">
          Multi-analyte endothelial & cytokine activity model integrating hs-CRP, neutrophil-to-lymphocyte, and platelet ratios.
        </p>
      </div>

      {/* SVG Arc Gauge */}
      <div className="flex flex-col items-center justify-center -my-1">
        <svg viewBox="0 0 280 148" className="w-full max-w-[260px] h-auto select-none overflow-visible">
          {/* Segments: Low (0-25), Moderate (25-50), Elevated (50-75), Critical (75-100) */}
          <path d={createArc(0, 25)} fill="#10b981" fillOpacity={0.9} />
          <path d={createArc(25, 50)} fill="#eab308" fillOpacity={0.9} />
          <path d={createArc(50, 75)} fill="#f97316" fillOpacity={0.9} />
          <path d={createArc(75, 100)} fill="#ef4444" fillOpacity={0.9} />

          {/* Tick Marks & Labels */}
          <text x="34" y="132" fontSize="9" fill="#64748b" textAnchor="middle" fontFamily="monospace">0</text>
          <text x="68" y="64" fontSize="9" fill="#64748b" textAnchor="middle" fontFamily="monospace">25</text>
          <text x="140" y="22" fontSize="9" fill="#64748b" textAnchor="middle" fontFamily="monospace">50</text>
          <text x="212" y="64" fontSize="9" fill="#64748b" textAnchor="middle" fontFamily="monospace">75</text>
          <text x="246" y="132" fontSize="9" fill="#64748b" textAnchor="middle" fontFamily="monospace">100</text>

          {/* Zone Micro Labels */}
          <text x="66" y="108" fontSize="7" fill="#065f46" fontWeight="bold" textAnchor="middle">LOW</text>
          <text x="110" y="60" fontSize="7" fill="#854d0e" fontWeight="bold" textAnchor="middle">MOD</text>
          <text x="170" y="60" fontSize="7" fill="#9a3412" fontWeight="bold" textAnchor="middle">ELEV</text>
          <text x="214" y="108" fontSize="7" fill="#991b1b" fontWeight="bold" textAnchor="middle">CRIT</text>

          {/* Gauge Needle Pointer */}
          <polygon
            points={`${baseLeftX},${baseLeftY} ${tipX},${tipY} ${baseRightX},${baseRightY}`}
            fill="#0f172a"
          />
          {/* Metallic Pivot Hub */}
          <circle cx={cx} cy={cy} r="8" fill="#1e293b" stroke="#ffffff" strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r="3" fill="#ffffff" />
        </svg>

        {/* Numerical Score Display */}
        <div className="text-center -mt-2">
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 tracking-tight">
            {score} <span className="text-xs text-slate-400 font-sans font-normal">/ 100</span>
          </div>
          <div className="text-2xs font-semibold text-slate-700 mt-0.5">
            Inflammatory Risk Index
          </div>
        </div>
      </div>

      {/* Biomarker Sub-Analytes */}
      <div className="pt-2 border-t border-slate-100">
        <div className="grid grid-cols-3 gap-2 text-center text-2xs">
          <div className="p-1.5 bg-slate-50 rounded-md border border-slate-200/80">
            <span className="text-slate-400 block text-3xs font-medium">hs-CRP</span>
            <span className="font-mono font-bold text-slate-900">
              {crpValue !== undefined ? `${crpValue} mg/L` : 'N/A'}
            </span>
          </div>
          <div className="p-1.5 bg-slate-50 rounded-md border border-slate-200/80">
            <span className="text-slate-400 block text-3xs font-medium">NLR Ratio</span>
            <span className="font-mono font-bold text-slate-900">
              {nlrValue !== undefined ? nlrValue : 'N/A'}
            </span>
          </div>
          <div className="p-1.5 bg-slate-50 rounded-md border border-slate-200/80">
            <span className="text-slate-400 block text-3xs font-medium">PLR Ratio</span>
            <span className="font-mono font-bold text-slate-900">
              {plrValue !== undefined ? plrValue : 'N/A'}
            </span>
          </div>
        </div>

        <p className="mt-2 text-3xs text-slate-600 leading-normal italic">
          {clinicalSummary}
        </p>
      </div>
    </div>
  );
};

// Projected Risk Score based on Biomarker Volatility
interface VolatilityCardProps {
  assessment?: ProjectedVolatilityRiskAssessment;
  sessionsCount: number;
}

const ProjectedVolatilityRiskCard: React.FC<VolatilityCardProps> = ({ assessment, sessionsCount }) => {
  if (!assessment) return null;
  const { projectedRiskScore, riskTier, averageCoefficientOfVariation, topVolatileMarkers, clinicalInterpretation } = assessment;

  const isHigh = riskTier === 'High Strain';
  const isElev = riskTier === 'Elevated';
  const isMod = riskTier === 'Moderate';

  const badgeColor = isHigh
    ? 'text-rose-700 bg-rose-50 border-rose-200'
    : isElev
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : isMod
    ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
    : 'text-emerald-700 bg-emerald-50 border-emerald-200';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 h-full flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900">Projected Risk Score (Biomarker Volatility)</h2>
            </div>
            <p className="text-2xs text-slate-500 mt-0.5">
              Biological intra-individual variation (CV%) and visit-to-visit amplitude instability across {sessionsCount} recorded visits.
            </p>
          </div>

          <span className={`text-2xs font-semibold px-2.5 py-1 rounded-md border shrink-0 ${badgeColor}`}>
            {riskTier} Volatility
          </span>
        </div>

        {/* Score Dial & Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center mt-3">
          {/* Numerical Score Panel */}
          <div className="sm:col-span-4 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center">
            <div className="text-3xs uppercase tracking-wider font-semibold text-slate-500 mb-1">
              Projected Risk Score
            </div>
            <div className="text-4xl font-extrabold font-mono tabular-nums text-indigo-950 tracking-tight">
              {projectedRiskScore}
              <span className="text-sm font-sans font-normal text-slate-400 ml-1">/ 100</span>
            </div>

            {/* Linear indicator bar */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-3">
              <div
                style={{ width: `${projectedRiskScore}%` }}
                className={`h-full ${
                  projectedRiskScore >= 75
                    ? 'bg-rose-600'
                    : projectedRiskScore >= 55
                    ? 'bg-amber-500'
                    : projectedRiskScore >= 30
                    ? 'bg-yellow-500'
                    : 'bg-emerald-500'
                }`}
              />
            </div>

            <div className="mt-2 text-3xs text-slate-500 flex items-center justify-between w-full font-mono">
              <span>0 Stable</span>
              <span>50 Mod</span>
              <span>100 Critical</span>
            </div>
          </div>

          {/* Narrative & Buffering Commentary */}
          <div className="sm:col-span-8 space-y-2">
            <div className="flex items-center gap-4 text-xs">
              <div>
                <span className="text-2xs text-slate-500">Cohort Mean Volatility:</span>
                <div className="font-mono font-bold text-slate-900 text-sm">
                  {averageCoefficientOfVariation}% <span className="text-2xs font-normal text-slate-500 font-sans">Avg CV</span>
                </div>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-2xs text-slate-500">Buffering Reserve:</span>
                <div className="font-bold text-sm text-slate-900">
                  {isHigh ? 'Severely Depleted' : isElev ? 'Reduced Reserve' : isMod ? 'Preserved Buffering' : 'Optimal Resilience'}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {clinicalInterpretation}
            </p>
          </div>
        </div>
      </div>

      {/* Top Volatile Biomarkers Table */}
      {topVolatileMarkers.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <div className="text-2xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Key Volatility Contributors (Visit-to-Visit CV%)
          </div>

          <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-2xs">
                <tr>
                  <th className="py-2 px-3 font-semibold">Analyte</th>
                  <th className="py-2 px-3 font-semibold">Category</th>
                  <th className="py-2 px-3 font-semibold text-right">Mean ± SD</th>
                  <th className="py-2 px-3 font-semibold text-right">Volatility (CV%)</th>
                  <th className="py-2 px-3 font-semibold text-center">Stability Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-2xs">
                {topVolatileMarkers.map((item) => (
                  <tr key={item.biomarkerId} className="hover:bg-slate-50/60">
                    <td className="py-2 px-3 font-medium text-slate-900">
                      {item.biomarkerName}
                    </td>
                    <td className="py-2 px-3 text-slate-500">
                      {item.category}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {item.meanValue} ± {item.standardDeviation} {item.unit}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      {item.coefficientOfVariation}%
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`font-semibold ${
                          item.volatilityTier === 'High'
                            ? 'text-rose-700'
                            : item.volatilityTier === 'Elevated'
                            ? 'text-amber-700'
                            : item.volatilityTier === 'Moderate'
                            ? 'text-yellow-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {item.volatilityTier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

interface PredictiveAnalyticsScreenProps {
  profile: PatientProfile;
  sessions: TestSession[];
}

export const PredictiveAnalyticsScreen: React.FC<PredictiveAnalyticsScreenProps> = ({
  profile,
  sessions,
}) => {
  const [selectedBiomarkerId, setSelectedBiomarkerId] = useState<string>('');
  const [selectedRiskCategory, setSelectedRiskCategory] = useState<HealthRiskCategory | 'All'>('All');

  // "What-if" Lifestyle simulation toggles
  const [simulateCardioIntervention, setSimulateCardioIntervention] = useState(false);
  const [simulateIronIntervention, setSimulateIronIntervention] = useState(false);
  const [simulateOmega3Intervention, setSimulateOmega3Intervention] = useState(false);
  const [simulateLiverIntervention, setSimulateLiverIntervention] = useState(false);

  // Generate predictive report
  const report = useMemo(() => {
    return generatePredictiveReport(profile, sessions);
  }, [profile, sessions]);

  // Default selected biomarker
  const defaultBiomarker = useMemo(() => {
    if (selectedBiomarkerId) return selectedBiomarkerId;
    // Prefer one with an interesting trajectory
    const interesting = report.trajectories.find(
      (t) => t.direction === 'Rapidly Rising' || t.direction === 'Rapidly Declining' || t.thresholdCrossingWarning
    );
    return interesting ? interesting.biomarkerId : (report.trajectories[0]?.biomarkerId || 'bm-glu');
  }, [report, selectedBiomarkerId]);

  const activeTrajectory = report.trajectories.find((t) => t.biomarkerId === defaultBiomarker);
  const catalogItem = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === defaultBiomarker);

  const isFemale = profile.gender === 'Female';
  const refLow = catalogItem ? (isFemale ? catalogItem.refLowFemale : catalogItem.refLowMale) : 0;
  const refHigh = catalogItem ? (isFemale ? catalogItem.refHighFemale : catalogItem.refHighMale) : 100;

  // Filter risk assessments
  const filteredRiskAssessments = useMemo(() => {
    if (selectedRiskCategory === 'All') return report.riskAssessments;
    return report.riskAssessments.filter((r) => r.category === selectedRiskCategory);
  }, [report, selectedRiskCategory]);

  // Simulated 12-month value calculation for active trajectory
  const simulated12MonthValue = useMemo(() => {
    if (!activeTrajectory) return 0;
    let val = activeTrajectory.projected12Months;

    if (activeTrajectory.biomarkerId === 'bm-glu' && simulateCardioIntervention) {
      val = Number((val * 0.92).toFixed(1)); // -8% reduction in fasting glucose
    } else if (activeTrajectory.biomarkerId === 'bm-hba1c' && simulateCardioIntervention) {
      val = Number((val - 0.4).toFixed(1)); // -0.4% HbA1c
    } else if (activeTrajectory.biomarkerId === 'bm-tg' && simulateCardioIntervention) {
      val = Number((val * 0.72).toFixed(1)); // -28% TG
    } else if (activeTrajectory.biomarkerId === 'bm-ldl' && simulateCardioIntervention) {
      val = Number((val * 0.85).toFixed(1)); // -15% LDL
    } else if (activeTrajectory.biomarkerId === 'bm-hdl' && simulateCardioIntervention) {
      val = Number((val * 1.15).toFixed(1)); // +15% HDL
    } else if (activeTrajectory.biomarkerId === 'bm-ferr' && simulateIronIntervention) {
      val = Number((val + 38).toFixed(1)); // +38 ng/mL ferritin
    } else if (activeTrajectory.biomarkerId === 'bm-crp' && simulateOmega3Intervention) {
      val = Number((val * 0.65).toFixed(1)); // -35% hs-CRP
    } else if (activeTrajectory.biomarkerId === 'bm-alt' && simulateLiverIntervention) {
      val = Number((val * 0.75).toFixed(1)); // -25% ALT
    }

    return val;
  }, [
    activeTrajectory,
    simulateCardioIntervention,
    simulateIronIntervention,
    simulateOmega3Intervention,
    simulateLiverIntervention,
  ]);

  // SVG Chart Geometry
  const chartData = useMemo(() => {
    if (!activeTrajectory || activeTrajectory.historicalValues.length === 0) return null;

    const hist = activeTrajectory.historicalValues;
    const allVals = [
      ...hist.map((h) => h.value),
      activeTrajectory.projected6Months,
      activeTrajectory.projected12Months,
      simulated12MonthValue,
      refLow,
      refHigh,
    ];

    const minY = Math.max(0, Math.min(...allVals) * 0.85);
    const maxY = Math.max(...allVals) * 1.15;
    const yRange = maxY - minY || 1;

    // Timeline positions
    const t0 = new Date(hist[0].date).getTime();
    const lastHistTime = new Date(hist[hist.length - 1].date).getTime();
    const sixMoTime = lastHistTime + 182.5 * 24 * 3600 * 1000;
    const twelveMoTime = lastHistTime + 365 * 24 * 3600 * 1000;
    const totalTimeSpan = twelveMoTime - t0 || 1;

    const width = 640;
    const height = 240;
    const padX = 40;
    const padY = 25;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    const getX = (timeMs: number) => padX + ((timeMs - t0) / totalTimeSpan) * plotW;
    const getY = (val: number) => padY + plotH - ((val - minY) / yRange) * plotH;

    const histPoints = hist.map((h) => ({
      x: getX(new Date(h.date).getTime()),
      y: getY(h.value),
      date: h.date,
      value: h.value,
    }));

    const proj6Pt = {
      x: getX(sixMoTime),
      y: getY(activeTrajectory.projected6Months),
      value: activeTrajectory.projected6Months,
      label: '+6 Mo',
    };

    const proj12Pt = {
      x: getX(twelveMoTime),
      y: getY(activeTrajectory.projected12Months),
      value: activeTrajectory.projected12Months,
      label: '+12 Mo (Projected)',
    };

    const sim12Pt = {
      x: getX(twelveMoTime),
      y: getY(simulated12MonthValue),
      value: simulated12MonthValue,
      label: '+12 Mo (Managed)',
    };

    const refLowY = getY(refLow);
    const refHighY = getY(refHigh);

    return {
      width,
      height,
      minY,
      maxY,
      histPoints,
      proj6Pt,
      proj12Pt,
      sim12Pt,
      refLowY,
      refHighY,
      refLow,
      refHigh,
      lastHistX: histPoints[histPoints.length - 1].x,
      lastHistY: histPoints[histPoints.length - 1].y,
    };
  }, [activeTrajectory, simulated12MonthValue, refLow, refHigh]);

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
              <BrainCircuit className="w-4 h-4" />
              <span>Predictive Biomarker Modeling & Trajectory Engine</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Health Trajectory Analytics
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Analyzes long-term slopes across {report.sessionsAnalyzed} historical test visits over {report.spanDays} days to identify latent health vulnerabilities before standard clinical thresholds are breached.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-200 px-3 py-2 rounded-lg text-xs">
            <Activity className="w-4 h-4 text-indigo-600" />
            <div>
              <div className="text-2xs text-indigo-700 font-medium">Trajectory Forecast Horizon</div>
              <div className="font-semibold text-indigo-950">12 Months Future Projection</div>
            </div>
          </div>
        </div>

        {/* Key Findings Notice */}
        {report.keyTrajectoryTakeaways.length > 0 && (
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900">Longitudinal Trajectory Takeaways: </span>
              {report.keyTrajectoryTakeaways.join(' ')}
            </div>
          </div>
        )}
      </div>

      {/* Biometric Age Estimation Clock & Longitudinal Longevity Engine */}
      <BiometricAgeCard
        profile={profile}
        sessions={sessions}
        initialEstimation={report.biometricAge}
      />

      {/* Volatility Risk Score & Systemic Inflammatory Gauge Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Projected Risk Score (0-100) from Biomarker Volatility */}
        <div className="lg:col-span-7 flex flex-col">
          {report.volatilityAssessment && (
            <ProjectedVolatilityRiskCard
              assessment={report.volatilityAssessment}
              sessionsCount={report.sessionsAnalyzed}
            />
          )}
        </div>

        {/* Right: Systemic Inflammatory Risk Gauge */}
        <div className="lg:col-span-5 flex flex-col">
          {report.systemicInflammatoryGauge && (
            <SystemicInflammatoryGauge data={report.systemicInflammatoryGauge} />
          )}
        </div>
      </div>

      {/* Multi-Domain Risk Stratification Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Multi-Domain Predictive Risk Stratification
          </h2>

          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 mr-1">Filter Domain:</span>
            {(['All', 'Cardiometabolic Risk', 'Hepatic Steatosis & Fibrosis', 'Iron & Hematologic Reserve', 'Systemic Inflammation'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedRiskCategory(cat)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                    selectedRiskCategory === cat
                      ? 'bg-slate-900 text-white font-medium'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'All' ? 'All Domains' : cat.split(' ')[0]}
                </button>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRiskAssessments.map((ra) => {
            const isCrit = ra.currentRiskLevel === 'Critical';
            const isElev = ra.currentRiskLevel === 'Elevated';
            const isMod = ra.currentRiskLevel === 'Moderate';

            const badgeColor = isCrit
              ? 'text-rose-700'
              : isElev
              ? 'text-amber-700'
              : isMod
              ? 'text-yellow-700'
              : 'text-emerald-700';

            return (
              <div
                key={ra.category}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{ra.category}</span>
                    <span className={`text-xs font-semibold ${badgeColor}`}>
                      {ra.currentRiskLevel} Risk
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-2xs text-slate-500 pb-2 border-b border-slate-100">
                    <span>12-Mo Trajectory:</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      {ra.trendDirection === 'Worsening' && (
                        <ArrowUpRight className="w-3 h-3 text-rose-600" />
                      )}
                      {ra.trendDirection === 'Improving' && (
                        <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                      )}
                      {ra.trendDirection === 'Stable' && (
                        <Minus className="w-3 h-3 text-slate-400" />
                      )}
                      {ra.trendDirection} (Projected {ra.projected12MonthRiskLevel})
                    </span>
                  </div>

                  <p className="mt-2 text-2xs text-slate-600 leading-relaxed">
                    {ra.clinicalSummary}
                  </p>
                </div>

                <div>
                  <div className="text-2xs text-slate-500 mb-1">
                    Key Drivers: <span className="font-medium text-slate-800">{ra.primaryDrivingBiomarkers.join(', ') || 'Within Normal Ranges'}</span>
                  </div>

                  {ra.recommendations.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-2xs font-semibold text-indigo-700">
                        {ra.recommendations.length} Actionable Intervention{ra.recommendations.length > 1 ? 's' : ''}
                      </span>
                      <span className="text-2xs text-slate-400">See recommendations below</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trajectory Regression Deep-Dive Explorer & What-If Modeler */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Longitudinal Regression & 12-Month Projection Modeler
            </h2>
            <p className="text-xs text-slate-500">
              Select any monitored biomarker to visualize rate-of-change regressions, statistical confidence, and future projections.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-medium">Biomarker:</span>
            <select
              aria-label="Select Monitored Biomarker"
              value={defaultBiomarker}
              onChange={(e) => setSelectedBiomarkerId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
            >
              {report.trajectories.map((t) => (
                <option key={t.biomarkerId} value={t.biomarkerId}>
                  {t.biomarkerName} ({t.direction})
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeTrajectory && chartData ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: SVG Chart & Trajectory Line */}
            <div className="lg:col-span-8 space-y-3">
              <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900">{activeTrajectory.biomarkerName}</span>
                    <span className="text-slate-500 font-mono text-2xs">Unit: {activeTrajectory.unit}</span>
                  </div>
                  <div className="flex items-center gap-3 text-2xs">
                    <span className="flex items-center gap-1 text-slate-600">
                      <span className="w-2.5 h-0.5 bg-blue-700 inline-block"></span> Actual Trend
                    </span>
                    <span className="flex items-center gap-1 text-indigo-700">
                      <span className="w-2.5 h-0.5 bg-indigo-500 border-t border-dashed inline-block"></span> Unmanaged 12-Mo
                    </span>
                    <span className="flex items-center gap-1 text-emerald-700">
                      <span className="w-2.5 h-0.5 bg-emerald-600 inline-block"></span> Managed Target
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <span className="w-2.5 h-2 bg-emerald-100/50 inline-block"></span> Safe Interval
                    </span>
                  </div>
                </div>

                {/* SVG Visualizer */}
                <div className="w-full overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                    className="w-full h-auto max-h-72 select-none"
                  >
                    {/* Safe reference interval background band */}
                    <rect
                      x={40}
                      y={Math.min(chartData.refHighY, chartData.refLowY)}
                      width={chartData.width - 80}
                      height={Math.max(4, Math.abs(chartData.refLowY - chartData.refHighY))}
                      fill="#10b981"
                      fillOpacity="0.08"
                    />

                    {/* Reference lines */}
                    <line
                      x1={40}
                      y1={chartData.refHighY}
                      x2={chartData.width - 40}
                      y2={chartData.refHighY}
                      stroke="#10b981"
                      strokeDasharray="3 3"
                      strokeOpacity="0.5"
                    />
                    <text
                      x={chartData.width - 38}
                      y={chartData.refHighY + 3}
                      fontSize="9"
                      fill="#059669"
                      fontFamily="monospace"
                    >
                      High: {chartData.refHigh}
                    </text>

                    <line
                      x1={40}
                      y1={chartData.refLowY}
                      x2={chartData.width - 40}
                      y2={chartData.refLowY}
                      stroke="#10b981"
                      strokeDasharray="3 3"
                      strokeOpacity="0.5"
                    />
                    <text
                      x={chartData.width - 38}
                      y={chartData.refLowY + 3}
                      fontSize="9"
                      fill="#059669"
                      fontFamily="monospace"
                    >
                      Low: {chartData.refLow}
                    </text>

                    {/* Historical Polyline */}
                    <polyline
                      fill="none"
                      stroke="#1d4ed8"
                      strokeWidth="2.5"
                      points={chartData.histPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    />

                    {/* Projected Polyline to Unmanaged +12 Months */}
                    <line
                      x1={chartData.lastHistX}
                      y1={chartData.lastHistY}
                      x2={chartData.proj6Pt.x}
                      y2={chartData.proj6Pt.y}
                      stroke="#6366f1"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                    <line
                      x1={chartData.proj6Pt.x}
                      y1={chartData.proj6Pt.y}
                      x2={chartData.proj12Pt.x}
                      y2={chartData.proj12Pt.y}
                      stroke="#6366f1"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />

                    {/* Projected Polyline to Managed Simulation if toggled */}
                    <line
                      x1={chartData.lastHistX}
                      y1={chartData.lastHistY}
                      x2={chartData.sim12Pt.x}
                      y2={chartData.sim12Pt.y}
                      stroke="#059669"
                      strokeWidth="2"
                      strokeDasharray="2 2"
                    />

                    {/* Historical Circles */}
                    {chartData.histPoints.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="4.5" fill="#1d4ed8" stroke="#ffffff" strokeWidth="1.5" />
                        <text
                          x={p.x}
                          y={p.y - 8}
                          fontSize="10"
                          textAnchor="middle"
                          fill="#0f172a"
                          fontWeight="600"
                          fontFamily="monospace"
                        >
                          {p.value}
                        </text>
                        <text
                          x={p.x}
                          y={chartData.height - 8}
                          fontSize="8.5"
                          textAnchor="middle"
                          fill="#64748b"
                        >
                          {p.date}
                        </text>
                      </g>
                    ))}

                    {/* Unmanaged 12M Marker */}
                    <circle cx={chartData.proj12Pt.x} cy={chartData.proj12Pt.y} r="4.5" fill="#6366f1" stroke="#ffffff" strokeWidth="1.5" />
                    <text
                      x={chartData.proj12Pt.x}
                      y={chartData.proj12Pt.y - 8}
                      fontSize="10"
                      textAnchor="middle"
                      fill="#4f46e5"
                      fontWeight="600"
                      fontFamily="monospace"
                    >
                      {chartData.proj12Pt.value}
                    </text>
                    <text
                      x={chartData.proj12Pt.x}
                      y={chartData.height - 8}
                      fontSize="8.5"
                      textAnchor="middle"
                      fill="#6366f1"
                    >
                      +12 Mo
                    </text>

                    {/* Managed Simulation 12M Marker */}
                    {chartData.sim12Pt.value !== chartData.proj12Pt.value && (
                      <g>
                        <circle cx={chartData.sim12Pt.x} cy={chartData.sim12Pt.y} r="4.5" fill="#059669" stroke="#ffffff" strokeWidth="1.5" />
                        <text
                          x={chartData.sim12Pt.x}
                          y={chartData.sim12Pt.y - 8}
                          fontSize="10"
                          textAnchor="middle"
                          fill="#059669"
                          fontWeight="600"
                          fontFamily="monospace"
                        >
                          {chartData.sim12Pt.value}*
                        </text>
                      </g>
                    )}
                  </svg>
                </div>
              </div>

              {/* Trajectory Alert if threshold breach is predicted */}
              {activeTrajectory.thresholdCrossingWarning && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Threshold Breach Projection: </span>
                    {activeTrajectory.thresholdCrossingWarning}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Trajectory Metrics & "What-If" Simulation Modeler */}
            <div className="lg:col-span-4 space-y-4">
              {/* Regression Summary Box */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="text-xs font-bold text-slate-900">Trajectory Regression Metrics</div>
                <div className="grid grid-cols-2 gap-2 text-2xs">
                  <div>
                    <span className="text-slate-500">Current Measured:</span>
                    <div className="font-mono font-semibold text-slate-900 text-sm">
                      {activeTrajectory.currentValue} {activeTrajectory.unit}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">12-Mo Unmanaged:</span>
                    <div className="font-mono font-semibold text-indigo-700 text-sm">
                      {activeTrajectory.projected12Months} {activeTrajectory.unit}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Velocity (Annual):</span>
                    <div className="font-mono font-semibold text-slate-900">
                      {activeTrajectory.annualRateOfChange > 0 ? '+' : ''}
                      {activeTrajectory.annualRateOfChange} {activeTrajectory.unit}/yr
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Confidence Score:</span>
                    <div className="font-mono font-semibold text-slate-900">
                      {activeTrajectory.confidenceScore}% (R² Fit)
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive "What-If" Modeler */}
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-700" />
                  <span className="text-xs font-bold text-indigo-950">
                    Interactive "What-If" Intervention Modeler
                  </span>
                </div>
                <p className="text-2xs text-indigo-800 leading-snug">
                  Toggle targeted lifestyle or therapeutic interventions to simulate how metabolic trajectories adapt over the 12-month horizon.
                </p>

                <div className="space-y-2 pt-1 text-xs">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateCardioIntervention}
                      onChange={(e) => setSimulateCardioIntervention(e.target.checked)}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-0"
                    />
                    <div>
                      <div className="font-semibold text-slate-900 text-2xs">Zone-2 Cardio + Mediterranean Fiber</div>
                      <div className="text-3xs text-slate-500">Simulates -28% TG, -15% LDL, +15% HDL, -8% Glucose</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateIronIntervention}
                      onChange={(e) => setSimulateIronIntervention(e.target.checked)}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-0"
                    />
                    <div>
                      <div className="font-semibold text-slate-900 text-2xs">Alternate-Day Iron Bisglycinate</div>
                      <div className="text-3xs text-slate-500">Simulates +38 ng/mL Ferritin replenishment</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateOmega3Intervention}
                      onChange={(e) => setSimulateOmega3Intervention(e.target.checked)}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-0"
                    />
                    <div>
                      <div className="font-semibold text-slate-900 text-2xs">High-Dose EPA/DHA Omega-3</div>
                      <div className="text-3xs text-slate-500">Simulates -35% reduction in hs-CRP inflammatory marker</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateLiverIntervention}
                      onChange={(e) => setSimulateLiverIntervention(e.target.checked)}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-0"
                    />
                    <div>
                      <div className="font-semibold text-slate-900 text-2xs">Fructose & Hepatic Toxin Restriction</div>
                      <div className="text-3xs text-slate-500">Simulates -25% normalization in ALT/AST transaminases</div>
                    </div>
                  </label>
                </div>

                <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between text-2xs">
                  <span className="text-indigo-900 font-medium">Intervention 12-Mo Target:</span>
                  <span className="font-mono font-bold text-emerald-700 text-xs">
                    {simulated12MonthValue} {activeTrajectory.unit}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            No trajectory data available for the selected biomarker.
          </div>
        )}
      </div>

      {/* Actionable Insights & Evidence-Based Recommendations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Evidence-Based Clinical & Lifestyle Recommendations
            </h2>
            <p className="text-xs text-slate-500">
              Actionable dietary, physical conditioning, and surveillance steps customized to this patient's long-term predictive trajectory.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.riskAssessments
            .flatMap((r) => r.recommendations)
            .map((rec) => (
              <div
                key={rec.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-2xs font-semibold uppercase tracking-wider text-indigo-700">
                      {rec.category}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{rec.title}</h3>
                  </div>

                  <span className="text-2xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-sm shrink-0">
                    {rec.evidenceGrade}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {rec.summary}
                </p>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 space-y-1">
                  <div className="text-2xs font-semibold text-slate-700">Projected Clinical Outcome:</div>
                  <div className="text-2xs text-emerald-800 font-medium">{rec.expectedImpact}</div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="text-2xs font-semibold text-slate-700">Implementation Steps:</div>
                  <ul className="space-y-1 text-2xs text-slate-600 list-disc list-inside">
                    {rec.actionSteps.map((step, idx) => (
                      <li key={idx} className="leading-snug">{step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

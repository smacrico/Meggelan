import React from 'react';
import {
  Calendar,
  Building2,
  AlertTriangle,
  TrendingUp,
  BrainCircuit,
  ArrowRight,
  ShieldAlert,
  Clock,
  Sparkles,
  ChevronRight,
  ExternalLink,
  ArrowRightLeft,
  Hourglass,
  Radio,
  RefreshCw,
  Zap,
  Layers,
  FileCode2,
} from 'lucide-react';
import {
  PatientProfile,
  TestSession,
  AlertHistory,
  Laboratory,
} from '../types/clinical';
import { NavTab } from './Navigation';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';
import { calculateBiometricAge } from '../services/biometricAgeEngine';
import {
  getPollingState,
  subscribeToPolling,
  pollNow,
  simulateIncomingResult,
  LabPollingState,
} from '../services/labPollingService';
import labAnalyzerImg from '../assets/images/clinical_lab_analyzer_1791821024652.jpg';
import { PatientTrendAiSummary } from './PatientTrendAiSummary';

interface HomeScreenProps {
  profile: PatientProfile;
  sessions: TestSession[];
  labs: Laboratory[];
  alerts: AlertHistory[];
  onSelectTab: (tab: NavTab) => void;
  onSelectSession: (sessionId: string) => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onOpenDocModal?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profile,
  sessions,
  labs,
  alerts,
  onSelectTab,
  onSelectSession,
  onAcknowledgeAlert,
  onOpenDocModal,
}) => {
  // Sort sessions descending
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime()
  );

  const latestSession = sortedSessions[0];
  const latestLab = latestSession ? labs.find((l) => l.labId === latestSession.labId) : null;
  const patientAlerts = alerts.filter((a) => a.profileId === profile.profileId && !a.acknowledged);

  // Calculate abnormal count in latest session
  const abnormalCount = latestSession
    ? latestSession.results.filter((r) => r.status !== 'Normal').length
    : 0;

  const totalBiomarkersCount = latestSession ? latestSession.results.length : 0;

  // Calculate Biometric Age estimation for patient
  const biometricAgeEst = React.useMemo(() => {
    return calculateBiometricAge(profile, sessions);
  }, [profile, sessions]);

  // Real-Time LIS Background Polling Feed State
  const [pollingState, setPollingState] = React.useState<LabPollingState>(getPollingState());
  const [isQuickChecking, setIsQuickChecking] = React.useState(false);
  const [isQuickSimulating, setIsQuickSimulating] = React.useState(false);

  React.useEffect(() => {
    const unsub = subscribeToPolling((updated) => {
      setPollingState(updated);
    });
    return () => unsub();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner & Context */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>Clinical Pathology System</span>
              <span aria-hidden="true">·</span>
              <span>Patient Longitudinal Surveillance</span>
              <span aria-hidden="true">·</span>
              <span>MRN {profile.mrn}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {profile.firstName} {profile.lastName}
              </h1>
              {onOpenDocModal && (
                <button
                  onClick={onOpenDocModal}
                  title="Open System Architecture Document & Visio Diagram"
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-700" />
                  <span>Architecture & Visio Diagram</span>
                </button>
              )}
            </div>
            <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
              Longitudinal surveillance dashboard aggregating multi-laboratory blood examination sessions, automated biochemical ratio computations, out-of-range alert thresholds, and multi-year predictive trajectory modeling.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Last Ingested:</span>
                <span className="font-semibold text-slate-900">
                  {latestSession ? latestSession.collectionDate : 'No recorded sessions'}
                </span>
              </div>
              <span aria-hidden="true" className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5">
                <span>Total Exam Sessions:</span>
                <span className="font-semibold text-slate-900 font-mono tabular-nums">{sortedSessions.length}</span>
              </div>
              <span aria-hidden="true" className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5">
                <span>Known Conditions:</span>
                <span className="font-medium text-slate-700">{profile.medicalConditions.join(', ')}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="relative rounded-lg overflow-hidden border border-slate-200 aspect-16/9 bg-slate-100 shadow-2xs">
              <img
                src={labAnalyzerImg}
                alt="Automated clinical laboratory biochemistry analyzer"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex items-end p-3">
                <span className="text-2xs text-slate-200">
                  CLIA / CAP Accredited Diagnostic Laboratory Ingestion
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Tracked Biomarkers (Latest)</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {totalBiomarkersCount}
            </span>
            <span className="text-xs text-slate-500">Master Catalog: 28</span>
          </div>
          <div className="mt-2 text-2xs text-slate-500">
            {latestSession ? `Across ${latestSession.results.length} assay parameters` : 'Awaiting initial lab data'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Out-of-Range Markers</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className={`text-2xl font-bold font-mono tabular-nums ${abnormalCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {abnormalCount}
            </span>
            <span className="text-xs text-slate-500">
              {totalBiomarkersCount > 0 ? `${Math.round((abnormalCount / totalBiomarkersCount) * 100)}% of panel` : '0%'}
            </span>
          </div>
          <div className="mt-2 text-2xs text-slate-500">
            {abnormalCount === 0 ? 'All parameters within standard interval' : 'Flagged for clinician review'}
          </div>
        </div>

        {/* Biometric Age Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Biometric Age Clock</span>
            <span className={`text-3xs font-semibold px-1.5 py-0.2 rounded border ${
              biometricAgeEst.ageDelta < -0.4
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : biometricAgeEst.ageDelta > 0.4
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}>
              {biometricAgeEst.ageDelta > 0 ? `+${biometricAgeEst.ageDelta}y` : `${biometricAgeEst.ageDelta}y`}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className={`text-2xl font-bold font-mono tabular-nums ${
              biometricAgeEst.ageDelta < -0.4 ? 'text-emerald-700' : biometricAgeEst.ageDelta > 0.4 ? 'text-indigo-950' : 'text-slate-900'
            }`}>
              {biometricAgeEst.biometricAge}
              <span className="text-xs font-normal text-slate-400 font-sans ml-1">yrs</span>
            </span>
            <span className="text-3xs text-slate-500 font-mono">
              Chrono: {biometricAgeEst.chronologicalAge}y
            </span>
          </div>
          <div className="mt-2 text-2xs text-slate-500 flex items-center justify-between">
            <span>Pace: <span className="font-mono font-semibold text-slate-700">{biometricAgeEst.agingPace}x</span></span>
            <button
              onClick={() => onSelectTab('predictive')}
              className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 cursor-pointer text-3xs"
            >
              Analyze <ArrowRight className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Active Clinical Alerts</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className={`text-2xl font-bold font-mono tabular-nums ${patientAlerts.length > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {patientAlerts.length}
            </span>
            <span className="text-xs text-slate-500">Unacknowledged</span>
          </div>
          <div className="mt-2 text-2xs text-slate-500">
            {patientAlerts.some((a) => a.severity === 'Critical') ? 'Immediate critical thresholds identified' : 'Routine surveillance alerts'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Predictive Risk Horizon</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-base font-semibold text-indigo-700">
              12-Mo Trajectory
            </span>
            <button
              onClick={() => onSelectTab('predictive')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
            >
              Modeler <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="mt-2 text-2xs text-slate-500">
            Multi-biomarker least-squares regression & lifestyle modeling active
          </div>
        </div>
      </div>

      {/* AI Longitudinal Blood Test Trend Summary */}
      <PatientTrendAiSummary
        profile={profile}
        sessions={sessions}
        onSelectBiomarker={() => onSelectTab('trends')}
        defaultExpanded={false}
      />

      {/* Main Split: Latest Exam Summary (Left) + Active Alerts & Fast Shortcuts (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Latest Exam Summary */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Latest Exam Visit Summary</h2>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{latestSession?.collectionDate || 'N/A'}</span>
                  <span aria-hidden="true">·</span>
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{latestLab?.labName || 'Diagnostic Facility'}</span>
                </div>
              </div>

              {latestSession && (
                <button
                  onClick={() => {
                    onSelectSession(latestSession.sessionId);
                    onSelectTab('session-details');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Detailed View</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {latestSession ? (
              <div className="mt-4 space-y-4">
                {/* Highlights Table */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Key Biomarkers at a Glance
                  </h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 font-semibold">Biomarker</th>
                          <th className="py-2 px-3 font-semibold text-right">Value</th>
                          <th className="py-2 px-3 font-semibold text-right">Reference Range</th>
                          <th className="py-2 px-3 font-semibold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {latestSession.results.slice(0, 7).map((res) => {
                          const cat = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === res.biomarkerId);
                          const isNormal = res.status === 'Normal';
                          const isCrit = res.status.includes('Critical');

                          return (
                            <tr key={res.resultId} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2 px-3 font-medium text-slate-900">
                                <div>{cat?.name || res.biomarkerId}</div>
                                <div className="text-2xs text-slate-500">{cat?.category}</div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                                {res.resultValue} <span className="text-2xs text-slate-500 font-normal">{res.unitMeasured}</span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500 text-2xs">
                                {res.refLow} – {res.refHigh} {res.unitMeasured}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span
                                  className={`text-2xs font-semibold ${
                                    isCrit
                                      ? 'text-rose-700'
                                      : isNormal
                                      ? 'text-emerald-700'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {res.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Derived Metrics Showcase */}
                {latestSession.derivedMetrics.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Automated Derived Clinical Ratios
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {latestSession.derivedMetrics.map((dm) => (
                        <div
                          key={dm.metricId}
                          className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between"
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-semibold text-slate-900">{dm.metricName}</span>
                            <span
                              className={`text-2xs font-semibold ${
                                dm.status === 'Optimal'
                                  ? 'text-emerald-700'
                                  : dm.status === 'Borderline'
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              {dm.status}
                            </span>
                          </div>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-lg font-bold font-mono tabular-nums text-slate-900">
                              {dm.metricValue}
                            </span>
                            <span className="text-2xs text-slate-500">Target: {dm.targetOptimalRange}</span>
                          </div>
                          <div className="mt-1 text-2xs text-slate-500 line-clamp-1">
                            {dm.clinicalInterpretation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-slate-500">
                No blood test sessions recorded for this patient profile yet.
              </div>
            )}
          </div>

          {/* Historical Session Timeline */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Historical Surveillance Visits</h3>
            <div className="space-y-2.5">
              {sortedSessions.map((sess) => {
                const lab = labs.find((l) => l.labId === sess.labId);
                const outOfRange = sess.results.filter((r) => r.status !== 'Normal').length;

                return (
                  <div
                    key={sess.sessionId}
                    onClick={() => {
                      onSelectSession(sess.sessionId);
                      onSelectTab('session-details');
                    }}
                    className="p-3 border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 font-mono">
                          {sess.collectionDate}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="text-xs text-slate-600">{lab?.labName || 'Clinical Lab'}</span>
                      </div>
                      <div className="text-2xs text-slate-500">
                        {sess.results.length} markers measured · Fasting {sess.fastingHours}h · {sess.orderingPhysician}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {outOfRange > 0 ? (
                        <span className="text-2xs font-semibold text-amber-700">
                          {outOfRange} out-of-range
                        </span>
                      ) : (
                        <span className="text-2xs font-semibold text-emerald-700">
                          All nominal
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time LIS Feed & Active Alerts */}
        <div className="lg:col-span-5 space-y-4">
          {/* Real-Time Laboratory Background Polling Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {pollingState.isPolling ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400"></span>
                  )}
                </span>
                <Radio className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  LIS Live Feed (Auto-Polling)
                </h2>
              </div>
              <button
                onClick={() => onSelectTab('upload')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer flex items-center gap-1"
              >
                <span>Feed Console</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-600 font-medium">
                  {pollingState.isPolling
                    ? `Background scan active (every ${pollingState.intervalSeconds}s)`
                    : 'Feed polling suspended'}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  {pollingState.pendingItems.length > 0 ? (
                    <span className="font-bold text-amber-600">
                      {pollingState.pendingItems.length} new incoming test session(s) pending ingestion
                    </span>
                  ) : (
                    <span>All diagnostic feeds synchronized · Next in {pollingState.nextPollSeconds}s</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={async () => {
                    setIsQuickChecking(true);
                    await pollNow(profile.profileId);
                    setIsQuickChecking(false);
                  }}
                  disabled={isQuickChecking}
                  title="Check LIS feed now"
                  className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isQuickChecking ? 'animate-spin' : ''}`} />
                </button>

                <button
                  onClick={async () => {
                    setIsQuickSimulating(true);
                    await simulateIncomingResult('routine', profile.profileId);
                    setIsQuickSimulating(false);
                  }}
                  disabled={isQuickSimulating}
                  className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-3 h-3 text-blue-600" />
                  <span>{isQuickSimulating ? 'Simulating...' : '+ Mock Result'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Alerts Box */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h2 className="text-base font-bold text-slate-900">Active Priority Alerts</h2>
              </div>
              <button
                onClick={() => onSelectTab('alerts')}
                className="text-xs font-medium text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                View All
              </button>
            </div>

            {patientAlerts.length > 0 ? (
              <div className="mt-3 space-y-3">
                {patientAlerts.slice(0, 4).map((alt) => (
                  <div
                    key={alt.alertId}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-2xs font-bold uppercase tracking-wider ${
                            alt.severity === 'Critical' ? 'text-rose-700' : 'text-amber-700'
                          }`}
                        >
                          {alt.severity}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="text-xs font-semibold text-slate-900">{alt.biomarkerName}</span>
                      </div>
                      <button
                        onClick={() => onAcknowledgeAlert(alt.alertId)}
                        className="text-2xs text-slate-500 hover:text-slate-800 underline cursor-pointer shrink-0"
                      >
                        Acknowledge
                      </button>
                    </div>

                    <p className="text-2xs text-slate-700 leading-snug">
                      {alt.message}
                    </p>

                    <div className="pt-1 text-2xs text-slate-500 italic border-t border-slate-200/60">
                      Guideline: {alt.clinicalGuideline}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No active unacknowledged alerts for {profile.firstName}.
              </div>
            )}
          </div>

          {/* Fast Navigation to Core Modules */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Clinical Workflow Shortcuts</h3>

            <div
              onClick={() => onSelectTab('predictive')}
              className="p-3 border border-indigo-200 bg-indigo-50/40 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-indigo-600 text-white flex items-center justify-center">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-indigo-950">Predictive Analytics Engine</div>
                  <div className="text-2xs text-indigo-700">12-month trajectory regression & lifestyle simulations</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
            </div>

            <div
              onClick={() => onSelectTab('trends')}
              className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Longitudinal Trend Explorer</div>
                  <div className="text-2xs text-slate-500">Interactive charts with normal reference safe zones</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>

            <div
              onClick={() => onSelectTab('differentials')}
              className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-teal-600 text-white flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Biomarker Differentials Comparator</div>
                  <div className="text-2xs text-slate-500">Side-by-side exam differentials & numerical deviation highlights</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>

            <div
              onClick={() => onSelectTab('upload')}
              className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-emerald-600 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Lab Report Ingestion Pipeline</div>
                  <div className="text-2xs text-slate-500">OCR parsing, entity matching, unit standardization</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>

            <div
              onClick={() => onSelectTab('powerbi')}
              className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-amber-600 text-white flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Power BI Semantic Analytics Hub</div>
                  <div className="text-2xs text-slate-500">DAX metrics, risk quadrants, and dataset export</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Activity,
  X,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Radio,
  Server,
  Sparkles,
  Zap,
  Volume2,
  VolumeX,
  Database,
  ArrowRight,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Calendar,
  Building2,
  Eye,
  Sliders,
} from 'lucide-react';
import { PatientProfile } from '../types/clinical';
import {
  getPollingState,
  subscribeToPolling,
  startPolling,
  stopPolling,
  togglePolling,
  pollNow,
  simulateIncomingResult,
  commitPendingItem,
  commitAllPending,
  dismissPendingItem,
  setIntervalSeconds,
  setAutoCommit,
  setSoundNotification,
  clearAuditLogs,
  IncomingLabItem,
  LabPollingState,
} from '../services/labPollingService';

interface LabPollingModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: PatientProfile[];
  selectedProfileId: string;
  onViewSessionDetails?: (sessionId: string) => void;
}

export const LabPollingModal: React.FC<LabPollingModalProps> = ({
  isOpen,
  onClose,
  profiles,
  selectedProfileId,
  onViewSessionDetails,
}) => {
  const [pollingState, setPollingState] = useState<LabPollingState>(getPollingState());
  const [isSimulating, setIsSimulating] = useState(false);
  const [isPollingManual, setIsPollingManual] = useState(false);
  const [simulationTargetProfile, setSimulationTargetProfile] = useState<string>(selectedProfileId || 'pat-eleanor-01');
  const [selectedScenario, setSelectedScenario] = useState<
    'routine' | 'cardiac-inflammatory' | 'hepatic-flare' | 'cbc-infection-panic'
  >('routine');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'controls' | 'audit'>('queue');

  useEffect(() => {
    const unsubscribe = subscribeToPolling((updated) => {
      setPollingState(updated);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedProfileId) {
      setSimulationTargetProfile(selectedProfileId);
    }
  }, [selectedProfileId]);

  if (!isOpen) return null;

  const handleManualPoll = async () => {
    setIsPollingManual(true);
    await pollNow();
    setIsPollingManual(false);
  };

  const handleSimulate = async (scenario: 'routine' | 'cardiac-inflammatory' | 'hepatic-flare' | 'cbc-infection-panic') => {
    setIsSimulating(true);
    await simulateIncomingResult(scenario, simulationTargetProfile);
    setIsSimulating(false);
  };

  const handleCommitItem = async (id: string, sessionId: string) => {
    await commitPendingItem(id);
    if (onViewSessionDetails) {
      onViewSessionDetails(sessionId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Real-Time Laboratory API Polling Service</h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full font-mono">
                  HL7 v2.5 / FHIR R4 Inbound
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated background checks for inbound diagnostic test sessions and direct SQLite ingestion
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Service Status & Pulse Sub-bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
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
              <span className="font-semibold text-slate-900">
                {pollingState.isPolling
                  ? pollingState.status === 'polling'
                    ? 'Checking LIS Feed...'
                    : 'Feed Polling Active'
                  : 'Polling Paused'}
              </span>
              {pollingState.isPolling && (
                <span className="text-slate-500 font-mono text-[11px]">
                  (next in {pollingState.nextPollSeconds}s)
                </span>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-slate-500 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Interval:</span>
              <span className="font-semibold text-slate-800">{pollingState.intervalSeconds}s</span>
              <span className="text-slate-300">|</span>
              <span>Total Polls:</span>
              <span className="font-mono font-semibold text-slate-800">{pollingState.pollCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualPoll}
              disabled={isPollingManual}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-medium border border-slate-200 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isPollingManual ? 'animate-spin' : ''}`} />
              <span>{isPollingManual ? 'Polling...' : 'Poll Now'}</span>
            </button>

            <button
              onClick={() => togglePolling()}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs text-xs ${
                pollingState.isPolling
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {pollingState.isPolling ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Poller</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume Poller</span>
                </>
              )}
            </button>

            <button
              onClick={() => setSoundNotification(!pollingState.soundNotification)}
              title={pollingState.soundNotification ? 'Mute arrival chimes' : 'Enable arrival chimes'}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-md border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
            >
              {pollingState.soundNotification ? (
                <Volume2 className="w-4 h-4 text-slate-700" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 px-6 bg-white shrink-0">
          <div className="flex items-center gap-6 text-xs font-medium">
            <button
              onClick={() => setActiveTab('queue')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'queue'
                  ? 'border-blue-600 text-blue-700 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Incoming Ingestion Queue</span>
              {pollingState.pendingItems.length > 0 && (
                <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[10px] font-bold rounded-full font-mono">
                  {pollingState.pendingItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('controls')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'controls'
                  ? 'border-blue-600 text-blue-700 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Gateway Settings & Simulation</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'audit'
                  ? 'border-blue-600 text-blue-700 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Live Audit Log ({pollingState.auditLogs.length})</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: INCOMING INGESTION QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-5">
              {/* Quick simulation banner directly accessible from Queue */}
              <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/80 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Simulate Incoming Laboratory Feed Results</span>
                  </div>
                  <p className="text-xs text-blue-700/80 max-w-xl">
                    Emit realistic HL7 / FHIR lab test results for background discovery and SQLite injection.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSimulate('routine')}
                    disabled={isSimulating}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5 text-blue-600" />
                    <span>+ Routine Panel</span>
                  </button>
                  <button
                    onClick={() => handleSimulate('cardiac-inflammatory')}
                    disabled={isSimulating}
                    className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-white hover:bg-amber-50 border border-amber-200 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>+ Cardiac / CRP Flare</span>
                  </button>
                  <button
                    onClick={() => handleSimulate('cbc-infection-panic')}
                    disabled={isSimulating}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-800 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>+ STAT Panic Alert</span>
                  </button>
                </div>
              </div>

              {/* Ingestion Mode Banner (Auto vs Manual) */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-700" />
                  <span className="font-semibold text-slate-800">Direct Ingestion Mode:</span>
                  <span className="text-slate-600">
                    {pollingState.autoCommit
                      ? 'Automatic (Inbound results are committed immediately to SQLite without waiting for review)'
                      : 'Clinician Gatekeeper (Inbound results are staged for one-click clinician approval)'}
                  </span>
                </div>
                <button
                  onClick={() => setAutoCommit(!pollingState.autoCommit)}
                  className="font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                >
                  Switch to {pollingState.autoCommit ? 'Manual Review' : 'Auto-Commit'}
                </button>
              </div>

              {/* Pending Queue List */}
              {pollingState.pendingItems.length === 0 ? (
                <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Inbound Queue Clean & Synced</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                    The background service is continuously polling connected LIS interfaces every{' '}
                    {pollingState.intervalSeconds} seconds. When laboratories release new test findings, they will appear here.
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleManualPoll}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
                    >
                      Check Background Feed Now
                    </button>
                    <button
                      onClick={() => handleSimulate('routine')}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Trigger Simulated Inbound Result</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-700">
                      <span>Pending Ingestion ({pollingState.pendingItems.length})</span>
                    </div>
                    {pollingState.pendingItems.length > 1 && (
                      <button
                        onClick={() => commitAllPending()}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Commit All to SQLite Database</span>
                      </button>
                    )}
                  </div>

                  {pollingState.pendingItems.map((item) => {
                    const isExpanded = expandedItemId === item.id;
                    const criticalAlertCount = item.alerts.filter((a) => a.severity === 'Critical').length;
                    const warningAlertCount = item.alerts.filter((a) => a.severity === 'Warning').length;

                    return (
                      <div
                        key={item.id}
                        className={`border rounded-xl bg-white shadow-2xs overflow-hidden transition-all ${
                          item.urgency === 'Panic/Stat'
                            ? 'border-rose-300 bg-rose-50/20'
                            : item.urgency === 'Priority'
                            ? 'border-amber-300 bg-amber-50/20'
                            : 'border-slate-200'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-full font-mono uppercase ${
                                  item.urgency === 'Panic/Stat'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : item.urgency === 'Priority'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {item.urgency}
                              </span>
                              <span className="font-bold text-sm text-slate-900">{item.patientName}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-xs text-slate-500 font-mono">Accession #{item.accessionNumber}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                <span>{item.sourceLab}</span>
                              </span>
                              <span className="text-slate-300">|</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>Date: {item.collectionDate}</span>
                              </span>
                              <span className="text-slate-300">|</span>
                              <span>Fasting: {item.fastingHours}h</span>
                              <span className="text-slate-300">|</span>
                              <span>Dr: {item.orderingPhysician}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            <button
                              onClick={() => dismissPendingItem(item.id)}
                              title="Dismiss from queue"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleCommitItem(item.id, item.session.sessionId)}
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Commit to SQLite</span>
                            </button>
                          </div>
                        </div>

                        {/* Summary & Tags */}
                        <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-slate-600 font-medium">{item.summaryDescription}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-500">
                              {item.session.results.length} Biomarkers
                            </span>
                            {criticalAlertCount > 0 && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded-sm">
                                {criticalAlertCount} Critical Alert
                              </span>
                            )}
                            {warningAlertCount > 0 && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 rounded-sm">
                                {warningAlertCount} Warning
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expanded Biomarkers Inspection Table */}
                        {isExpanded && (
                          <div className="p-4 border-t border-slate-200 bg-white space-y-3">
                            <div className="text-xs font-bold text-slate-900">
                              Biomarker Findings & Reference Range Normalization:
                            </div>
                            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                    <th className="py-1.5 px-3 font-semibold">Biomarker</th>
                                    <th className="py-1.5 px-3 font-semibold">Observed Value</th>
                                    <th className="py-1.5 px-3 font-semibold">Reference Range</th>
                                    <th className="py-1.5 px-3 font-semibold">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {item.session.results.map((r, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50">
                                      <td className="py-1 px-3 font-medium text-slate-800">{r.biomarkerId}</td>
                                      <td className="py-1 px-3 font-mono font-semibold text-slate-900">
                                        {r.resultValue} {r.unitMeasured}
                                      </td>
                                      <td className="py-1 px-3 text-slate-500 font-mono text-[11px]">
                                        {r.refLow} - {r.refHigh} {r.unitMeasured}
                                      </td>
                                      <td className="py-1 px-3">
                                        <span
                                          className={`px-1.5 py-0.2 text-[10px] font-bold rounded-sm ${
                                            r.status === 'Critical High' || r.status === 'Critical Low'
                                              ? 'bg-rose-100 text-rose-800'
                                              : r.status === 'High' || r.status === 'Low'
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-emerald-100 text-emerald-800'
                                          }`}
                                        >
                                          {r.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {item.alerts.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="text-[11px] font-semibold text-slate-700">Triggered Clinical Alerts:</div>
                                {item.alerts.map((alt, idx) => (
                                  <div
                                    key={idx}
                                    className={`p-2 rounded-md text-xs flex items-start gap-2 ${
                                      alt.severity === 'Critical'
                                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                                    }`}
                                  >
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold">{alt.biomarkerName}:</span> {alt.message}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GATEWAY CONTROLS & TEST SIMULATION */}
          {activeTab === 'controls' && (
            <div className="space-y-6">
              {/* Configuration Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-4 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <span>Polling Frequency & Automation</span>
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Background Check Interval (Seconds):
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[5, 10, 20, 60].map((sec) => (
                          <button
                            key={sec}
                            onClick={() => setIntervalSeconds(sec)}
                            className={`py-2 px-3 rounded-lg border font-mono font-bold text-xs transition-colors cursor-pointer ${
                              pollingState.intervalSeconds === sec
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Select how often HemaMetric queries the laboratory API endpoint.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pollingState.autoCommit}
                          onChange={(e) => setAutoCommit(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-semibold text-slate-800">Direct Ingestion (Auto-Commit)</span>
                          <p className="text-[11px] text-slate-500">
                            Automatically inject validated results into SQLite immediately upon receipt.
                          </p>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pollingState.soundNotification}
                          onChange={(e) => setSoundNotification(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded-sm border-slate-300 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-semibold text-slate-800">Medical Chime Sound Notification</span>
                          <p className="text-[11px] text-slate-500">
                            Play an audible notification when new lab sessions are detected.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Connected LIS Interfaces */}
                <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-4 shadow-2xs">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-600" />
                    <span>Mock LIS Gateways</span>
                  </h3>

                  <div className="space-y-2 text-xs">
                    {pollingState.connectedGateways.map((gw) => (
                      <div
                        key={gw.labId}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{gw.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">ID: {gw.labId}</div>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>{gw.status}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dedicated Simulation Playground */}
              <div className="p-5 bg-white border border-slate-200 rounded-xl space-y-4 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Clinical Lab Result Simulator</span>
                </h3>
                <p className="text-xs text-slate-600">
                  Select a test scenario and target patient profile to inject a realistic HL7 ORU_R01 message into the inbound stream:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Target Patient Profile:</label>
                    <select
                      value={simulationTargetProfile}
                      onChange={(e) => setSimulationTargetProfile(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                    >
                      {profiles.map((p) => (
                        <option key={p.profileId} value={p.profileId}>
                          {p.firstName} {p.lastName} (MRN: {p.mrn})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Clinical Laboratory Scenario:</label>
                    <select
                      value={selectedScenario}
                      onChange={(e) => setSelectedScenario(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="routine">Routine Metabolic & Lipid Follow-up (Quest Diagnostics)</option>
                      <option value="cardiac-inflammatory">Cardiovascular & High hs-CRP Alert (Labcorp)</option>
                      <option value="hepatic-flare">Hepatic Enzymes & Iron Flare (Mayo Clinic Labs)</option>
                      <option value="cbc-infection-panic">STAT Critical Panic: Leukocytosis & Neutrophilia</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleSimulate(selectedScenario)}
                    disabled={isSimulating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    <span>{isSimulating ? 'Injecting Message...' : 'Emit Simulated HL7 Inbound Result'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LIVE AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Real-Time Polling & Ingestion Activity Log:</span>
                <button
                  onClick={clearAuditLogs}
                  className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Clear Log
                </button>
              </div>

              <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-slate-300 max-h-96 overflow-y-auto space-y-2">
                {pollingState.auditLogs.map((log) => (
                  <div key={log.id} className="border-b border-slate-800/80 pb-1.5 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span
                        className={`font-bold uppercase text-[10px] px-1 rounded-xs ${
                          log.type === 'inbound-received'
                            ? 'bg-blue-900 text-blue-300'
                            : log.type === 'auto-committed' || log.type === 'manual-committed'
                            ? 'bg-emerald-900 text-emerald-300'
                            : log.type === 'error'
                            ? 'bg-rose-900 text-rose-300'
                            : log.type === 'simulated'
                            ? 'bg-purple-900 text-purple-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {log.type}
                      </span>
                      {log.httpStatus && (
                        <span className="text-emerald-400 font-semibold">{log.httpStatus} OK</span>
                      )}
                      {log.durationMs !== undefined && (
                        <span className="text-slate-500">{log.durationMs}ms</span>
                      )}
                    </div>
                    <div className="text-slate-200 mt-0.5">{log.message}</div>
                    {log.details && <div className="text-slate-400 text-[11px] mt-0.5">{log.details}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>SQLite Database: hemametric.sqlite</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-200 text-slate-800 font-semibold border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            Close Feed Viewer
          </button>
        </div>
      </div>
    </div>
  );
};

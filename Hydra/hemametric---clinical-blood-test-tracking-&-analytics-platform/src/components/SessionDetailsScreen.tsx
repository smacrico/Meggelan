import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Building2,
  User,
  Clock,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Share2,
  FileDown,
  BarChart3,
  Table2,
  Layers,
  PenLine,
  FileEdit,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Activity,
} from 'lucide-react';
import {
  TestSession,
  Laboratory,
  PatientProfile,
} from '../types/clinical';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';
import { BiomarkerReferenceRangeChart } from './BiomarkerReferenceRangeChart';
import { ClinicalNotesRichEditor } from './ClinicalNotesRichEditor';
import { ClinicalNotesSection } from './ClinicalNotesSection';
import { BiomarkerSparkline } from './BiomarkerSparkline';
import { getSessions } from '../services/storageService';
import { NavTab } from './Navigation';

interface SessionDetailsScreenProps {
  session: TestSession | null;
  laboratory: Laboratory | null;
  profile: PatientProfile;
  allSessions?: TestSession[];
  onBack: () => void;
  onSelectTab: (tab: NavTab) => void;
}

export const SessionDetailsScreen: React.FC<SessionDetailsScreenProps> = ({
  session,
  laboratory,
  profile,
  allSessions,
  onBack,
  onSelectTab,
}) => {
  const [presentationView, setPresentationView] = useState<'both' | 'chart' | 'table'>('both');
  const [trendHorizon, setTrendHorizon] = useState<number>(6);
  const [showComprehensiveEditor, setShowComprehensiveEditor] = useState<boolean>(false);

  const patientSessions = useMemo(() => {
    if (allSessions && allSessions.length > 0) return allSessions;
    return getSessions().filter((s) => s.profileId === profile.profileId);
  }, [allSessions, profile.profileId]);
  if (!session) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-4">
        <FileText className="w-12 h-12 text-slate-400 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">No Session Selected</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Please select an examination session from the Home overview or historical list to view full clinical details.
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
        >
          Return to Overview
        </button>
      </div>
    );
  }

  const abnormalResults = session.results.filter((r) => r.status !== 'Normal');

  const handleDownloadCsv = () => {
    const headers = 'Biomarker,LOINC,Category,Value,Unit,RefLow,RefHigh,Status,Flag\n';
    const rows = session.results
      .map((r) => {
        const cat = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === r.biomarkerId);
        return `"${cat?.name || r.biomarkerId}","${cat?.code || ''}","${cat?.category || ''}",${r.resultValue},"${r.unitMeasured}",${r.refLow},${r.refHigh},"${r.status}","${r.flag || ''}"`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `HemaMetric_Session_${session.collectionDate}_${profile.lastName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <button
              onClick={onBack}
              className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1 font-medium mb-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Session ID: {session.sessionId}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-emerald-700">{session.status}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Laboratory Blood Examination Report
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                const el = document.getElementById('clinical-notes-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <PenLine className="w-4 h-4 text-indigo-600" />
              <span>Clinical Notes</span>
            </button>
            <button
              onClick={handleDownloadCsv}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-slate-600" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => onSelectTab('trends')}
              className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>View Trends</span>
            </button>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-100 text-xs">
          <div className="space-y-1">
            <div className="text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Collection Date:</span>
            </div>
            <div className="font-bold text-slate-900 font-mono text-sm">
              {session.collectionDate}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-slate-500 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Laboratory Facility:</span>
            </div>
            <div className="font-bold text-slate-900 text-sm">
              {laboratory?.labName || 'Clinical Diagnostic Laboratory'}
            </div>
            <div className="text-2xs text-slate-500 font-mono">
              {laboratory?.accreditation || 'CAP & CLIA Accredited'}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Ordering Physician:</span>
            </div>
            <div className="font-bold text-slate-900 text-sm">
              {session.orderingPhysician}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Fasting Condition:</span>
            </div>
            <div className="font-bold text-slate-900 text-sm font-mono">
              {session.fastingHours} Hours Fasting
            </div>
          </div>
        </div>

        {session.notes && (
          <div className="p-3 bg-indigo-50/40 rounded-lg text-xs text-slate-700 border border-indigo-100 flex items-start justify-between gap-3">
            <div>
              <span className="font-bold text-slate-900 block mb-0.5">Diagnostic Baseline Summary:</span>
              <p className="line-clamp-2 text-slate-600">{session.notes}</p>
            </div>
            <button
              onClick={() => {
                const el = document.getElementById('clinical-notes-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-2xs font-semibold text-indigo-700 hover:text-indigo-900 whitespace-nowrap underline cursor-pointer shrink-0"
            >
              Jump to Clinical Notes ↓
            </button>
          </div>
        )}
      </div>

      {/* Clinical Notes & Narrative Observations Section */}
      <ClinicalNotesSection
        session={session}
        profile={profile}
        laboratory={laboratory}
      />

      {/* Attending Summary & Formal Continuous Report Editor (Collapsible) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setShowComprehensiveEditor(!showComprehensiveEditor)}
          className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 transition-colors text-left cursor-pointer border-b border-slate-200/80"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span>Formal Attending Physician Report & Documentation</span>
                <span className="text-3xs font-medium text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
                  Full Laboratory Summary
                </span>
              </div>
              <p className="text-2xs text-slate-500">
                Formal continuous documentation view with rich-text formatting, SOAP structure, and diagnostic print formatting.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span>{showComprehensiveEditor ? 'Collapse Formal Editor' : 'Expand Formal Editor'}</span>
            {showComprehensiveEditor ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </button>

        {showComprehensiveEditor && (
          <div className="p-6">
            <ClinicalNotesRichEditor
              sessionId={session.sessionId}
              initialNotes={session.notes}
              initialNotesHtml={session.notesHtml}
              lastEditedAt={session.notesLastEditedAt}
              author={session.notesAuthor || session.orderingPhysician}
              patientName={`${profile.firstName} ${profile.lastName}`}
              collectionDate={session.collectionDate}
            />
          </div>
        )}
      </div>

      {/* Derived Clinical Metrics Section */}
      {session.derivedMetrics.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Automated Clinical Ratios & Derived Indices
              </h2>
              <p className="text-xs text-slate-500">
                Calculated on-the-fly from raw biomarker values using standardized clinical biomarker formulas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {session.derivedMetrics.map((dm) => (
              <div
                key={dm.metricId}
                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold text-slate-900">{dm.metricName}</span>
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

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {dm.metricValue}
                    </span>
                    <span className="text-2xs text-slate-500 font-sans">
                      Target: {dm.targetOptimalRange}
                    </span>
                  </div>

                  <div className="mt-1 text-2xs text-slate-500 font-mono">
                    Formula: {dm.formulaDescription}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/70 text-2xs text-slate-600 leading-snug">
                  {dm.clinicalInterpretation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Presentation View Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3 px-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">Display Layout:</span>
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-2xs">
            <button
              onClick={() => setPresentationView('both')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                presentationView === 'both'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Unified (Chart & Table)</span>
            </button>
            <button
              onClick={() => setPresentationView('chart')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                presentationView === 'chart'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Reference Range Bar Chart</span>
            </button>
            <button
              onClick={() => setPresentationView('table')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                presentationView === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table2 className="w-3.5 h-3.5 text-slate-600" />
              <span>Tabular Lab Grid</span>
            </button>
          </div>
        </div>

        <div className="text-2xs text-slate-500 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-emerald-500"></span> Standard Range (LLN–ULN)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-amber-500"></span> Out-of-Range High
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-sky-500"></span> Out-of-Range Low
          </span>
        </div>
      </div>

      {/* 1. Biomarker Reference Range Overlay Bar Chart Visualization */}
      {(presentationView === 'both' || presentationView === 'chart') && (
        <BiomarkerReferenceRangeChart
          results={session.results}
          sessionDate={session.collectionDate}
        />
      )}

      {/* 2. Measured Biomarkers Table */}
      {(presentationView === 'both' || presentationView === 'table') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Laboratory Analytes</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {session.results.length} Measured
              </span>
            </h2>
            <div className="text-xs text-slate-500 mt-0.5">
              {abnormalResults.length > 0 ? (
                <span className="text-amber-700 font-medium">
                  {abnormalResults.length} parameter{abnormalResults.length > 1 ? 's' : ''} out of reference interval
                </span>
              ) : (
                <span className="text-emerald-700 font-medium">All measured values within standard intervals</span>
              )}
            </div>
          </div>

          {/* Sparkline Window Controls */}
          <div className="flex items-center gap-2 text-2xs">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              <span>Trend Window:</span>
            </span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setTrendHorizon(6)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  trendHorizon === 6
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Strict 6-month trailing clinical surveillance window"
              >
                6-Month (Default)
              </button>
              <button
                type="button"
                onClick={() => setTrendHorizon(12)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  trendHorizon === 12
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="12-month annual longitudinal trend window"
              >
                12-Month
              </button>
              <button
                type="button"
                onClick={() => setTrendHorizon(999)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  trendHorizon === 999
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Full longitudinal patient history"
              >
                All Tests
              </button>
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Biomarker</th>
                <th className="py-2.5 px-3 font-semibold">Category</th>
                <th className="py-2.5 px-3 font-semibold text-right">Result</th>
                <th className="py-2.5 px-3 font-semibold text-right">Reference Range</th>
                <th className="py-2.5 px-3 font-semibold">Interval Gauge</th>
                <th className="py-2.5 px-3 font-semibold min-w-[185px]">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      {trendHorizon === 6
                        ? '6-Month Trend'
                        : trendHorizon === 12
                        ? '12-Month Trend'
                        : 'Longitudinal Trend'}
                    </span>
                    <span className="text-3xs text-slate-400 font-normal">(Shift)</span>
                  </div>
                </th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {session.results.map((res) => {
                const cat = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === res.biomarkerId);
                const isNormal = res.status === 'Normal';
                const isCrit = res.status.includes('Critical');

                const span = (res.refHigh - res.refLow) || 1;
                const pctPos = Math.max(0, Math.min(100, ((res.resultValue - res.refLow) / span) * 100));

                return (
                  <tr key={res.resultId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      <div>{cat?.name || res.biomarkerId}</div>
                      <div className="text-3xs text-slate-500 font-mono">LOINC {cat?.code}</div>
                    </td>
                    <td className="py-2.5 px-3 text-2xs text-slate-500">
                      {cat?.category}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-slate-900">
                      {res.resultValue} <span className="text-2xs font-normal text-slate-500 font-sans">{res.unitMeasured}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-2xs text-slate-500">
                      {res.refLow} – {res.refHigh} {res.unitMeasured}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="w-32 bg-slate-200 h-2 rounded-full relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 w-full bg-linear-to-r from-amber-200 via-emerald-200 to-amber-200 opacity-60"></div>
                        <div
                          style={{ left: `${pctPos}%` }}
                          className={`absolute top-0 bottom-0 w-2 -ml-1 rounded-full ${
                            isCrit ? 'bg-rose-700' : isNormal ? 'bg-blue-700' : 'bg-amber-600'
                          }`}
                        ></div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <BiomarkerSparkline
                        biomarkerId={res.biomarkerId}
                        currentResult={res}
                        currentSessionDate={session.collectionDate}
                        allSessions={patientSessions}
                        windowMonths={trendHorizon}
                        onSelectBiomarker={() => onSelectTab('trends')}
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`text-2xs font-semibold ${
                          isCrit ? 'text-rose-700' : isNormal ? 'text-emerald-700' : 'text-amber-700'
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
      )}
    </div>
  );
};

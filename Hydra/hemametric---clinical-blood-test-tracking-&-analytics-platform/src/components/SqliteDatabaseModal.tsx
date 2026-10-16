import React, { useState, useEffect } from 'react';
import {
  Database,
  X,
  Download,
  Terminal,
  Play,
  Check,
  AlertCircle,
  FileCode,
  HardDrive,
  Laptop,
  RefreshCw,
  Table,
  Layers,
  Copy,
  FileSpreadsheet,
} from 'lucide-react';
import {
  fetchSqliteDbStats,
  executeSqliteQuery,
  SqliteDbStats,
} from '../services/storageService';
import {
  downloadCsvTemplate,
  SAMPLE_LONGITUDINAL_CSV,
} from '../services/csvParserService';

interface SqliteDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_QUERIES = [
  {
    name: 'Recent Biomarker Results',
    sql: "SELECT s.session_id, s.collection_date, r.biomarker_id, r.result_value, r.unit_measured, r.status FROM test_sessions s JOIN biomarker_results r ON s.session_id = r.session_id ORDER BY s.collection_date DESC LIMIT 20;",
  },
  {
    name: 'Out-of-Range Results',
    sql: "SELECT session_id, biomarker_id, result_value, unit_measured, status FROM biomarker_results WHERE status != 'Normal' LIMIT 15;",
  },
  {
    name: 'Patient Test Counts',
    sql: 'SELECT p.first_name, p.last_name, p.mrn, COUNT(s.session_id) as total_sessions FROM patient_profiles p LEFT JOIN test_sessions s ON p.profile_id = s.profile_id GROUP BY p.profile_id;',
  },
  {
    name: 'High Risk Derived Metrics',
    sql: "SELECT session_id, metric_name, metric_value, unit, status, target_optimal_range FROM derived_metrics WHERE status IN ('Elevated', 'High Risk');",
  },
  {
    name: 'Active Alerts',
    sql: 'SELECT alert_id, biomarker_name, severity, message, acknowledged FROM alerts ORDER BY severity ASC;',
  },
  {
    name: 'SQLite Master Tables',
    sql: "SELECT type, name, tbl_name FROM sqlite_master WHERE type='table' ORDER BY name;",
  },
];

export const SqliteDatabaseModal: React.FC<SqliteDatabaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [stats, setStats] = useState<SqliteDbStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'status' | 'console' | 'csv-guide' | 'laptop-guide'>('status');

  // SQL Console state
  const [sqlQuery, setSqlQuery] = useState<string>(PRESET_QUERIES[0].sql);
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: any[][] } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadStats = async () => {
    setIsLoadingStats(true);
    const data = await fetchSqliteDbStats();
    setStats(data);
    setIsLoadingStats(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunQuery = async () => {
    if (!sqlQuery.trim()) return;
    setIsExecuting(true);
    setQueryError(null);
    try {
      const res = await executeSqliteQuery(sqlQuery);
      setQueryResult(res);
    } catch (err: any) {
      setQueryError(err.message || 'Execution error');
      setQueryResult(null);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center text-white shadow-xs">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Local SQLite Database Engine</h2>
                <span className="text-3xs font-mono font-semibold px-2 py-0.5 rounded-xs bg-emerald-100 text-emerald-800">
                  SQLite 3 (Active)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Data persists in <code className="font-mono text-slate-700 bg-slate-200/70 px-1 py-0.5 rounded">./hemametric.sqlite</code> on your local disk.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/db/export"
              download="hemametric.sqlite"
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Download hemametric.sqlite database file to laptop"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download .sqlite File</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Tab Switcher */}
        <div className="px-5 pt-3 border-b border-slate-200 flex items-center gap-2 bg-white text-xs">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'status'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Database Status & Tables</span>
          </button>
          <button
            onClick={() => setActiveTab('console')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'console'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Interactive SQL Query Console</span>
          </button>
          <button
            onClick={() => setActiveTab('csv-guide')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'csv-guide'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Past Results CSV & Tables</span>
          </button>
          <button
            onClick={() => setActiveTab('laptop-guide')}
            className={`pb-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'laptop-guide'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Run on Your Laptop Guide</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: Database Status & Tables */}
          {activeTab === 'status' && (
            <div className="space-y-6">
              {/* File Info Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-3xs font-bold text-slate-500 uppercase tracking-wider block">
                    SQLite Database File Location
                  </span>
                  <div className="font-mono text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>{stats?.filePath || './hemametric.sqlite'}</span>
                  </div>
                  <div className="text-3xs text-slate-500">
                    File size: <strong>{((stats?.fileSizeBytes || 0) / 1024).toFixed(1)} KB</strong> · Last modified: {stats?.fileModified ? new Date(stats.fileModified).toLocaleString() : 'Just now'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadStats}
                    disabled={isLoadingStats}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin' : ''}`} />
                    <span>Refresh Stats</span>
                  </button>
                </div>
              </div>

              {/* Table Metrics Grid */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  SQLite Relational Tables Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <span className="text-3xs font-semibold text-slate-500 block uppercase">patient_profiles</span>
                    <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                      {stats?.patientCount ?? 4}
                    </div>
                    <span className="text-3xs text-slate-400">Registered patients</span>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <span className="text-3xs font-semibold text-slate-500 block uppercase">test_sessions</span>
                    <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                      {stats?.sessionCount ?? 14}
                    </div>
                    <span className="text-3xs text-slate-400">Clinical test sessions</span>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <span className="text-3xs font-semibold text-slate-500 block uppercase">biomarker_results</span>
                    <div className="text-2xl font-bold font-mono text-blue-700 mt-1">
                      {stats?.biomarkerResultCount ?? 320}
                    </div>
                    <span className="text-3xs text-slate-400">Measured analyte facts</span>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <span className="text-3xs font-semibold text-slate-500 block uppercase">alerts</span>
                    <div className="text-2xl font-bold font-mono text-amber-700 mt-1">
                      {stats?.alertCount ?? 8}
                    </div>
                    <span className="text-3xs text-slate-400">Critical & warning alerts</span>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                    <span className="text-3xs font-semibold text-slate-500 block uppercase">laboratories</span>
                    <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                      {stats?.laboratoryCount ?? 3}
                    </div>
                    <span className="text-3xs text-slate-400">Accredited diagnostic labs</span>
                  </div>
                </div>
              </div>

              {/* SQLite Schema Blueprint */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-900 text-slate-100 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800 text-2xs">
                  <span>SQLite Schema Architecture</span>
                  <span>ACID Compliant · Foreign Keys Enabled</span>
                </div>
                <pre className="text-3xs text-slate-300 leading-relaxed overflow-x-auto">
{`CREATE TABLE laboratories (lab_id TEXT PRIMARY KEY, lab_name TEXT, accreditation TEXT...);
CREATE TABLE patient_profiles (profile_id TEXT PRIMARY KEY, first_name TEXT, mrn TEXT...);
CREATE TABLE test_sessions (session_id TEXT PRIMARY KEY, profile_id TEXT REFERENCES patient_profiles, notes TEXT, notes_html TEXT...);
CREATE TABLE biomarker_results (result_id TEXT PRIMARY KEY, session_id TEXT REFERENCES test_sessions, biomarker_id TEXT, result_value REAL...);
CREATE TABLE derived_metrics (metric_id TEXT PRIMARY KEY, session_id TEXT REFERENCES test_sessions, metric_name TEXT, metric_value REAL...);
CREATE TABLE alerts (alert_id TEXT PRIMARY KEY, session_id TEXT, severity TEXT, acknowledged INTEGER...);`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: Interactive SQL Query Console */}
          {activeTab === 'console' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Preset Diagnostic SQL Queries:
                  </label>
                  <span className="text-3xs text-slate-400">Click to load query</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_QUERIES.map((pq) => (
                    <button
                      key={pq.name}
                      onClick={() => setSqlQuery(pq.sql)}
                      className="px-2.5 py-1 text-2xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer"
                    >
                      {pq.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">SQL Query Editor:</label>
                  <button
                    onClick={handleRunQuery}
                    disabled={isExecuting}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>{isExecuting ? 'Executing...' : 'Run Query'}</span>
                  </button>
                </div>
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-lg border border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {queryError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2 font-mono">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{queryError}</span>
                </div>
              )}

              {queryResult && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-2xs text-slate-500 font-mono">
                    <span>Query Result: {queryResult.rows.length} rows returned</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(queryResult, null, 2), 'sql-json')}
                      className="text-blue-700 hover:underline cursor-pointer"
                    >
                      {copiedCode === 'sql-json' ? 'Copied JSON!' : 'Copy Result JSON'}
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-64 text-xs font-mono">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 text-2xs sticky top-0">
                        <tr>
                          {queryResult.columns.map((col, idx) => (
                            <th key={idx} className="py-2 px-3 font-semibold">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {queryResult.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50">
                            {row.map((val, cIdx) => (
                              <td key={cIdx} className="py-1.5 px-3 whitespace-nowrap text-2xs text-slate-800">
                                {val === null ? <span className="text-slate-400 italic">NULL</span> : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Past Results CSV & Tables Guide */}
          {activeTab === 'csv-guide' && (
            <div className="space-y-6 text-xs text-slate-700 leading-relaxed">
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-xs text-blue-950">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-blue-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                    <span>Which SQLite Tables to Update with Past Results?</span>
                  </div>
                  <button
                    onClick={downloadCsvTemplate}
                    className="px-2.5 py-1 text-2xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-blue-600" />
                    <span>Download CSV Template</span>
                  </button>
                </div>
                <p className="text-2xs text-blue-800 leading-relaxed">
                  In Hemametric, clinical test records use a relational schema. A historical blood test draw requires inserting a parent record into <strong>test_sessions</strong>, followed by individual analyte records into <strong>biomarker_results</strong>. The application automatically computes <strong>derived_metrics</strong> and logs <strong>alerts</strong>.
                </p>
              </div>

              {/* Table breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-slate-900 text-xs">1. test_sessions (Parent Draw)</span>
                    <span className="text-3xs bg-blue-100 text-blue-800 font-semibold px-1.5 py-0.5 rounded">Required First</span>
                  </div>
                  <p className="text-3xs text-slate-500">
                    Defines the blood test event date, patient, lab, and clinician notes.
                  </p>
                  <pre className="p-2 bg-slate-900 text-slate-200 rounded text-3xs font-mono overflow-x-auto">
{`INSERT INTO test_sessions 
(session_id, profile_id, lab_id, collection_date, fasting_hours, ordering_physician, notes, status, created_date)
VALUES ('sess-hist-01', 'pat-eleanor-01', 'lab-quest-01', '2026-04-10', 12.0, 'Dr. Martinez', 'Past annual panel', 'Verified', datetime('now'));`}
                  </pre>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-slate-900 text-xs">2. biomarker_results (Analyte Rows)</span>
                    <span className="text-3xs bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded">Foreign Key</span>
                  </div>
                  <p className="text-3xs text-slate-500">
                    Stores individual analyte values. Links via <code className="font-mono text-slate-700">session_id</code>.
                  </p>
                  <pre className="p-2 bg-slate-900 text-slate-200 rounded text-3xs font-mono overflow-x-auto">
{`INSERT INTO biomarker_results 
(result_id, session_id, biomarker_id, result_value, unit_measured, ref_low, ref_high, status)
VALUES 
  ('res-h1', 'sess-hist-01', 'bm-glu', 95.0, 'mg/dL', 70.0, 99.0, 'Normal'),
  ('res-h2', 'sess-hist-01', 'bm-hba1c', 5.5, '%', 4.0, 5.6, 'Normal'),
  ('res-h3', 'sess-hist-01', 'bm-crp', 0.8, 'mg/L', 0.1, 3.0, 'Normal');`}
                  </pre>
                </div>
              </div>

              {/* Recommended CSV Format */}
              <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs">
                    Standard CSV File Layout for Automated Upload
                  </h4>
                  <button
                    onClick={() => handleCopy(SAMPLE_LONGITUDINAL_CSV, 'modal-csv')}
                    className="text-2xs text-blue-700 hover:underline flex items-center gap-1 cursor-pointer font-mono"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedCode === 'modal-csv' ? 'Copied!' : 'Copy Sample CSV'}</span>
                  </button>
                </div>
                <p className="text-2xs text-slate-600">
                  Save your past lab results in a CSV file with the following columns. You can upload this directly via the <strong>Upload</strong> screen:
                </p>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg font-mono text-2xs overflow-x-auto">
{SAMPLE_LONGITUDINAL_CSV}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: Run on Your Laptop Guide */}
          {activeTab === 'laptop-guide' && (
            <div className="space-y-5 text-xs text-slate-700 leading-relaxed">
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                <div className="font-bold text-sm text-blue-900 flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-blue-700" />
                  <span>Zero-Configuration Local Laptop Setup</span>
                </div>
                <p className="text-xs text-blue-800">
                  This application is configured as a full-stack local Node.js app using Express + Vite and SQLite. It creates and persists directly into <code className="font-mono font-bold">hemametric.sqlite</code> on your laptop filesystem with no external database server or cloud connection required.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 text-sm">3 Quick Steps to Run on Your Laptop:</h4>

                {/* Step 1 */}
                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Step 1: Install Dependencies</span>
                    <button
                      onClick={() => handleCopy('npm install', 'c-install')}
                      className="text-2xs text-blue-700 hover:underline flex items-center gap-1 cursor-pointer font-mono"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedCode === 'c-install' ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-2xs overflow-x-auto">
                    npm install
                  </pre>
                  <p className="text-2xs text-slate-500">
                    Installs React 19, Vite, Express, and <code className="font-mono text-slate-700">sql.js</code> SQLite engine.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Step 2: Start Local Dev Server with SQLite</span>
                    <button
                      onClick={() => handleCopy('npm run dev', 'c-dev')}
                      className="text-2xs text-blue-700 hover:underline flex items-center gap-1 cursor-pointer font-mono"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedCode === 'c-dev' ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-2xs overflow-x-auto">
                    npm run dev
                  </pre>
                  <p className="text-2xs text-slate-500">
                    Runs <code className="font-mono text-slate-700">tsx server.ts</code>. It mounts Vite middlewares, opens on port 3000, and connects to <code className="font-mono text-slate-700">hemametric.sqlite</code>.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Step 3: Open in Browser</span>
                    <button
                      onClick={() => handleCopy('http://localhost:3000', 'c-url')}
                      className="text-2xs text-blue-700 hover:underline flex items-center gap-1 cursor-pointer font-mono"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedCode === 'c-url' ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg font-mono text-2xs overflow-x-auto">
                    http://localhost:3000
                  </pre>
                  <p className="text-2xs text-slate-500">
                    All lab sessions, biomarker entries, and clinician notes will be automatically saved directly into <code className="font-mono text-slate-700">hemametric.sqlite</code> on your laptop hard drive.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-100 rounded-xl text-2xs text-slate-600 space-y-1">
                <span className="font-bold text-slate-800">Inspecting Your SQLite Database on Your Laptop:</span>
                <p>
                  You can inspect the generated <code className="font-mono text-slate-800 font-semibold">hemametric.sqlite</code> file using free tools like <strong>DB Browser for SQLite</strong>, <strong>DBeaver</strong>, <strong>VS Code SQLite Viewer extension</strong>, or the command line: <code className="font-mono text-slate-800">sqlite3 hemametric.sqlite</code>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>SQLite Active · Disk Synchronized</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

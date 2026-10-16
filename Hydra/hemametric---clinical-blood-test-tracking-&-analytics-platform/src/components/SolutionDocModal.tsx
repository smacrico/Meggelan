import React, { useState } from 'react';
import {
  FileCode2,
  X,
  Database,
  Layers,
  Cpu,
  BrainCircuit,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Radio,
  Sparkles,
  TrendingUp,
  Activity,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { VisioArchitectureDiagram } from './VisioArchitectureDiagram';

interface SolutionDocModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SolutionDocModal: React.FC<SolutionDocModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'visio' | 'architecture' | 'erd' | 'pipelines' | 'predictive' | 'compliance'
  >('visio');
  const [copiedDoc, setCopiedDoc] = useState(false);

  if (!isOpen) return null;

  const handleCopyFullArchitecture = () => {
    const docContent = `# HemaMetric: Clinical Blood Test Tracking & Analytics Platform
## System Architecture Document & Visio-Style Feature Topology (v2.4.0)

### 1. Executive Summary & Vision
HemaMetric unifies clinical laboratory results into a standardized longitudinal biomarker store mapped to LOINC, calculating derived clinical ratios (De Ritis, eGFR CKD-EPI, HOMA-IR), biological age, 12-month predictive trajectories, background real-time laboratory polling, and natural language trend summaries.

### 2. Visio Architectural Blueprint
- Swimlane 1: External Diagnostic Sources & Real-Time Polling Bus (Quest, LabCorp, Mayo Clinic, Background Poller, In-Memory Staging Queue, File Parser)
- Swimlane 2: Client Presentation Tier (App Shell, Session Details with 6-Month Sparklines, Trend Analytics, Differentials, Predictive Studio, Power BI Hub, Alert Center)
- Swimlane 3: Clinical Engines & Algorithms (Calculation Engine, Biometric Age Engine, Predictive OLS & FIB-4 Engine, AI Trend Summary Service)
- Swimlane 4: Persistence & Data Layer (LocalStorage Service, SQLite In-Browser SQL Engine, Master Biomarker Catalog with LOINC Codes)
- Swimlane 5: Enterprise Alerting & Cloud Services (Clinical Alert Threshold Rules, Power Platform Dataverse & Confluence Integration)

### 3. Core Database Entities (ERD)
- PatientProfile (ProfileID [PK], FirstName, LastName, DOB, Gender, MRN [UQ], BloodType, MedicalConditions)
- Laboratory (LabID [PK], LabName, Country, Accreditation, LicenseNumber)
- TestSession (SessionID [PK], ProfileID [FK], LabID [FK], CollectionDate, CollectionTime, FastingHours, Notes, Status)
- BiomarkerCatalog (BiomarkerID [PK], Name, Category, LOINC, StandardUnit, RefLow, RefHigh, CriticalLow, CriticalHigh)
- BiomarkerResult (ResultID [PK], SessionID [FK], BiomarkerID [FK], ResultValue, UnitMeasured, Status, Flag)
- DerivedMetrics (MetricID [PK], SessionID [FK], MetricName, MetricValue, TargetRange, Interpretation)
- AlertHistory (AlertID [PK], ProfileID [FK], SessionID [FK], Severity, Message, ClinicalGuideline, Status)

### 4. Real-Time Lab Polling & Ingestion Pipeline
- Background worker with 15s/30s/60s/120s configurable intervals
- Staging queue with hash-based deduplication
- Auto-ingestion toggle switch and manual review & merge interface

### 5. Predictive Analytics & AI
- Ordinary least-squares regression: y = mt + b
- Rate-of-change velocity: dY/dt
- FIB-4 Hepatic Steatosis Index & 12-Month forward projection
- Natural language clinical summaries with significant shift detection
    `;
    navigator.clipboard.writeText(docContent);
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const docContent = `# HemaMetric: Clinical Blood Test Tracking & Analytics Platform
## Architecture Specification & Visio Blueprint
(Downloaded from HemaMetric v2.4.0)

Please refer to the full ARCHITECTURE.md file in the project repository root for comprehensive documentation including mathematical formulas, ERD schemas, and deployment topologies.`;
    const blob = new Blob([docContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'HemaMetric-Architecture-Specification.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-7xl w-full max-h-[96vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  System Architecture & Visio Blueprint
                </h2>
                <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-blue-100 text-blue-800 font-mono">
                  v2.4.0
                </span>
              </div>
              <div className="text-2xs text-slate-500">
                Enterprise Clinical Architecture, Visio Stencils, Feature Topology & ERD Schema
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyFullArchitecture}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {copiedDoc ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDoc ? 'Copied Markdown' : 'Copy Doc'}</span>
            </button>
            <button
              onClick={handleDownloadMarkdown}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download MD</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer hover:bg-slate-200/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-1 px-5 pt-2.5 border-b border-slate-200 bg-white overflow-x-auto text-xs shrink-0">
          {[
            { id: 'visio', label: '1. Visio Diagram (Interactive)', icon: Layers },
            { id: 'architecture', label: '2. Architecture Specification', icon: FileCode2 },
            { id: 'erd', label: '3. Database Schema (ERD)', icon: Database },
            { id: 'pipelines', label: '4. Real-Time Ingestion & ETL', icon: Radio },
            { id: 'predictive', label: '5. Predictive & AI Models', icon: BrainCircuit },
            { id: 'compliance', label: '6. Regulatory & HIPAA', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2.5 border-b-2 font-medium whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-blue-700 text-blue-700 font-bold bg-blue-50/40 rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-blue-700' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {/* TAB 1: VISIO DIAGRAM */}
          {activeTab === 'visio' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-700 shrink-0" />
                  <div>
                    <span className="font-bold">Interactive Visio Architecture Canvas:</span> Explore all app subsystems, background polling loops, 6-month sparkline rendering pipelines, and predictive risk engines.
                  </div>
                </div>
                <div className="text-2xs text-blue-700 font-medium">
                  Click any shape to inspect its data contract & code file
                </div>
              </div>

              {/* Visio Canvas Component */}
              <VisioArchitectureDiagram />
            </div>
          )}

          {/* TAB 2: ARCHITECTURE SPECIFICATION */}
          {activeTab === 'architecture' && (
            <div className="space-y-6 text-xs text-slate-700 leading-relaxed max-w-5xl mx-auto">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-blue-700" />
                  <span>Executive Architectural Blueprint & Subsystems</span>
                </h3>
                <p>
                  HemaMetric is architected as a clinical analytics platform bridging real-time diagnostic laboratory ingress (Quest Diagnostics, LabCorp, Mayo Clinic), longitudinal time-series normalization, automated mathematical clinical derivations, and predictive disease trajectory modeling.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ingestion & Polling Tier</span>
                    </div>
                    <p className="text-2xs text-slate-600">
                      Asynchronous worker polling LIS endpoints (15s–120s), deduplicating incoming test sessions via SHA-like hash validation, and staging results for clinician review.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Calculation & AI Engines</span>
                    </div>
                    <p className="text-2xs text-slate-600">
                      Calculates derived ratios (De Ritis, eGFR CKD-EPI, HOMA-IR), PhenoAge biological age estimation, and generates natural-language clinical trend summaries.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Clinical Presentation</span>
                    </div>
                    <p className="text-2xs text-slate-600">
                      High-density React SPA with embedded 6-month SVG sparklines, interactive reference interval gauges, Power BI DAX explorer, and multi-patient switching.
                    </p>
                  </div>
                </div>

                <div className="pt-4">
                  <h4 className="font-bold text-slate-900 mb-2">Visio Multi-Tier Topology Summary</h4>
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-2xs space-y-1 overflow-x-auto leading-normal">
                    <div>[LAYER 1: CLINICAL PRESENTATION]  React 18 SPA · 6-Month Sparklines · Interval Gauges · Rich Notes · Power BI Hub</div>
                    <div>                                          ▲</div>
                    <div>                                          │ (Reactive Props & Context Hooks)</div>
                    <div>[LAYER 2: BUSINESS & CALCULATION] calculationEngine · biometricAgeEngine · predictiveEngine · aiTrendService</div>
                    <div>                                          ▲</div>
                    <div>                                          │ (Longitudinal Harmonized Records)</div>
                    <div>[LAYER 3: DATA STORAGE & CATALOG] storageService · Master Catalog (LOINC) · SQLite Explorer (sql.js) · LocalStore</div>
                    <div>                                          ▲</div>
                    <div>                                          │ (Staging Buffer & Ingestion Bus)</div>
                    <div>[LAYER 4: DIAGNOSTIC INGESTION]   labPollingService (15s-120s LIS) · csvParserService · Manual Upload Pipeline</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ERD */}
          {activeTab === 'erd' && (
            <div className="space-y-4 max-w-5xl mx-auto">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3 text-xs">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-fuchsia-700" />
                  <span>Relational Database Schema & Entity Relationship Model (ERD)</span>
                </h3>
                <p className="text-slate-600 text-2xs">
                  Strictly normalized schema supporting longitudinal tracking across multiple clinical laboratory providers, LOINC-mapped master catalogs, and derived analytics:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                  {/* PatientProfile Card */}
                  <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">PatientProfile</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">Entity</span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px] text-slate-600">
                      <div className="text-blue-700 font-bold">PK profileId : UUID</div>
                      <div>mrn : string (UNIQUE)</div>
                      <div>firstName, lastName : string</div>
                      <div>dob : date (YYYY-MM-DD)</div>
                      <div>gender : 'M' | 'F'</div>
                      <div>bloodType : string</div>
                      <div>medicalConditions : string[]</div>
                    </div>
                  </div>

                  {/* Laboratory Card */}
                  <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">Laboratory</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">Entity</span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px] text-slate-600">
                      <div className="text-blue-700 font-bold">PK labId : UUID</div>
                      <div>name : string</div>
                      <div>country : string</div>
                      <div>accreditation : string (CAP/CLIA)</div>
                      <div>licenseNumber : string</div>
                      <div>city, state : string</div>
                    </div>
                  </div>

                  {/* TestSession Card */}
                  <div className="p-3.5 border border-blue-200 rounded-xl bg-blue-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-900 text-xs">TestSession</span>
                      <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.2 rounded font-mono">Fact Header</span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px] text-slate-600">
                      <div className="text-blue-700 font-bold">PK sessionId : UUID</div>
                      <div className="text-purple-700">FK profileId -&gt; PatientProfile</div>
                      <div className="text-purple-700">FK labId -&gt; Laboratory</div>
                      <div>collectionDate : ISO Date</div>
                      <div>fastingHours : number</div>
                      <div>notes : string (Markdown)</div>
                      <div>status : 'Completed' | 'Pending'</div>
                    </div>
                  </div>

                  {/* BiomarkerCatalog Master */}
                  <div className="p-3.5 border border-emerald-200 rounded-xl bg-emerald-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 text-xs">BiomarkerCatalog</span>
                      <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded font-mono">Master Dim</span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px] text-slate-600">
                      <div className="text-blue-700 font-bold">PK biomarkerId : string</div>
                      <div className="text-emerald-700 font-bold">loincCode : string (e.g. 2093-3)</div>
                      <div>name, category : string</div>
                      <div>standardUnit : string</div>
                      <div>referenceLow, referenceHigh : num</div>
                      <div>criticalLow, criticalHigh : num</div>
                    </div>
                  </div>

                  {/* BiomarkerResult Fact */}
                  <div className="p-3.5 border border-amber-200 rounded-xl bg-amber-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 text-xs">BiomarkerResult</span>
                      <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.2 rounded font-mono">Fact Line</span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px] text-slate-600">
                      <div className="text-blue-700 font-bold">PK resultId : UUID</div>
                      <div className="text-purple-700">FK sessionId -&gt; TestSession</div>
                      <div className="text-purple-700">FK biomarkerId -&gt; Catalog</div>
                      <div>resultValue : number</div>
                      <div>unitMeasured : string</div>
                      <div>status : ResultStatus</div>
                      <div>flag : 'None'|'Low'|'High'|'Crit'</div>
                    </div>
                  </div>

                  {/* DerivedMetrics Fact */}
                  <div className="p-3.5 border border-purple-200 rounded-xl bg-purple-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-900 text-xs">DerivedMetrics</span>
                      <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.2 rounded font-mono">Calculated</span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px] text-slate-600">
                      <div className="text-blue-700 font-bold">PK metricId : UUID</div>
                      <div className="text-purple-700">FK sessionId -&gt; TestSession</div>
                      <div>metricName : string</div>
                      <div>metricValue : number</div>
                      <div>targetRange : string</div>
                      <div>interpretation : string</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: REAL-TIME INGESTION & PIPELINES */}
          {activeTab === 'pipelines' && (
            <div className="space-y-4 max-w-5xl mx-auto text-xs text-slate-700">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-blue-600" />
                  <span>Real-Time Laboratory Polling & Diagnostic Ingestion Architecture</span>
                </h3>
                <p>
                  To eliminate manual report entry, HemaMetric features an asynchronous background polling engine simulating Hospital Laboratory Information System (LIS) connections:
                </p>

                <div className="space-y-3 pt-2">
                  <div className="p-3.5 border border-slate-200 rounded-lg space-y-1.5 bg-slate-50">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-2xs">1</span>
                      <span>Configurable Polling Loop (15s – 120s)</span>
                    </div>
                    <p className="text-2xs text-slate-600 pl-7">
                      Runs in a non-blocking web worker loop. Periodically sends HTTP GET / FHIR requests to simulated hospital laboratory gateways (Quest, LabCorp, Mayo Clinic).
                    </p>
                  </div>

                  <div className="p-3.5 border border-slate-200 rounded-lg space-y-1.5 bg-slate-50">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-2xs">2</span>
                      <span>Idempotent Deduplication & Staging Buffer</span>
                    </div>
                    <p className="text-2xs text-slate-600 pl-7">
                      Generates session collision signatures based on MRN, collection timestamp, and laboratory accreditation. Stages incoming payloads into an in-memory queue to prevent duplicate database ingestion.
                    </p>
                  </div>

                  <div className="p-3.5 border border-slate-200 rounded-lg space-y-1.5 bg-slate-50">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-2xs">3</span>
                      <span>Physician Review or Auto-Ingest Mode</span>
                    </div>
                    <p className="text-2xs text-slate-600 pl-7">
                      Clinicians can view incoming sessions in the LIS Feed Modal, review analyte values, and click 'Approve & Merge' or enable 'Auto-Ingest' for immediate background processing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PREDICTIVE & AI */}
          {activeTab === 'predictive' && (
            <div className="space-y-4 max-w-5xl mx-auto text-xs text-slate-700">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-purple-700" />
                  <span>Predictive Trajectory Regressions & AI Summarization Engine</span>
                </h3>
                <p>
                  The platform combines deterministic mathematical modeling with cognitive AI summarization:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 border border-purple-200 rounded-xl bg-purple-50/40 space-y-2">
                    <div className="font-bold text-purple-950 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-purple-700" />
                      <span>Ordinary Least-Squares (OLS) Regressions</span>
                    </div>
                    <p className="text-2xs text-slate-600">
                      Projects biomarker levels 12 months into the future:
                    </p>
                    <div className="p-2 bg-white rounded border border-purple-200 font-mono text-2xs text-purple-900 text-center">
                      y(t) = mt + b &nbsp;|&nbsp; Velocity = dY/dt
                    </div>
                    <p className="text-2xs text-slate-600">
                      Detects whether critical health boundaries will be crossed within the next 365 days.
                    </p>
                  </div>

                  <div className="p-4 border border-indigo-200 rounded-xl bg-indigo-50/40 space-y-2">
                    <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-700" />
                      <span>Natural Language Trend AI Summary</span>
                    </div>
                    <p className="text-2xs text-slate-600">
                      Processes longitudinal sessions through shift detection rules:
                    </p>
                    <ul className="space-y-1 text-2xs text-slate-600 list-disc list-inside">
                      <li>Flags biomarker deltas exceeding ±15%</li>
                      <li>Highlights normal-to-abnormal clinical transitions</li>
                      <li>Synthesizes metabolic, hepatic, and inflammatory patterns</li>
                      <li>Generates actionable clinician bullet points and lifestyle advice</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: COMPLIANCE & HIPAA */}
          {activeTab === 'compliance' && (
            <div className="space-y-4 max-w-5xl mx-auto text-xs text-slate-700">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Healthcare Regulatory, Security & HIPAA Compliance Framework</span>
                </h3>
                <p>
                  Engineered to meet HIPAA Title II Security Rule, HITECH, and GDPR medical data specifications:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="font-bold text-slate-900">Encryption Standards</div>
                    <p className="text-2xs text-slate-600">
                      AES-256 bit encryption at rest on all persistent document stores. TLS 1.3 enforced for all diagnostic polling and API endpoints.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="font-bold text-slate-900">PHI De-Identification</div>
                    <p className="text-2xs text-slate-600">
                      Safe Harbor de-identification compliant, stripping direct identifiers (Name, DOB, Contact) when exporting data for clinical research.
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="font-bold text-slate-900">Audit Trail & RBAC</div>
                    <p className="text-2xs text-slate-600">
                      Role-based access separation between Attending Physicians, Lab Technicians, and Auditors. Immutable provenance logging of all report edits.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-2xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">HemaMetric Platform</span>
            <span>·</span>
            <span>Architecture & Visio Feature Blueprint v2.4.0</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            Close Blueprint
          </button>
        </div>
      </div>
    </div>
  );
};

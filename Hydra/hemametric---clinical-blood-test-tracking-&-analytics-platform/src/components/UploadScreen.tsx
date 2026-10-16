import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  Database,
  Building2,
  Calendar,
  Sparkles,
  RefreshCw,
  Edit2,
  Trash2,
  Check,
  Download,
  HelpCircle,
  FileCheck,
  AlertTriangle,
  Table as TableIcon,
  Info,
  Copy,
  Plus,
  Radio,
  Zap,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import {
  PatientProfile,
  Laboratory,
  BiomarkerResult,
  TestSession,
  AlertHistory,
} from '../types/clinical';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';
import {
  evaluateBiomarkerStatus,
  computeDerivedMetrics,
  generateAlertsForSession,
} from '../services/calculationEngine';
import {
  parseClinicalCsv,
  downloadCsvTemplate,
  SAMPLE_LONGITUDINAL_CSV,
  CsvValidationRow,
} from '../services/csvParserService';
import {
  getPollingState,
  subscribeToPolling,
  pollNow,
  simulateIncomingResult,
  commitPendingItem,
  commitAllPending,
  dismissPendingItem,
  setIntervalSeconds,
  setAutoCommit,
  setSoundNotification,
  togglePolling,
  LabPollingState,
} from '../services/labPollingService';

interface UploadScreenProps {
  profiles: PatientProfile[];
  labs: Laboratory[];
  selectedProfileId: string;
  onSessionCommitted: (newSession: TestSession, alerts?: AlertHistory[]) => void;
}

type IngestionMode = 'csv-parser' | 'simulated-ocr' | 'realtime-polling' | 'schema-guide';

export const UploadScreen: React.FC<UploadScreenProps> = ({
  profiles,
  labs,
  selectedProfileId,
  onSessionCommitted,
}) => {
  const [ingestionMode, setIngestionMode] = useState<IngestionMode>('csv-parser');

  // Target Session Context
  const [profileId, setProfileId] = useState(selectedProfileId);
  const [labId, setLabId] = useState(labs[0]?.labId || 'lab-quest-01');
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [fastingHours, setFastingHours] = useState(12);
  const [doctorName, setDoctorName] = useState('Dr. Rebecca Martinez, MD');
  const [notes, setNotes] = useState('Annual routine biomarker checkup and metabolic surveillance.');

  // CSV Parser State
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [validationRows, setValidationRows] = useState<CsvValidationRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isCsvParsed, setIsCsvParsed] = useState<boolean>(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Simulated OCR / Legacy Sample State
  const [file, setFile] = useState<{ name: string; size: string; type: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [etlStep, setEtlStep] = useState<number>(0);
  const [committedSuccess, setCommittedSuccess] = useState(false);
  const [lastCommittedSessionId, setLastCommittedSessionId] = useState<string | null>(null);
  const [lastCommittedDerivedCount, setLastCommittedDerivedCount] = useState<number>(0);
  const [lastCommittedAlertsCount, setLastCommittedAlertsCount] = useState<number>(0);

  // Real-Time Polling State
  const [pollingState, setPollingState] = useState<LabPollingState>(getPollingState());
  const [isSimulatingFeed, setIsSimulatingFeed] = useState(false);
  const [isManualChecking, setIsManualChecking] = useState(false);

  useEffect(() => {
    const unsub = subscribeToPolling((updated) => {
      setPollingState(updated);
    });
    return () => unsub();
  }, []);

  const selectedProfile = profiles.find((p) => p.profileId === profileId) || profiles[0];

  // Pre-loaded sample reports for OCR simulator
  const sampleReports = [
    {
      title: 'Quest Diagnostics Comprehensive Metabolic & Lipid PDF',
      fileName: 'Quest_Diagnostics_CMP_Lipid_Panel_2026.pdf',
      labId: 'lab-quest-01',
      date: '2026-10-05',
      data: [
        { id: 'bm-glu', val: 104, unit: 'mg/dL' },
        { id: 'bm-hba1c', val: 5.7, unit: '%' },
        { id: 'bm-chol', val: 218, unit: 'mg/dL' },
        { id: 'bm-ldl', val: 135, unit: 'mg/dL' },
        { id: 'bm-hdl', val: 48, unit: 'mg/dL' },
        { id: 'bm-tg', val: 172, unit: 'mg/dL' },
        { id: 'bm-cr', val: 0.88, unit: 'mg/dL' },
        { id: 'bm-egfr', val: 92, unit: 'mL/min/1.73m²' },
        { id: 'bm-alt', val: 36, unit: 'U/L' },
        { id: 'bm-ast', val: 30, unit: 'U/L' },
        { id: 'bm-crp', val: 3.2, unit: 'mg/L' },
      ],
    },
    {
      title: 'Labcorp Complete Blood Count (CBC) & Ferritin CSV',
      fileName: 'Labcorp_CBC_Iron_Panel_Export.csv',
      labId: 'lab-corp-02',
      date: '2026-09-28',
      data: [
        { id: 'bm-hgb', val: 13.6, unit: 'g/dL' },
        { id: 'bm-hct', val: 40.2, unit: '%' },
        { id: 'bm-wbc', val: 6.8, unit: '×10³/µL' },
        { id: 'bm-plt', val: 285, unit: '×10³/µL' },
        { id: 'bm-neut', val: 4.1, unit: '×10³/µL' },
        { id: 'bm-lymph', val: 2.1, unit: '×10³/µL' },
        { id: 'bm-mono', val: 0.45, unit: '×10³/µL' },
        { id: 'bm-ferr', val: 42.0, unit: 'ng/mL' },
        { id: 'bm-iron', val: 88, unit: 'µg/dL' },
        { id: 'bm-tsat', val: 27.5, unit: '%' },
        { id: 'bm-vitd', val: 46.0, unit: 'ng/mL' },
      ],
    },
    {
      title: 'Mayo Clinic Hepatic & Inflammatory Workup Excel',
      fileName: 'Mayo_Clinic_Liver_Enzyme_Workup.xlsx',
      labId: 'lab-mayo-03',
      date: '2026-10-02',
      data: [
        { id: 'bm-alt', val: 44, unit: 'U/L' },
        { id: 'bm-ast', val: 38, unit: 'U/L' },
        { id: 'bm-alp', val: 82, unit: 'U/L' },
        { id: 'bm-bili', val: 0.8, unit: 'mg/dL' },
        { id: 'bm-alb', val: 4.4, unit: 'g/dL' },
        { id: 'bm-crp', val: 2.4, unit: 'mg/L' },
        { id: 'bm-plt', val: 260, unit: '×10³/µL' },
      ],
    },
  ];

  // -------------------------------------------------------------------------
  // CSV FILE HANDLING & PARSING
  // -------------------------------------------------------------------------
  const executeCsvParse = (text: string, filename?: string) => {
    if (!selectedProfile) return;
    setCommittedSuccess(false);
    const parsed = parseClinicalCsv(text, selectedProfile, labId);

    if (filename) setUploadedFileName(filename);
    setValidationRows(parsed.rows);
    setValidationErrors(parsed.globalErrors);
    setIsCsvParsed(true);

    // If date was detected in the CSV
    if (parsed.detectedSessionMetadata.collectionDate) {
      setCollectionDate(parsed.detectedSessionMetadata.collectionDate);
    }
    if (parsed.detectedSessionMetadata.labId && labs.some((l) => l.labId === parsed.detectedSessionMetadata.labId)) {
      setLabId(parsed.detectedSessionMetadata.labId);
    }
    if (parsed.detectedSessionMetadata.orderingPhysician) {
      setDoctorName(parsed.detectedSessionMetadata.orderingPhysician);
    }
    if (parsed.detectedSessionMetadata.notes) {
      setNotes(parsed.detectedSessionMetadata.notes);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const uploaded = fileList[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvRawText(text);
        executeCsvParse(text, uploaded.name);
      }
    };
    reader.readAsText(uploaded);
  };

  const handleCsvDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setCsvRawText(text);
          executeCsvParse(text, dropped.name);
        }
      };
      reader.readAsText(dropped);
    }
  };

  const handleLoadSampleCsv = () => {
    setCsvRawText(SAMPLE_LONGITUDINAL_CSV);
    executeCsvParse(SAMPLE_LONGITUDINAL_CSV, 'hemametric_past_results_sample.csv');
  };

  // Modify a staged row's value or analyte
  const handleUpdateValidationRow = (
    index: number,
    field: 'biomarkerId' | 'parsedValue' | 'unit' | 'refLow' | 'refHigh',
    val: any
  ) => {
    const updated = [...validationRows];
    const row = { ...updated[index] };

    if (field === 'biomarkerId') {
      const catalogItem = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === val);
      if (catalogItem) {
        const isFemale = selectedProfile?.gender === 'Female';
        row.biomarkerId = catalogItem.biomarkerId;
        row.name = catalogItem.name;
        row.category = catalogItem.category;
        row.loincCode = catalogItem.code;
        row.unit = catalogItem.standardUnit;
        row.refLow = isFemale ? catalogItem.refLowFemale : catalogItem.refLowMale;
        row.refHigh = isFemale ? catalogItem.refHighFemale : catalogItem.refHighMale;
        row.isValid = true;
        row.validationErrors = [];
      }
    } else if (field === 'parsedValue') {
      row.parsedValue = Number(val);
    } else if (field === 'unit') {
      row.unit = String(val);
    } else if (field === 'refLow') {
      row.refLow = Number(val);
    } else if (field === 'refHigh') {
      row.refHigh = Number(val);
    }

    // Re-evaluate clinical status
    const catalogItem = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === row.biomarkerId);
    const evalRes = evaluateBiomarkerStatus(
      row.parsedValue,
      row.refLow,
      row.refHigh,
      catalogItem?.criticalLow,
      catalogItem?.criticalHigh
    );
    row.status = evalRes.status;

    updated[index] = row;
    setValidationRows(updated);
  };

  const handleDeleteValidationRow = (index: number) => {
    setValidationRows(validationRows.filter((_, i) => i !== index));
  };

  const handleAddNewRow = () => {
    const isFemale = selectedProfile?.gender === 'Female';
    const defaultCatalog = MASTER_BIOMARKER_CATALOG[0];
    const newRow: CsvValidationRow = {
      rowIndex: validationRows.length + 1,
      rawText: 'Manual addition',
      rawName: defaultCatalog.name,
      rawValue: '0',
      biomarkerId: defaultCatalog.biomarkerId,
      name: defaultCatalog.name,
      category: defaultCatalog.category,
      loincCode: defaultCatalog.code,
      parsedValue: 0,
      unit: defaultCatalog.standardUnit,
      standardCatalogUnit: defaultCatalog.standardUnit,
      unitConverted: false,
      refLow: isFemale ? defaultCatalog.refLowFemale : defaultCatalog.refLowMale,
      refHigh: isFemale ? defaultCatalog.refHighFemale : defaultCatalog.refHighMale,
      status: 'Normal',
      isValid: true,
      validationErrors: [],
      validationWarnings: [],
    };
    setValidationRows([...validationRows, newRow]);
  };

  // -------------------------------------------------------------------------
  // INJECT VALIDATED ROWS INTO DATABASE
  // -------------------------------------------------------------------------
  const handleCommitCsvToDatabase = () => {
    const validRows = validationRows.filter((r) => r.isValid && !isNaN(r.parsedValue));
    if (validRows.length === 0 || !selectedProfile) return;

    const sessionId = `sess-${Date.now().toString(36)}`;
    const results: BiomarkerResult[] = validRows.map((item, idx) => ({
      resultId: `res-${sessionId}-${idx + 1}`,
      sessionId,
      biomarkerId: item.biomarkerId,
      resultValue: item.parsedValue,
      unitMeasured: item.unit,
      refLow: item.refLow,
      refHigh: item.refHigh,
      status: item.status,
      flag: item.status !== 'Normal' ? (item.status.includes('High') ? 'H' : 'L') : undefined,
      notes: item.conversionNote || undefined,
    }));

    // Auto-calculate derived clinical metrics & alerts
    const derived = computeDerivedMetrics(sessionId, results, selectedProfile);
    const alerts = generateAlertsForSession(sessionId, selectedProfile.profileId, results);

    const newSession: TestSession = {
      sessionId,
      profileId: selectedProfile.profileId,
      labId,
      collectionDate,
      fastingHours,
      reportFile: uploadedFileName || 'Imported_Past_Results.csv',
      notes,
      orderingPhysician: doctorName,
      status: 'Verified',
      results,
      derivedMetrics: derived,
      createdDate: new Date().toISOString(),
    };

    onSessionCommitted(newSession, alerts);
    setCommittedSuccess(true);
    setLastCommittedSessionId(sessionId);
    setLastCommittedDerivedCount(derived.length);
    setLastCommittedAlertsCount(alerts.length);
  };

  // -------------------------------------------------------------------------
  // SIMULATED OCR PIPELINE (LEGACY SAMPLE HANDLER)
  // -------------------------------------------------------------------------
  const handleSimulateEtl = (sample: (typeof sampleReports)[0]) => {
    setFile({
      name: sample.fileName,
      size: '284 KB',
      type: sample.fileName.split('.').pop()?.toUpperCase() || 'FILE',
    });
    setLabId(sample.labId);
    setCollectionDate(sample.date);
    setIsProcessing(true);
    setEtlStep(1);
    setCommittedSuccess(false);

    setTimeout(() => {
      setEtlStep(2);
      setTimeout(() => {
        setEtlStep(3);
        setTimeout(() => {
          setEtlStep(4);
          setTimeout(() => {
            setEtlStep(5);
            setIsProcessing(false);

            const isFemale = selectedProfile?.gender === 'Female';
            const staged: CsvValidationRow[] = sample.data.map((item, idx) => {
              const cat = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === item.id);
              const refLow = isFemale ? cat?.refLowFemale || 0 : cat?.refLowMale || 0;
              const refHigh = isFemale ? cat?.refHighFemale || 100 : cat?.refHighMale || 100;
              const evalRes = evaluateBiomarkerStatus(
                item.val,
                refLow,
                refHigh,
                cat?.criticalLow,
                cat?.criticalHigh
              );

              return {
                rowIndex: idx + 1,
                rawText: `${cat?.name || item.id}: ${item.val} ${item.unit}`,
                rawName: cat?.name || item.id,
                rawValue: String(item.val),
                biomarkerId: item.id,
                name: cat?.name || item.id,
                category: cat?.category || 'General',
                loincCode: cat?.code || 'N/A',
                parsedValue: item.val,
                unit: item.unit,
                standardCatalogUnit: cat?.standardUnit || item.unit,
                unitConverted: false,
                refLow,
                refHigh,
                status: evalRes.status,
                isValid: true,
                validationErrors: [],
                validationWarnings: [],
              };
            });

            setValidationRows(staged);
            setIsCsvParsed(true);
          }, 350);
        }, 350);
      }, 350);
    }, 350);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const validRowsCount = validationRows.filter((r) => r.isValid).length;
  const unitWarningCount = validationRows.filter((r) => r.unitConverted || r.validationWarnings.length > 0).length;
  const invalidRowsCount = validationRows.filter((r) => !r.isValid).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
              <UploadCloud className="w-4 h-4" />
              <span>Laboratory Ingestion & ETL Automation Engine</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Laboratory Results Ingestion & CSV ETL
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Parse historical blood test results from CSV or clinical documents. The engine performs automatic LOINC catalog entity mapping, unit validation with SI conversion, sex-specific reference range verification, and automated derived ratio calculation for SQLite injection.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadCsvTemplate}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Download standardized CSV template with past results format"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download CSV Template</span>
            </button>
          </div>
        </div>

        {/* Ingestion Mode Segmented Navigation */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIngestionMode('csv-parser')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              ingestionMode === 'csv-parser'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CSV Ingestion & Validation Parser</span>
          </button>

          <button
            onClick={() => setIngestionMode('simulated-ocr')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              ingestionMode === 'simulated-ocr'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>1-Click Laboratory OCR Samples</span>
          </button>

          <button
            onClick={() => setIngestionMode('realtime-polling')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              ingestionMode === 'realtime-polling'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Real-Time API Polling (LIS Feed)</span>
            {pollingState.pendingItems.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold font-mono">
                +{pollingState.pendingItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setIngestionMode('schema-guide')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              ingestionMode === 'schema-guide'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <TableIcon className="w-4 h-4" />
            <span>SQLite Tables & CSV Format Guide</span>
          </button>
        </div>
      </div>

      {/* Target Patient & Session Metadata Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Target Session Metadata & Clinician Context</span>
          </h2>
          <span className="text-2xs text-slate-500 font-medium">
            Assigned to {selectedProfile.firstName} {selectedProfile.lastName} ({selectedProfile.gender}, {selectedProfile.mrn})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Target Patient Profile</label>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-slate-900 focus:outline-none cursor-pointer"
            >
              {profiles.map((p) => (
                <option key={p.profileId} value={p.profileId}>
                  {p.firstName} {p.lastName} ({p.mrn}) – {p.gender}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Laboratory Facility</label>
            <select
              value={labId}
              onChange={(e) => setLabId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-slate-900 focus:outline-none cursor-pointer"
            >
              {labs.map((l) => (
                <option key={l.labId} value={l.labId}>
                  {l.labName} ({l.accreditation.split('&')[0]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Collection / Draw Date</label>
            <input
              type="date"
              value={collectionDate}
              onChange={(e) => setCollectionDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-slate-900 focus:outline-none font-mono"
            >
            </input>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Fasting Duration (Hours)</label>
            <input
              type="number"
              min="0"
              max="48"
              value={fastingHours}
              onChange={(e) => setFastingHours(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-slate-900 focus:outline-none font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Ordering Physician</label>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="e.g. Dr. Rebecca Martinez, MD"
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">Clinical Indication / Diagnosis Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Annual metabolic health panel & iron monitoring"
              className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-slate-900 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODE 1: CSV INGESTION & VALIDATION ENGINE                             */}
      {/* ===================================================================== */}
      {ingestionMode === 'csv-parser' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* File Dropzone */}
            <div className="lg:col-span-6 space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleCsvDrop}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center bg-white transition-colors cursor-pointer group"
                onClick={() => document.getElementById('csv-file-input')?.click()}
              >
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Upload CSV File from your Laptop
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Drag and drop your historical blood test CSV file here or click to browse.
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-md group-hover:bg-blue-100 transition-colors">
                  <span>Browse .CSV File</span>
                </div>
              </div>

              {uploadedFileName && (
                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-900">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-blue-600" />
                    <span>Loaded: <strong className="font-mono">{uploadedFileName}</strong></span>
                  </div>
                  <button
                    onClick={handleLoadSampleCsv}
                    className="text-2xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    Reload Sample
                  </button>
                </div>
              )}
            </div>

            {/* Direct Paste CSV Text Area */}
            <div className="lg:col-span-6 space-y-3">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Or Paste CSV Text Directly
                    </h3>
                    <p className="text-2xs text-slate-500">
                      Copy rows from Excel, Apple Numbers, or Google Sheets and paste here.
                    </p>
                  </div>
                  <button
                    onClick={handleLoadSampleCsv}
                    className="px-2.5 py-1 text-2xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Load Sample Past CSV</span>
                  </button>
                </div>

                <textarea
                  value={csvRawText}
                  onChange={(e) => {
                    setCsvRawText(e.target.value);
                    if (e.target.value.trim().length > 10) {
                      executeCsvParse(e.target.value, 'pasted_results.csv');
                    }
                  }}
                  placeholder={`biomarker,value,unit,ref_low,ref_high\nFasting Blood Glucose,96,mg/dL,70,99\nHbA1c,5.6,%,4.0,5.6\nTotal Cholesterol,192,mg/dL,125,200\nLDL Cholesterol,98,mg/dL,50,100\nHDL Cholesterol,56,mg/dL,50,90\nTriglycerides,122,mg/dL,40,150\nhs-CRP,0.8,mg/L,0.1,3.0`}
                  rows={6}
                  className="w-full p-2.5 font-mono text-2xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                />

                <div className="flex items-center justify-between text-2xs text-slate-500">
                  <span>Supports comma, tab, or semicolon delimiters with optional headers.</span>
                  {csvRawText && (
                    <button
                      onClick={() => executeCsvParse(csvRawText, 'pasted_results.csv')}
                      className="font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
                    >
                      Re-parse Text
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Validation Matrix & Summary Banner */}
          {validationErrors.length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>CSV Ingestion Warning</span>
              </div>
              {validationErrors.map((err, i) => (
                <div key={i} className="text-rose-700 pl-6">• {err}</div>
              ))}
            </div>
          )}

          {isCsvParsed && validationRows.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
              {/* Validation Status Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-2xs text-slate-500 font-medium">Rows Parsed</div>
                  <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                    {validationRows.length}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="text-2xs text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Catalog Mapped</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-900 mt-0.5">
                    {validRowsCount} / {validationRows.length}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-2xs text-amber-700 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Unit Harmonized</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-amber-900 mt-0.5">
                    {unitWarningCount}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-2xs text-slate-500 font-medium">Patient Biological Ref</div>
                  <div className="text-xs font-semibold text-slate-800 mt-1">
                    {selectedProfile.gender} ({selectedProfile.dob})
                  </div>
                </div>
              </div>

              {/* Table Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Validated Biomarker Extraction Matrix ({validRowsCount} Ready)
                  </h3>
                  <p className="text-2xs text-slate-500">
                    Verify mapped analytes, standard reference intervals, and clinical status flags before SQLite injection.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddNewRow}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                    <span>Add Analyte</span>
                  </button>

                  <button
                    onClick={handleCommitCsvToDatabase}
                    disabled={committedSuccess || validRowsCount === 0}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer ${
                      committedSuccess
                        ? 'bg-emerald-600 text-white cursor-default'
                        : validRowsCount === 0
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-blue-700 hover:bg-blue-800 text-white'
                    }`}
                  >
                    {committedSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Injected to SQLite</span>
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        <span>Inject Validated Results to SQLite</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Staged Data Table */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Analyte & LOINC</th>
                      <th className="py-2.5 px-3 font-semibold">Category</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Measured Value</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Standard Ref Interval</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Validation / Notes</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationRows.map((item, idx) => {
                      const isNormal = item.status === 'Normal';
                      const isCrit = item.status.includes('Critical');

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50/60 transition-colors ${
                            !item.isValid ? 'bg-rose-50/40' : item.unitConverted ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          {/* Biomarker Selector */}
                          <td className="py-2.5 px-3 font-medium text-slate-900 max-w-[220px]">
                            <select
                              value={item.biomarkerId}
                              onChange={(e) => handleUpdateValidationRow(idx, 'biomarkerId', e.target.value)}
                              className="w-full bg-transparent border-b border-dashed border-slate-300 hover:border-blue-500 py-0.5 text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
                            >
                              {MASTER_BIOMARKER_CATALOG.map((cat) => (
                                <option key={cat.biomarkerId} value={cat.biomarkerId}>
                                  {cat.name} ({cat.standardUnit})
                                </option>
                              ))}
                            </select>
                            <div className="text-3xs text-slate-400 font-mono mt-0.5">
                              LOINC: {item.loincCode} · Raw: "{item.rawName}"
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-2.5 px-3 text-2xs text-slate-500">
                            {item.category}
                          </td>

                          {/* Measured Value */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <input
                                type="number"
                                step="0.01"
                                value={item.parsedValue}
                                onChange={(e) => handleUpdateValidationRow(idx, 'parsedValue', e.target.value)}
                                className="w-20 px-1.5 py-0.5 border border-slate-300 rounded text-right font-semibold text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) => handleUpdateValidationRow(idx, 'unit', e.target.value)}
                                className="w-16 px-1 py-0.5 text-2xs text-slate-500 font-sans border border-transparent hover:border-slate-300 rounded text-center"
                                title="Unit of measurement"
                              />
                            </div>
                          </td>

                          {/* Reference Interval */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-2xs text-slate-600">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={item.refLow}
                                onChange={(e) => handleUpdateValidationRow(idx, 'refLow', e.target.value)}
                                className="w-14 px-1 py-0.5 border border-slate-200 rounded text-right text-3xs"
                              />
                              <span>–</span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.refHigh}
                                onChange={(e) => handleUpdateValidationRow(idx, 'refHigh', e.target.value)}
                                className="w-14 px-1 py-0.5 border border-slate-200 rounded text-right text-3xs"
                              />
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`text-2xs font-semibold px-2 py-0.5 rounded-full inline-block ${
                                isCrit
                                  ? 'bg-rose-100 text-rose-800'
                                  : isNormal
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>

                          {/* Validation Notes */}
                          <td className="py-2.5 px-3 text-center text-3xs">
                            {item.unitConverted ? (
                              <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium" title={item.conversionNote}>
                                Unit converted
                              </span>
                            ) : item.validationErrors.length > 0 ? (
                              <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 font-medium">
                                {item.validationErrors[0]}
                              </span>
                            ) : (
                              <span className="text-emerald-700 flex items-center justify-center gap-0.5">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>LOINC Valid</span>
                              </span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => handleDeleteValidationRow(idx)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                              title="Delete row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Commit Confirmation Banner */}
              {committedSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-900">
                  <div className="flex items-center gap-2 font-bold text-emerald-950">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Historical Blood Test Results Successfully Injected into SQLite!</span>
                  </div>
                  <p className="text-emerald-800 text-2xs leading-relaxed pl-7">
                    Created session <code className="font-mono bg-emerald-100/80 px-1 py-0.5 rounded text-emerald-900">{lastCommittedSessionId}</code> in table <code className="font-mono bg-emerald-100/80 px-1 py-0.5 rounded text-emerald-900">test_sessions</code>. Injected {validRowsCount} rows into <code className="font-mono bg-emerald-100/80 px-1 py-0.5 rounded text-emerald-900">biomarker_results</code>, computed {lastCommittedDerivedCount} longitudinal ratios into <code className="font-mono bg-emerald-100/80 px-1 py-0.5 rounded text-emerald-900">derived_metrics</code> (including eGFR CKD-EPI, Total Chol/HDL ratio, Atherogenic Index, De Ritis AST/ALT ratio), and logged {lastCommittedAlertsCount} alerts to table <code className="font-mono bg-emerald-100/80 px-1 py-0.5 rounded text-emerald-900">alerts</code>.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 2: SIMULATED OCR PIPELINE (LEGACY SAMPLES)                       */}
      {/* ===================================================================== */}
      {ingestionMode === 'simulated-ocr' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCsvDrop}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-8 text-center bg-white transition-colors cursor-pointer group"
              onClick={() => handleSimulateEtl(sampleReports[0])}
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Simulate Clinical Laboratory Document OCR
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Select from standard laboratory templates below or click here to test Quest Diagnostics CMP & Lipid Panel.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors">
                <span>Run Quest Diagnostics Sample Pipeline</span>
              </div>
            </div>

            {/* ETL Pipeline Tracker */}
            {(isProcessing || etlStep > 0) && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                  <span className="font-bold text-slate-900">Power Automate ETL Processing Pipeline</span>
                  <span className="font-mono text-2xs text-slate-500">
                    {file?.name} ({file?.size})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-2xs">
                  {[
                    { step: 1, label: '1. Ingestion', desc: 'MIME & Size' },
                    { step: 2, label: '2. OCR Extract', desc: 'Table Parsed' },
                    { step: 3, label: '3. Catalog Map', desc: 'LOINC Matched' },
                    { step: 4, label: '4. Validate', desc: 'Units & Range' },
                    { step: 5, label: '5. Derived Metrics', desc: 'Calculations Done' },
                  ].map((s) => (
                    <div
                      key={s.step}
                      className={`p-2 rounded-md border text-center transition-colors ${
                        etlStep >= s.step
                          ? 'border-emerald-300 bg-emerald-50/70 text-emerald-900'
                          : isProcessing && etlStep === s.step - 1
                          ? 'border-blue-300 bg-blue-50/60 text-blue-900 animate-pulse'
                          : 'border-slate-200 bg-slate-50 text-slate-400'
                      }`}
                    >
                      <div className="font-bold">{s.label}</div>
                      <div className="text-3xs text-slate-500">{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 space-y-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Accredited Laboratory Templates
                </h3>
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <p className="text-2xs text-slate-500 leading-snug">
                Simulate multi-panel ingestion with calibrated clinical references:
              </p>

              <div className="space-y-2">
                {sampleReports.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSimulateEtl(sample)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all text-left flex items-start justify-between group cursor-pointer"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-700">
                        {sample.title}
                      </div>
                      <div className="text-2xs text-slate-500 flex items-center gap-1 font-mono">
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span>{sample.fileName}</span>
                        <span>·</span>
                        <span>{sample.data.length} analytes</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all mt-1" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 3: REAL-TIME API POLLING (LIS INBOUND FEED)                      */}
      {/* ===================================================================== */}
      {ingestionMode === 'realtime-polling' && (
        <div className="space-y-6">
          {/* Real-Time Status & Gateway Controls */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    {pollingState.isPolling ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-400"></span>
                    )}
                  </span>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Laboratory Information System (LIS) Real-Time API Poller
                  </h2>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                    HL7 v2.5 / FHIR R4 Inbound Gateway
                  </span>
                </div>
                <p className="text-xs text-slate-600 max-w-2xl">
                  Automated background polling checks accredited diagnostic pathology endpoints for newly verified patient examination sessions and streams them directly into the local SQLite database.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    setIsManualChecking(true);
                    await pollNow(profileId);
                    setIsManualChecking(false);
                  }}
                  disabled={isManualChecking}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 font-semibold border border-slate-300 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer text-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isManualChecking ? 'animate-spin' : ''}`} />
                  <span>{isManualChecking ? 'Checking...' : 'Check Feed Now'}</span>
                </button>

                <button
                  onClick={() => togglePolling()}
                  className={`px-3.5 py-2 font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer text-xs ${
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
              </div>
            </div>

            {/* Quick Metrics & Configuration Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="text-slate-500 font-medium">Feed Scanning Status:</div>
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      pollingState.isPolling ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  ></span>
                  <span>{pollingState.isPolling ? 'Active Polling' : 'Suspended'}</span>
                  {pollingState.isPolling && (
                    <span className="text-slate-500 font-mono text-[11px] font-normal">
                      (in {pollingState.nextPollSeconds}s)
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="text-slate-500 font-medium">Polling Interval:</div>
                <div className="flex items-center gap-1.5">
                  {[5, 10, 20, 60].map((s) => (
                    <button
                      key={s}
                      onClick={() => setIntervalSeconds(s)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer ${
                        pollingState.intervalSeconds === s
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="text-slate-500 font-medium">Direct Ingestion:</div>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900">
                  <input
                    type="checkbox"
                    checked={pollingState.autoCommit}
                    onChange={(e) => setAutoCommit(e.target.checked)}
                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>{pollingState.autoCommit ? 'Direct SQLite Commit' : 'Manual Review'}</span>
                </label>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="text-slate-500 font-medium">Inbound Queue:</div>
                <div className="font-bold text-slate-900 font-mono flex items-center justify-between">
                  <span>{pollingState.pendingItems.length} Pending Tests</span>
                  <button
                    onClick={() => setSoundNotification(!pollingState.soundNotification)}
                    className="text-slate-500 hover:text-slate-800 cursor-pointer"
                    title={pollingState.soundNotification ? 'Sound active' : 'Sound muted'}
                  >
                    {pollingState.soundNotification ? (
                      <Volume2 className="w-3.5 h-3.5 text-slate-700" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Test & Simulation Suite */}
          <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 border border-blue-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Simulate Real-Time Incoming Laboratory Sessions</span>
                </h3>
                <p className="text-xs text-slate-600">
                  Trigger an automated mock inbound HL7 ORU_R01 message for{' '}
                  <strong>
                    {selectedProfile.firstName} {selectedProfile.lastName}
                  </strong>{' '}
                  to test background discovery, reference interval evaluation, and automated SQLite persistence:
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={async () => {
                    setIsSimulatingFeed(true);
                    await simulateIncomingResult('routine', profileId, labId);
                    setIsSimulatingFeed(false);
                  }}
                  disabled={isSimulatingFeed}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-300 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 text-blue-600" />
                  <span>+ Routine Metabolic Panel (Quest)</span>
                </button>

                <button
                  onClick={async () => {
                    setIsSimulatingFeed(true);
                    await simulateIncomingResult('cardiac-inflammatory', profileId, labId);
                    setIsSimulatingFeed(false);
                  }}
                  disabled={isSimulatingFeed}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-white hover:bg-amber-50 border border-amber-300 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>+ Cardiac & CRP Flare (Labcorp)</span>
                </button>

                <button
                  onClick={async () => {
                    setIsSimulatingFeed(true);
                    await simulateIncomingResult('hepatic-flare', profileId, labId);
                    setIsSimulatingFeed(false);
                  }}
                  disabled={isSimulatingFeed}
                  className="px-3 py-1.5 text-xs font-semibold text-teal-800 bg-white hover:bg-teal-50 border border-teal-300 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Building2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>+ Hepatic / Ferritin (Mayo Clinic)</span>
                </button>

                <button
                  onClick={async () => {
                    setIsSimulatingFeed(true);
                    await simulateIncomingResult('cbc-infection-panic', profileId, labId);
                    setIsSimulatingFeed(false);
                  }}
                  disabled={isSimulatingFeed}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-800 bg-white hover:bg-rose-50 border border-rose-300 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>+ STAT Critical Panic (WBC 15.6)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pending Ingestion Queue Container */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Pending Lab Sessions Inbound Queue ({pollingState.pendingItems.length})
                </h3>
              </div>

              {pollingState.pendingItems.length > 1 && (
                <button
                  onClick={() => commitAllPending()}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Commit All ({pollingState.pendingItems.length}) to SQLite</span>
                </button>
              )}
            </div>

            {pollingState.pendingItems.length === 0 ? (
              <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Radio className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-pulse" />
                <div className="text-xs font-bold text-slate-800">All Inbound Feeds Synchronized</div>
                <p className="text-2xs text-slate-500 max-w-sm mx-auto mt-1">
                  No new diagnostic sessions waiting. The background poller is scanning every {pollingState.intervalSeconds}s. Trigger a simulation above or click &quot;Check Feed Now&quot; to test.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pollingState.pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                      item.urgency === 'Panic/Stat'
                        ? 'border-rose-300 bg-rose-50/20'
                        : item.urgency === 'Priority'
                        ? 'border-amber-300 bg-amber-50/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
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
                        <span className="text-xs font-mono text-slate-500">Accession #{item.accessionNumber}</span>
                      </div>

                      <div className="text-xs text-slate-600 font-medium">{item.summaryDescription}</div>

                      <div className="flex flex-wrap items-center gap-3 text-2xs text-slate-500">
                        <span>{item.sourceLab}</span>
                        <span className="text-slate-300">|</span>
                        <span>Date: {item.collectionDate}</span>
                        <span className="text-slate-300">|</span>
                        <span>{item.session.results.length} Biomarkers</span>
                        {item.alerts.length > 0 && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className="font-semibold text-rose-700">
                              {item.alerts.length} Alert{item.alerts.length > 1 ? 's' : ''} Generated
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => dismissPendingItem(item.id)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                      >
                        Dismiss
                      </button>

                      <button
                        onClick={() => {
                          commitPendingItem(item.id);
                          onSessionCommitted(item.session, item.alerts);
                        }}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Direct Ingest to SQLite</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real-Time Audit Log Terminal */}
          <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 shadow-2xs space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-400 text-2xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-bold text-slate-200">LIS MLLP / HTTP Polling Console</span>
              </div>
              <span>Latest 50 events</span>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1 text-slate-300 text-2xs">
              {pollingState.auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 py-0.5">
                  <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span
                    className={`font-bold uppercase px-1 rounded-xs ${
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
                  <span className="text-slate-300">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODE 4: SQLITE SCHEMA & CSV FORMAT GUIDE                              */}
      {/* ===================================================================== */}
      {ingestionMode === 'schema-guide' && (
        <div className="space-y-6">
          {/* Overview Callout */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-5 text-xs text-blue-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-blue-900">
              <Database className="w-4 h-4 text-blue-700" />
              <span>How Past Blood Test CSVs are Mapped to SQLite</span>
            </div>
            <p className="text-blue-800 leading-relaxed text-xs">
              When updating your local SQLite database (<code className="font-mono bg-blue-100 px-1 py-0.5 rounded text-blue-900">hemametric.sqlite</code>), laboratory data is structured into a relational architecture. You do not just insert into a single flat table: a blood draw creates a <strong>test session</strong>, which contains individual <strong>biomarker results</strong>, generates <strong>derived metrics</strong>, and logs <strong>clinical alerts</strong>.
            </p>
          </div>

          {/* SQLite Relational Architecture Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Table 1: test_sessions */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <h3 className="font-mono font-bold text-slate-900 text-xs">test_sessions (Parent)</h3>
                </div>
                <span className="text-3xs font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">1 row per draw</span>
              </div>
              <p className="text-2xs text-slate-600">
                Represents the blood draw encounter. Links to <code className="font-mono text-slate-700">patient_profiles</code> and <code className="font-mono text-slate-700">laboratories</code>.
              </p>
              <div className="p-2.5 bg-slate-50 rounded-lg text-3xs font-mono text-slate-700 space-y-1">
                <div><strong>session_id</strong> TEXT PRIMARY KEY (e.g. 'sess-2026-q3')</div>
                <div><strong>profile_id</strong> TEXT REFERENCES patient_profiles</div>
                <div><strong>lab_id</strong> TEXT REFERENCES laboratories</div>
                <div><strong>collection_date</strong> TEXT (YYYY-MM-DD)</div>
                <div><strong>fasting_hours</strong> REAL (e.g. 12.0)</div>
                <div><strong>ordering_physician</strong> TEXT</div>
                <div><strong>notes</strong> TEXT (diagnosis / observations)</div>
                <div><strong>status</strong> TEXT ('Verified')</div>
              </div>
            </div>

            {/* Table 2: biomarker_results */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  <h3 className="font-mono font-bold text-slate-900 text-xs">biomarker_results (Primary Data)</h3>
                </div>
                <span className="text-3xs font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">1 row per analyte</span>
              </div>
              <p className="text-2xs text-slate-600">
                Stores measured laboratory concentrations. Foreign key links to <code className="font-mono text-slate-700">test_sessions.session_id</code>.
              </p>
              <div className="p-2.5 bg-slate-50 rounded-lg text-3xs font-mono text-slate-700 space-y-1">
                <div><strong>result_id</strong> TEXT PRIMARY KEY (e.g. 'res-101')</div>
                <div><strong>session_id</strong> TEXT REFERENCES test_sessions(session_id)</div>
                <div><strong>biomarker_id</strong> TEXT (e.g. 'bm-glu', 'bm-crp')</div>
                <div><strong>result_value</strong> REAL (e.g. 96.0, 1.2)</div>
                <div><strong>unit_measured</strong> TEXT (e.g. 'mg/dL', 'mg/L')</div>
                <div><strong>ref_low</strong> REAL, <strong>ref_high</strong> REAL</div>
                <div><strong>status</strong> TEXT ('Normal', 'High', 'Critical')</div>
                <div><strong>flag</strong> TEXT ('H', 'L')</div>
              </div>
            </div>

            {/* Table 3: derived_metrics */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                  <h3 className="font-mono font-bold text-slate-900 text-xs">derived_metrics (Calculated)</h3>
                </div>
                <span className="text-3xs font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">Auto-computed</span>
              </div>
              <p className="text-2xs text-slate-600">
                Automated clinical formulas: eGFR CKD-EPI, Total Chol/HDL ratio, Atherogenic Index, FIB-4, De Ritis AST/ALT.
              </p>
              <div className="p-2.5 bg-slate-50 rounded-lg text-3xs font-mono text-slate-700 space-y-1">
                <div><strong>metric_id</strong> TEXT PRIMARY KEY</div>
                <div><strong>session_id</strong> TEXT REFERENCES test_sessions</div>
                <div><strong>metric_name</strong> TEXT ('eGFR', 'Chol/HDL Ratio')</div>
                <div><strong>metric_value</strong> REAL (e.g. 98.4, 3.4)</div>
                <div><strong>unit</strong> TEXT ('mL/min/1.73m²', 'Ratio')</div>
                <div><strong>status</strong> TEXT ('Optimal', 'Borderline', 'High Risk')</div>
              </div>
            </div>

            {/* Table 4: alerts */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  <h3 className="font-mono font-bold text-slate-900 text-xs">alerts (Surveillance)</h3>
                </div>
                <span className="text-3xs font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">Critical triggers</span>
              </div>
              <p className="text-2xs text-slate-600">
                Generated whenever an analyte breaches critical safety thresholds (e.g. hs-CRP &gt; 10 mg/L or Glucose &gt; 250 mg/dL).
              </p>
              <div className="p-2.5 bg-slate-50 rounded-lg text-3xs font-mono text-slate-700 space-y-1">
                <div><strong>alert_id</strong> TEXT PRIMARY KEY</div>
                <div><strong>profile_id</strong> TEXT, <strong>session_id</strong> TEXT</div>
                <div><strong>severity</strong> TEXT ('Critical', 'Warning')</div>
                <div><strong>biomarker_name</strong> TEXT, <strong>message</strong> TEXT</div>
                <div><strong>acknowledged</strong> INTEGER (0 or 1)</div>
              </div>
            </div>
          </div>

          {/* Recommended CSV Format Specification */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Recommended CSV Header & Formatting Standard
                </h3>
                <p className="text-2xs text-slate-500">
                  Format your past results CSV with these column headers for 100% automated parsing:
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(SAMPLE_LONGITUDINAL_CSV, 'csv-sample')}
                  className="px-2.5 py-1 text-2xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3 text-slate-500" />
                  <span>{copiedSection === 'csv-sample' ? 'Copied!' : 'Copy Sample CSV'}</span>
                </button>
                <button
                  onClick={downloadCsvTemplate}
                  className="px-2.5 py-1 text-2xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3 text-blue-600" />
                  <span>Download .CSV</span>
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden text-2xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Column Name</th>
                    <th className="py-2 px-3">Required?</th>
                    <th className="py-2 px-3">Allowed Aliases</th>
                    <th className="py-2 px-3">Example Values</th>
                    <th className="py-2 px-3">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-blue-700">biomarker</td>
                    <td className="py-2 px-3 text-emerald-700 font-bold">Yes</td>
                    <td className="py-2 px-3 font-mono text-slate-600">biomarker_id, analyte, test_name, marker, name</td>
                    <td className="py-2 px-3 font-mono text-slate-800">Fasting Blood Glucose, hs-CRP, HbA1c, LDL</td>
                    <td className="py-2 px-3 text-slate-600">Matched to LOINC master catalog.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono font-bold text-blue-700">value</td>
                    <td className="py-2 px-3 text-emerald-700 font-bold">Yes</td>
                    <td className="py-2 px-3 font-mono text-slate-600">result, result_value, val, numeric</td>
                    <td className="py-2 px-3 font-mono text-slate-800">96, 5.6, 1.25, 192</td>
                    <td className="py-2 px-3 text-slate-600">Numeric test reading.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-slate-700">unit</td>
                    <td className="py-2 px-3 text-slate-500">Optional</td>
                    <td className="py-2 px-3 font-mono text-slate-600">units, unit_measured, uom</td>
                    <td className="py-2 px-3 font-mono text-slate-800">mg/dL, %, g/dL, mg/L, ×10³/µL</td>
                    <td className="py-2 px-3 text-slate-600">Auto-converted if in SI mmol/L.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-slate-700">ref_low</td>
                    <td className="py-2 px-3 text-slate-500">Optional</td>
                    <td className="py-2 px-3 font-mono text-slate-600">reference_low, min, low</td>
                    <td className="py-2 px-3 font-mono text-slate-800">70, 4.0, 125, 0.59</td>
                    <td className="py-2 px-3 text-slate-600">Defaults to patient biological interval if empty.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-slate-700">ref_high</td>
                    <td className="py-2 px-3 text-slate-500">Optional</td>
                    <td className="py-2 px-3 font-mono text-slate-600">reference_high, max, high</td>
                    <td className="py-2 px-3 font-mono text-slate-800">99, 5.6, 200, 1.04</td>
                    <td className="py-2 px-3 text-slate-600">Defaults to patient biological interval if empty.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-mono text-slate-700">notes</td>
                    <td className="py-2 px-3 text-slate-500">Optional</td>
                    <td className="py-2 px-3 font-mono text-slate-600">comment, flag, indication</td>
                    <td className="py-2 px-3 font-mono text-slate-800">Fasting 12h, Post-exercise</td>
                    <td className="py-2 px-3 text-slate-600">Clinical contextual annotation.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-2xs overflow-x-auto">
{SAMPLE_LONGITUDINAL_CSV}
            </pre>
          </div>

          {/* Direct SQL Injection Query Sample */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Direct SQLite Command-Line Injection Example
            </h3>
            <p className="text-2xs text-slate-600">
              If inserting directly via the <code className="font-mono text-slate-700">sqlite3 hemametric.sqlite</code> terminal CLI, execute in this order to satisfy foreign key constraints:
            </p>

            <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg font-mono text-2xs overflow-x-auto leading-relaxed">
{`-- Step 1: Insert Parent Test Session
INSERT INTO test_sessions (session_id, profile_id, lab_id, collection_date, fasting_hours, ordering_physician, notes, status, created_date)
VALUES ('sess-2026-past', 'pat-eleanor-01', 'lab-quest-01', '2026-03-15', 12.0, 'Dr. Martinez', 'Historical baseline', 'Verified', datetime('now'));

-- Step 2: Insert Individual Analyte Rows
INSERT INTO biomarker_results (result_id, session_id, biomarker_id, result_value, unit_measured, ref_low, ref_high, status)
VALUES 
  ('res-p1', 'sess-2026-past', 'bm-glu', 94.0, 'mg/dL', 70.0, 99.0, 'Normal'),
  ('res-p2', 'sess-2026-past', 'bm-hba1c', 5.5, '%', 4.0, 5.6, 'Normal'),
  ('res-p3', 'sess-2026-past', 'bm-chol', 188.0, 'mg/dL', 125.0, 200.0, 'Normal'),
  ('res-p4', 'sess-2026-past', 'bm-ldl', 92.0, 'mg/dL', 50.0, 100.0, 'Normal'),
  ('res-p5', 'sess-2026-past', 'bm-hdl', 58.0, 'mg/dL', 50.0, 90.0, 'Normal'),
  ('res-p6', 'sess-2026-past', 'bm-crp', 0.9, 'mg/L', 0.1, 3.0, 'Normal');`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

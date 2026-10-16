import React, { useState, useRef, useMemo } from 'react';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  Info,
  Radio,
  Activity,
  Database,
  Cpu,
  BrainCircuit,
  FileCode2,
  TrendingUp,
  Table2,
  BarChart3,
  Bell,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Cloud,
} from 'lucide-react';

export type VisioStencilType =
  | 'process'
  | 'database'
  | 'cloud'
  | 'queue'
  | 'ai'
  | 'ui'
  | 'decision';

export interface ArchitectureNode {
  id: string;
  label: string;
  subtitle: string;
  category: 'ingestion' | 'ui' | 'engines' | 'storage' | 'enterprise';
  categoryLabel: string;
  stencil: VisioStencilType;
  x: number;
  y: number;
  width: number;
  height: number;
  file?: string;
  icon: string;
  description: string;
  features: string[];
  inputs: string[];
  outputs: string[];
  connections: string[]; // target node IDs
}

export interface ArchitectureConnector {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  path: string; // SVG path command
  color?: string;
}

// Complete Visio Model of current app features
const ARCHITECTURE_NODES: ArchitectureNode[] = [
  // SWIMLANE 1: EXTERNAL INGESTION & REAL-TIME POLLING
  {
    id: 'node-ext-labs',
    label: 'External Lab LIS Endpoints',
    subtitle: 'Quest, LabCorp, Mayo Clinic',
    category: 'ingestion',
    categoryLabel: 'Ingestion & Polling Bus',
    stencil: 'cloud',
    x: 40,
    y: 80,
    width: 200,
    height: 80,
    icon: 'cloud',
    description: 'External diagnostic hospital laboratories and LIS feeds producing HL7 v2, FHIR JSON, and laboratory result PDFs.',
    features: ['HL7 v2.5.1 MLLP & FHIR R4 API standards', 'Simulated lab endpoint responder', 'Multi-laboratory coverage'],
    inputs: ['Physician lab orders', 'Blood specimen collection'],
    outputs: ['HL7 Observation bundles', 'JSON diagnostic payloads'],
    connections: ['node-polling-svc'],
  },
  {
    id: 'node-polling-svc',
    label: 'Real-Time Lab Polling Service',
    subtitle: 'labPollingService.ts (Background Loop)',
    category: 'ingestion',
    categoryLabel: 'Ingestion & Polling Bus',
    stencil: 'process',
    x: 290,
    y: 80,
    width: 220,
    height: 80,
    file: 'src/services/labPollingService.ts',
    icon: 'radio',
    description: 'Background worker running configurable 15s to 120s polling cycles to retrieve newly finalized blood test sessions.',
    features: ['Configurable interval (15s/30s/60s/120s)', 'Auto-ingestion toggle switch', 'Idempotent deduplication hashing', 'Heartbeat telemetry counters'],
    inputs: ['External LIS feeds', 'Polling timer tick'],
    outputs: ['Dispatched incoming sessions', 'Network telemetry stats'],
    connections: ['node-staging-buffer', 'node-polling-modal'],
  },
  {
    id: 'node-staging-buffer',
    label: 'Incoming Staging Buffer',
    subtitle: 'Queue Deduplication & Review',
    category: 'ingestion',
    categoryLabel: 'Ingestion & Polling Bus',
    stencil: 'queue',
    x: 560,
    y: 80,
    width: 200,
    height: 80,
    file: 'src/services/labPollingService.ts',
    icon: 'layers',
    description: 'In-memory staging buffer that protects primary patient history from uncontrolled data ingress, enabling physician review before merging.',
    features: ['Session hash collision detection', 'Manual approval & discard queue', 'Batch auto-merge processor'],
    inputs: ['Unverified test sessions'],
    outputs: ['Approved TestSession entities'],
    connections: ['node-storage-svc'],
  },
  {
    id: 'node-csv-parser',
    label: 'File & CSV Parser Service',
    subtitle: 'csvParserService.ts',
    category: 'ingestion',
    categoryLabel: 'Ingestion & Polling Bus',
    stencil: 'process',
    x: 810,
    y: 80,
    width: 210,
    height: 80,
    file: 'src/services/csvParserService.ts',
    icon: 'file',
    description: 'Multi-format laboratory file ingestion engine parsing CSV, Excel, and structured clinical exports.',
    features: ['Fuzzy column header matching', 'Unit harmonization (mg/dL vs mmol/L)', 'Catalog code alignment', 'Validation exception logs'],
    inputs: ['Uploaded .csv, .txt, .xlsx files'],
    outputs: ['Normalized BiomarkerResult[] objects'],
    connections: ['node-storage-svc'],
  },

  // SWIMLANE 2: PRESENTATION & CLINICAL UI (REACT SPA)
  {
    id: 'node-app-router',
    label: 'App Shell & Context Bus',
    subtitle: 'App.tsx & Navigation.tsx',
    category: 'ui',
    categoryLabel: 'Client Presentation Layer',
    stencil: 'ui',
    x: 40,
    y: 220,
    width: 220,
    height: 90,
    file: 'src/App.tsx',
    icon: 'activity',
    description: 'Top-level React router and active patient context coordinator managing state, navigation tabs, and modal triggers.',
    features: ['3-Zone clinical navigation bar', 'Active patient switcher with MRN/DOB context', 'Pulsing LIS radar badge', 'Global reset & sample data seeds'],
    inputs: ['User clicks', 'Active patient selection', 'Incoming lab notifications'],
    outputs: ['Selected patient sessions', 'Tab routing states'],
    connections: ['node-session-details', 'node-trend-screen', 'node-diff-screen', 'node-predictive-screen', 'node-powerbi-screen', 'node-alerts-screen'],
  },
  {
    id: 'node-session-details',
    label: 'Session Details & Analytes Table',
    subtitle: 'SessionDetailsScreen.tsx',
    category: 'ui',
    categoryLabel: 'Client Presentation Layer',
    stencil: 'ui',
    x: 310,
    y: 220,
    width: 220,
    height: 90,
    file: 'src/components/SessionDetailsScreen.tsx',
    icon: 'table',
    description: 'High-density laboratory analyte report table with reference interval gauges, rich consultation notes, and derived ratio cards.',
    features: ['Presentation views (Both, Gauge, Table)', 'Integrated 6-Month Sparkline column', 'Derived clinical ratio panels', 'Biometric biological age widget', 'Rich Markdown consultation editor'],
    inputs: ['Active TestSession', 'Historical allSessions[]'],
    outputs: ['Consultation notes', 'Biomarker drilldowns'],
    connections: ['node-sparkline', 'node-calc-engine', 'node-bioage-engine'],
  },
  {
    id: 'node-sparkline',
    label: 'Biomarker Sparkline Engine',
    subtitle: 'BiomarkerSparkline.tsx (6M/12M/All)',
    category: 'ui',
    categoryLabel: 'Client Presentation Layer',
    stencil: 'ui',
    x: 580,
    y: 220,
    width: 220,
    height: 90,
    file: 'src/components/BiomarkerSparkline.tsx',
    icon: 'sparkline',
    description: 'Embedded SVG micro-chart visualizing chronological longitudinal biomarker trajectory directly within each table row.',
    features: ['Adaptive 6-month & 12-month horizon filter', 'Reference range guide corridor', 'Interactive hover tooltip with test date/delta', 'Shift & velocity directional badges'],
    inputs: ['Analyte history', 'Reference thresholds', 'Collection dates'],
    outputs: ['Rendered SVG sparklines', 'Delta percentage pills'],
    connections: ['node-trend-screen'],
  },
  {
    id: 'node-ai-summary-card',
    label: 'Patient Trend AI Summary',
    subtitle: 'PatientTrendAiSummary.tsx',
    category: 'ui',
    categoryLabel: 'Client Presentation Layer',
    stencil: 'ai',
    x: 850,
    y: 220,
    width: 220,
    height: 90,
    file: 'src/components/PatientTrendAiSummary.tsx',
    icon: 'brain',
    description: 'AI-powered component that generates natural language summaries of multi-session blood trends highlighting significant biomarker shifts.',
    features: ['Significant shift detector (>15% / status flips)', 'Automated clinical bulleted insights', 'Evidence-based lifestyle & clinical recommendations', 'Heuristic fallback & Gemini LLM engine'],
    inputs: ['Longitudinal test sessions', 'Patient clinical conditions'],
    outputs: ['Executive narrative summary', 'Risk notifications'],
    connections: ['node-ai-service'],
  },

  // SECOND ROW OF PRESENTATION UI
  {
    id: 'node-trend-screen',
    label: 'Longitudinal Trend Analytics',
    subtitle: 'TrendAnalysisScreen.tsx',
    category: 'ui',
    categoryLabel: 'Client Presentation Layer',
    stencil: 'ui',
    x: 40,
    y: 350,
    width: 220,
    height: 80,
    file: 'src/components/TrendAnalysisScreen.tsx',
    icon: 'trending',
    description: 'Multi-session longitudinal charting studio supporting 60+ biomarkers across lipid, metabolic, CBC, and endocrine panels.',
    features: ['Chronological area & line trajectories', 'Statistical min, max, average, and variance', 'Panel filtering', 'Clinical reference corridor'],
    inputs: ['Patient historical sessions'],
    outputs: ['Interactive time-series charts'],
    connections: ['node-storage-svc'],
  },
  {
    id: 'node-diff-screen',
    label: 'Differentials Matrix',
    subtitle: 'BiomarkerComparisonScreen.tsx',
    category: 'ui',
    categoryLabel: 'Client Presentation Layer',
    stencil: 'ui',
    x: 310,
    y: 350,
    width: 220,
    height: 80,
    file: 'src/components/BiomarkerComparisonScreen.tsx',
    icon: 'table',
    description: 'Side-by-side session comparison matrix calculating absolute delta, percentage changes, and status transitions.',
    features: ['Session-to-session comparative delta', 'Status flip highlighting (e.g. Normal -> High)', 'Top volatile biomarker ranking'],
    inputs: ['Baseline session', 'Comparison session'],
    outputs: ['Differential delta calculations'],
    connections: ['node-storage-svc'],
  },
  {
    id: 'node-predictive-screen',
    label: 'Predictive Analytics Studio',
    subtitle: 'PredictiveAnalyticsScreen.tsx',
    category: 'ui',
    categoryLabel: 'Client Presentation Layer',
    stencil: 'ui',
    x: 580,
    y: 350,
    width: 220,
    height: 80,
    file: 'src/components/PredictiveAnalyticsScreen.tsx',
    icon: 'brain',
    description: 'Proactive clinical forecasting studio predicting future biomarker values 12 months ahead with multi-domain organ risk models.',
    features: ['12-Month linear regression curves', 'Cardiometabolic risk gauge', 'FIB-4 Hepatic Steatosis score', 'Chronic inflammation burden', 'Preventative clinical action protocols'],
    inputs: ['Longitudinal biomarker series'],
    outputs: ['Projected trajectories', 'Stratified risk scores'],
    connections: ['node-predictive-engine'],
  },
  {
    id: 'node-powerbi-screen',
    label: 'Power BI Hub & DAX Studio',
    subtitle: 'PowerBiAnalyticsScreen.tsx',
    category: 'ui',
    categoryLabel: 'Client Presentation Layer',
    stencil: 'ui',
    x: 850,
    y: 350,
    width: 220,
    height: 80,
    file: 'src/components/PowerBiAnalyticsScreen.tsx',
    icon: 'chart',
    description: 'Enterprise Power BI report emulator featuring Key Influencer visuals, Decomposition Tree, and DAX query inspection.',
    features: ['Population health KPI cards', 'Interactive cross-filtering', 'Clinical DAX measure generator', 'Exportable DAX formulas'],
    inputs: ['Normalized fact tables'],
    outputs: ['Visual analytics', 'DAX calculations'],
    connections: ['node-storage-svc'],
  },

  // SWIMLANE 3: CLINICAL ENGINES & ALGORITHMS
  {
    id: 'node-calc-engine',
    label: 'Biomarker Calculation Engine',
    subtitle: 'calculationEngine.ts',
    category: 'engines',
    categoryLabel: 'Business Logic & Engines',
    stencil: 'process',
    x: 40,
    y: 490,
    width: 220,
    height: 85,
    file: 'src/services/calculationEngine.ts',
    icon: 'cpu',
    description: 'Clinical calculation engine deriving mathematical blood indices: Total/HDL, Trig/HDL, De Ritis (AST/ALT), BUN/Cr, HOMA-IR, and eGFR CKD-EPI 2021.',
    features: ['Deterministic mathematical algorithms', 'Automatic missing analyte detection', 'Target range interpretations', 'Standardized medical units'],
    inputs: ['Raw laboratory biomarker results'],
    outputs: ['Derived clinical metrics'],
    connections: ['node-storage-svc'],
  },
  {
    id: 'node-bioage-engine',
    label: 'Biometric Age Engine',
    subtitle: 'biometricAgeEngine.ts',
    category: 'engines',
    categoryLabel: 'Business Logic & Engines',
    stencil: 'process',
    x: 310,
    y: 490,
    width: 220,
    height: 85,
    file: 'src/services/biometricAgeEngine.ts',
    icon: 'activity',
    description: 'Multi-system biological age algorithm utilizing 9 key biomarkers (Albumin, Creatinine, Glucose, hs-CRP, Lymph %, MCV, RDW, Alk Phos).',
    features: ['PhenoAge regression coefficients', 'Chronological vs biological age delta', 'Organ decay risk vectors', 'Reversibility potential index'],
    inputs: ['Metabolic & hematologic panel results', 'Patient chronological age'],
    outputs: ['Biological age estimation', 'Organ acceleration metrics'],
    connections: ['node-storage-svc'],
  },
  {
    id: 'node-predictive-engine',
    label: 'Predictive Trajectory Engine',
    subtitle: 'predictiveEngine.ts (OLS & FIB-4)',
    category: 'engines',
    categoryLabel: 'Business Logic & Engines',
    stencil: 'process',
    x: 580,
    y: 490,
    width: 220,
    height: 85,
    file: 'src/services/predictiveEngine.ts',
    icon: 'brain',
    description: 'Time-series ordinary least squares (OLS) linear regressions projecting biomarker trajectories and calculating organ risk scores.',
    features: ['Slope velocity (dY/dt)', '12-Month projected values (y = mt + b)', 'FIB-4 Liver Fibrosis stratification', 'eGFR loss rate assessment'],
    inputs: ['Multi-date biomarker values'],
    outputs: ['Future values', 'Confidence boundaries', 'Risk classifications'],
    connections: ['node-predictive-screen'],
  },
  {
    id: 'node-ai-service',
    label: 'AI Trend Summary Engine',
    subtitle: 'aiTrendService.ts (LLM + Heuristics)',
    category: 'engines',
    categoryLabel: 'Business Logic & Engines',
    stencil: 'ai',
    x: 850,
    y: 490,
    width: 220,
    height: 85,
    file: 'src/services/aiTrendService.ts',
    icon: 'sparkles',
    description: 'Clinical narrative generator combining rule-based clinical shift detection with generative AI capabilities for natural language summaries.',
    features: ['Significant velocity & delta thresholding', 'Cardiovascular & metabolic pattern grouping', 'Deterministic fallback engine', 'Gemini generative prompt pipeline'],
    inputs: ['Chronological session records', 'Master catalog references'],
    outputs: ['Structured markdown clinical summaries'],
    connections: ['node-ai-summary-card'],
  },

  // SWIMLANE 4: DATA STORAGE & MASTER CATALOG
  {
    id: 'node-storage-svc',
    label: 'Client Storage Service',
    subtitle: 'storageService.ts (Persistent Store)',
    category: 'storage',
    categoryLabel: 'Persistence & Catalog Layer',
    stencil: 'database',
    x: 170,
    y: 630,
    width: 230,
    height: 85,
    file: 'src/services/storageService.ts',
    icon: 'database',
    description: 'Unified storage abstraction managing LocalStorage persistence, auto-hydration from clinical seed datasets, and schema migrations.',
    features: ['JSON document persistence', 'CRUD operations for Sessions & Profiles', 'Atomic reset to clinical sample data', 'Fast in-memory caching'],
    inputs: ['Raw payloads', 'Clinical notes', 'Ingested sessions'],
    outputs: ['Hydrated session arrays', 'Patient records'],
    connections: ['node-catalog', 'node-sqlite-engine', 'node-alert-engine'],
  },
  {
    id: 'node-catalog',
    label: 'Master Biomarker Catalog',
    subtitle: 'seedData.ts (LOINC Mapped)',
    category: 'storage',
    categoryLabel: 'Persistence & Catalog Layer',
    stencil: 'database',
    x: 460,
    y: 630,
    width: 230,
    height: 85,
    file: 'src/data/seedData.ts',
    icon: 'database',
    description: 'Central clinical dictionary defining 60+ blood biomarkers across 8 panels with standard LOINC codes, units, and reference thresholds.',
    features: ['LOINC code bindings', 'Biological normal intervals (RefLow / RefHigh)', 'Critical triage thresholds', 'Category taxonomy'],
    inputs: ['Medical reference standards'],
    outputs: ['Master analyte catalog metadata'],
    connections: ['node-calc-engine', 'node-csv-parser'],
  },
  {
    id: 'node-sqlite-engine',
    label: 'SQLite Database & SQL Explorer',
    subtitle: 'SqliteDatabaseModal.tsx (sql.js)',
    category: 'storage',
    categoryLabel: 'Persistence & Catalog Layer',
    stencil: 'database',
    x: 740,
    y: 630,
    width: 230,
    height: 85,
    file: 'src/components/SqliteDatabaseModal.tsx',
    icon: 'database',
    description: 'In-browser relational SQLite engine providing SQL queries, DDL schema inspection, and laptop deployment scripts.',
    features: ['Relational schema introspection', 'Interactive SQL query executor', 'Table record counters', 'Migration DDL generation'],
    inputs: ['SQL queries', 'Normalized tables'],
    outputs: ['SQL result sets', 'Schema exports'],
    connections: ['node-storage-svc'],
  },

  // SWIMLANE 5: ENTERPRISE NOTIFICATION & INTEGRATION
  {
    id: 'node-alert-engine',
    label: 'Clinical Alert Rules Engine',
    subtitle: 'AlertsScreen.tsx & Evaluator',
    category: 'enterprise',
    categoryLabel: 'Alerts & Enterprise Services',
    stencil: 'decision',
    x: 300,
    y: 765,
    width: 230,
    height: 80,
    file: 'src/components/AlertsScreen.tsx',
    icon: 'bell',
    description: 'Clinical safety rules engine scanning for critical low/high laboratory values and high-velocity shifts (>40%) across sessions.',
    features: ['Multi-tier severity (Critical, Warning, Info)', 'Acknowledgment and triage workflows', 'Urgent clinician escalation links'],
    inputs: ['Latest BiomarkerResult[]', 'Historical baseline values'],
    outputs: ['Active alert badges', 'Escalation events'],
    connections: ['node-alerts-screen'],
  },
  {
    id: 'node-alerts-screen',
    label: 'Clinical Alerts Hub UI',
    subtitle: 'Central Notification Center',
    category: 'ui',
    categoryLabel: 'Client Presentation Layer',
    stencil: 'ui',
    x: 60,
    y: 765,
    width: 190,
    height: 80,
    file: 'src/components/AlertsScreen.tsx',
    icon: 'bell',
    description: 'Physician alert triage center displaying flagged clinical deviations with one-click navigation to patient session history.',
    features: ['Filter by severity', 'Dismiss and resolve actions', 'Direct navigation to offending session'],
    inputs: ['Active alerts'],
    outputs: ['Physician triage status'],
    connections: [],
  },
  {
    id: 'node-polling-modal',
    label: 'LIS Polling Monitor Modal',
    subtitle: 'LabPollingModal.tsx',
    category: 'ingestion',
    categoryLabel: 'Ingestion & Polling Bus',
    stencil: 'ui',
    x: 600,
    y: 765,
    width: 200,
    height: 80,
    file: 'src/components/LabPollingModal.tsx',
    icon: 'radio',
    description: 'Diagnostic operations control panel displaying background polling status, queue inspection, and manual payload inject triggers.',
    features: ['Live polling heartbeat ticker', 'Simulated lab inject buttons', 'Queue payload inspector', 'Immediate merge & discard triggers'],
    inputs: ['Polling state', 'Staging queue'],
    outputs: ['Polling configurations', 'Ingested sessions'],
    connections: ['node-polling-svc'],
  },
  {
    id: 'node-confluence-cloud',
    label: 'Power Platform & Dataverse',
    subtitle: 'Power Automate & Confluence Spec',
    category: 'enterprise',
    categoryLabel: 'Alerts & Enterprise Services',
    stencil: 'cloud',
    x: 850,
    y: 765,
    width: 220,
    height: 80,
    file: 'src/components/SolutionDocModal.tsx',
    icon: 'cloud',
    description: 'Target enterprise architecture mapping to Microsoft Dataverse entities, Power Automate OCR flows, and Confluence specifications.',
    features: ['Dataverse Table-per-Entity schema', 'Power Automate Document Intelligence flow', 'HIPAA BAA & compliance framework'],
    inputs: ['Enterprise sync payloads'],
    outputs: ['Cloud audit records', 'Confluence documentation'],
    connections: [],
  },
];

// Orthogonal Visio Connectors between nodes
const ARCHITECTURE_CONNECTORS: ArchitectureConnector[] = [
  // Ingestion to Polling Service
  {
    id: 'conn-1',
    sourceId: 'node-ext-labs',
    targetId: 'node-polling-svc',
    label: 'HL7 MLLP / JSON',
    path: 'M 240,120 L 290,120',
  },
  // Poller to Staging Buffer
  {
    id: 'conn-2',
    sourceId: 'node-polling-svc',
    targetId: 'node-staging-buffer',
    label: 'Incoming Payload',
    path: 'M 510,120 L 560,120',
  },
  // Staging Buffer to Storage
  {
    id: 'conn-3',
    sourceId: 'node-staging-buffer',
    targetId: 'node-storage-svc',
    label: 'Approve & Merge',
    path: 'M 660,160 L 660,190 L 285,190 L 285,630',
  },
  // CSV Parser to Storage
  {
    id: 'conn-4',
    sourceId: 'node-csv-parser',
    targetId: 'node-storage-svc',
    label: 'Parsed Biomarkers',
    path: 'M 915,160 L 915,200 L 320,200 L 320,630',
  },
  // Storage to App Router
  {
    id: 'conn-5',
    sourceId: 'node-storage-svc',
    targetId: 'node-app-router',
    label: 'Hydrated Patient State',
    path: 'M 170,670 L 20,670 L 20,265 L 40,265',
  },
  // App Router to Session Details
  {
    id: 'conn-6',
    sourceId: 'node-app-router',
    targetId: 'node-session-details',
    label: 'Active Session',
    path: 'M 260,265 L 310,265',
  },
  // Session Details to Sparkline
  {
    id: 'conn-7',
    sourceId: 'node-session-details',
    targetId: 'node-sparkline',
    label: '6M History',
    path: 'M 530,265 L 580,265',
  },
  // Sparklines / Session to AI Summary
  {
    id: 'conn-8',
    sourceId: 'node-sparkline',
    targetId: 'node-ai-summary-card',
    label: 'Biomarker Deltas',
    path: 'M 800,265 L 850,265',
  },
  // Session Details down to Calculation Engine
  {
    id: 'conn-9',
    sourceId: 'node-session-details',
    targetId: 'node-calc-engine',
    label: 'Raw Results',
    path: 'M 420,310 L 420,460 L 150,460 L 150,490',
  },
  // Session Details to Biometric Age Engine
  {
    id: 'conn-10',
    sourceId: 'node-session-details',
    targetId: 'node-bioage-engine',
    label: 'Metabolic & CBC',
    path: 'M 420,310 L 420,490',
  },
  // Predictive Studio to Predictive Engine
  {
    id: 'conn-11',
    sourceId: 'node-predictive-screen',
    targetId: 'node-predictive-engine',
    label: 'Time-Series Data',
    path: 'M 690,430 L 690,490',
  },
  // AI Summary Card to AI Service
  {
    id: 'conn-12',
    sourceId: 'node-ai-summary-card',
    targetId: 'node-ai-service',
    label: 'Prompt & Shift Vectors',
    path: 'M 960,310 L 960,490',
  },
  // Storage to Master Catalog
  {
    id: 'conn-13',
    sourceId: 'node-storage-svc',
    targetId: 'node-catalog',
    label: 'LOINC Reference Specs',
    path: 'M 400,672 L 460,672',
  },
  // Storage to SQLite Engine
  {
    id: 'conn-14',
    sourceId: 'node-storage-svc',
    targetId: 'node-sqlite-engine',
    label: 'Relational DDL & SQL',
    path: 'M 400,690 L 740,690',
  },
  // Storage to Alert Rules Engine
  {
    id: 'conn-15',
    sourceId: 'node-storage-svc',
    targetId: 'node-alert-engine',
    label: 'Evaluate Thresholds',
    path: 'M 285,715 L 285,745 L 415,745 L 415,765',
  },
  // Alert Rules Engine to Alerts Screen
  {
    id: 'conn-16',
    sourceId: 'node-alert-engine',
    targetId: 'node-alerts-screen',
    label: 'Trigger Notifications',
    path: 'M 300,805 L 250,805',
  },
  // Poller to Polling Modal
  {
    id: 'conn-17',
    sourceId: 'node-polling-svc',
    targetId: 'node-polling-modal',
    label: 'Telemetry & Feed',
    path: 'M 400,160 L 400,740 L 700,740 L 700,765',
  },
];

export const VisioArchitectureDiagram: React.FC = () => {
  const [zoom, setZoom] = useState<number>(0.95);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 20, y: 10 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-sparkline');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showAnimatedFlow, setShowAnimatedFlow] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [copiedJSON, setCopiedJSON] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return ARCHITECTURE_NODES.filter((node) => {
      const matchesCategory =
        activeCategory === 'all' || node.category === activeCategory;
      const matchesQuery =
        !searchQuery ||
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.file && node.file.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, searchQuery]);

  const selectedNode = ARCHITECTURE_NODES.find((n) => n.id === selectedNodeId);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag when clicking the canvas background
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'visio-canvas-bg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setZoom(0.95);
    setPan({ x: 20, y: 10 });
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(ARCHITECTURE_NODES, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  const handleExportSVG = () => {
    const svgEl = document.getElementById('visio-architecture-svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'HemaMetric-Visio-Architecture.svg';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };

  // Helper to render icon by name
  const renderIcon = (name: string, className = 'w-4 h-4') => {
    switch (name) {
      case 'radio':
        return <Radio className={className} />;
      case 'cloud':
        return <Cloud className={className} />;
      case 'database':
        return <Database className={className} />;
      case 'cpu':
        return <Cpu className={className} />;
      case 'brain':
        return <BrainCircuit className={className} />;
      case 'sparkles':
        return <Sparkles className={className} />;
      case 'table':
        return <Table2 className={className} />;
      case 'sparkline':
      case 'trending':
        return <TrendingUp className={className} />;
      case 'chart':
        return <BarChart3 className={className} />;
      case 'bell':
        return <Bell className={className} />;
      case 'file':
        return <FileCode2 className={className} />;
      default:
        return <Activity className={className} />;
    }
  };

  // Get color styles for Visio stencils
  const getStencilTheme = (stencil: VisioStencilType, isSelected: boolean) => {
    if (isSelected) {
      return {
        fill: '#f0f9ff',
        stroke: '#0284c7',
        headerBg: 'bg-sky-600 text-white',
        ring: 'ring-2 ring-sky-500 shadow-md',
      };
    }
    switch (stencil) {
      case 'cloud':
        return {
          fill: '#f8fafc',
          stroke: '#64748b',
          headerBg: 'bg-slate-700 text-white',
          ring: 'border-slate-300',
        };
      case 'process':
        return {
          fill: '#eff6ff',
          stroke: '#2563eb',
          headerBg: 'bg-blue-600 text-white',
          ring: 'border-blue-200',
        };
      case 'database':
        return {
          fill: '#fdf4ff',
          stroke: '#c026d3',
          headerBg: 'bg-fuchsia-700 text-white',
          ring: 'border-fuchsia-200',
        };
      case 'ai':
        return {
          fill: '#faf5ff',
          stroke: '#7e22ce',
          headerBg: 'bg-purple-700 text-white',
          ring: 'border-purple-200',
        };
      case 'queue':
        return {
          fill: '#fffbeb',
          stroke: '#d97706',
          headerBg: 'bg-amber-600 text-white',
          ring: 'border-amber-200',
        };
      case 'decision':
        return {
          fill: '#fff1f2',
          stroke: '#e11d48',
          headerBg: 'bg-rose-600 text-white',
          ring: 'border-rose-200',
        };
      case 'ui':
      default:
        return {
          fill: '#f0fdf4',
          stroke: '#16a34a',
          headerBg: 'bg-emerald-700 text-white',
          ring: 'border-emerald-200',
        };
    }
  };

  return (
    <div className="flex flex-col h-[780px] bg-slate-100 rounded-xl border border-slate-200 overflow-hidden select-none">
      {/* Visio Top Toolbar */}
      <div className="bg-slate-900 text-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shadow-xs z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 text-xs">
            <Layers className="w-4 h-4 text-sky-400" />
            <span className="font-bold tracking-wide">Visio Studio: Architecture Topology</span>
            <span className="text-2xs font-mono text-slate-400 bg-slate-700 px-1.5 py-0.2 rounded">v2.4</span>
          </div>

          {/* Category Filter Pills */}
          <div className="hidden lg:flex items-center gap-1 text-xs">
            {[
              { id: 'all', label: 'All Stencils' },
              { id: 'ingestion', label: 'Ingestion & LIS' },
              { id: 'ui', label: 'Presentation UI' },
              { id: 'engines', label: 'Calculations & AI' },
              { id: 'storage', label: 'Storage & DB' },
              { id: 'enterprise', label: 'Alerts & Cloud' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-md text-2xs font-medium transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-sky-500 text-white font-bold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Viewport & Action Controls */}
        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search components, LOINC, sparkline..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 w-44 sm:w-56"
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-slate-800 rounded-md border border-slate-700 p-0.5 text-xs">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              title="Zoom Out"
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-2xs text-sky-400">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}
              title="Zoom In"
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetView}
              title="Reset View"
              className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded border-l border-slate-700 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Toggle Flow Animation */}
          <button
            onClick={() => setShowAnimatedFlow(!showAnimatedFlow)}
            title="Toggle Animated Data Flow Packets"
            className={`px-2 py-1 text-2xs rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
              showAnimatedFlow
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span className="hidden sm:inline">Flow Pulse</span>
          </button>

          {/* Export buttons */}
          <button
            onClick={handleExportSVG}
            title="Export Visio Diagram as SVG"
            className="px-2.5 py-1 text-2xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-md flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Export SVG</span>
          </button>
        </div>
      </div>

      {/* Main Workspace (Canvas + Inspector Panel) */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Canvas Area */}
        <div
          ref={containerRef}
          id="visio-canvas-bg"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`flex-1 relative overflow-hidden bg-slate-50 cursor-grab ${
            isDragging ? 'cursor-grabbing' : ''
          }`}
          style={{
            backgroundImage: showGrid
              ? 'radial-gradient(#cbd5e1 1px, transparent 1px)'
              : 'none',
            backgroundSize: '20px 20px',
            backgroundColor: '#f8fafc',
          }}
        >
          {/* Visio Canvas SVG Container */}
          <svg
            id="visio-architecture-svg"
            className="w-full h-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
            viewBox="0 0 1120 900"
            width="1120"
            height="900"
          >
            <defs>
              {/* Arrowhead marker */}
              <marker
                id="visio-arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#0284c7" />
              </marker>

              {/* Subtle Drop Shadows */}
              <filter id="visio-shadow" x="-5%" y="-5%" width="110%" height="115%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.08" />
              </filter>
              <filter id="visio-shadow-active" x="-10%" y="-10%" width="120%" height="125%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0284c7" floodOpacity="0.3" />
              </filter>
            </defs>

            {/* SWIMLANE CONTAINERS & BACKGROUND PANELS */}
            {/* Lane 1: External Diagnostics */}
            <rect
              x="20"
              y="40"
              width="1060"
              height="140"
              rx="8"
              fill="#f1f5f9"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            <text x="35" y="65" fill="#475569" fontSize="11" fontWeight="700" letterSpacing="0.05em">
              SWIMLANE 1: EXTERNAL DIAGNOSTIC SOURCES & REAL-TIME POLLING BUS
            </text>

            {/* Lane 2: Presentation Tier (React SPA) */}
            <rect
              x="20"
              y="190"
              width="1060"
              height="260"
              rx="8"
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            <text x="35" y="212" fill="#0369a1" fontSize="11" fontWeight="700" letterSpacing="0.05em">
              SWIMLANE 2: CLIENT PRESENTATION TIER (REACT SPA & LONGITUDINAL SPARKLINE COMPONENTS)
            </text>

            {/* Lane 3: Engines & AI */}
            <rect
              x="20"
              y="460"
              width="1060"
              height="135"
              rx="8"
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            <text x="35" y="482" fill="#7e22ce" fontSize="11" fontWeight="700" letterSpacing="0.05em">
              SWIMLANE 3: CLINICAL CALCULATION, PREDICTIVE TRAJECTORY & AI ENGINES
            </text>

            {/* Lane 4: Storage & Schemas */}
            <rect
              x="20"
              y="605"
              width="1060"
              height="130"
              rx="8"
              fill="#fdf4ff"
              stroke="#f0abfc"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            <text x="35" y="625" fill="#a21caf" fontSize="11" fontWeight="700" letterSpacing="0.05em">
              SWIMLANE 4: LOCAL PERSISTENCE, RELATIONAL SQLITE & MASTER BIOMARKER CATALOG
            </text>

            {/* Lane 5: Alerts & Enterprise */}
            <rect
              x="20"
              y="745"
              width="1060"
              height="125"
              rx="8"
              fill="#fff1f2"
              stroke="#fecdd3"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
            <text x="35" y="763" fill="#be123c" fontSize="11" fontWeight="700" letterSpacing="0.05em">
              SWIMLANE 5: CLINICAL ALERTS ESCALATION & POWER PLATFORM / CONFLUENCE BLUEPRINT
            </text>

            {/* ORTHOGONAL CONNECTOR PATHS */}
            {ARCHITECTURE_CONNECTORS.map((connector) => {
              const isConnectedToSelected =
                selectedNode &&
                (connector.sourceId === selectedNode.id ||
                  connector.targetId === selectedNode.id);

              return (
                <g key={connector.id} className="transition-all">
                  {/* Background halo for selection */}
                  {isConnectedToSelected && (
                    <path
                      d={connector.path}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="5"
                      strokeOpacity="0.5"
                    />
                  )}
                  {/* Main Connector Wire */}
                  <path
                    d={connector.path}
                    fill="none"
                    stroke={isConnectedToSelected ? '#0284c7' : '#94a3b8'}
                    strokeWidth={isConnectedToSelected ? '2.5' : '1.5'}
                    markerEnd="url(#visio-arrow)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Optional animated pulse dot */}
                  {showAnimatedFlow && (
                    <circle r="3" fill="#0284c7">
                      <animateMotion
                        path={connector.path}
                        dur="3.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  {/* Connector Wire Label */}
                  {connector.label && (
                    <text
                      fontSize="9"
                      fill="#64748b"
                      fontWeight="600"
                      className="select-none pointer-events-none"
                    >
                      <textPath
                        href={`#${connector.id}-path`}
                        startOffset="50%"
                        textAnchor="middle"
                      >
                        {connector.label}
                      </textPath>
                    </text>
                  )}
                </g>
              );
            })}

            {/* VISIO STENCIL NODES */}
            {filteredNodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const theme = getStencilTheme(node.stencil, isSelected);

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                  className="cursor-pointer group"
                >
                  {/* Visio Stencil Shape Rendering based on type */}
                  {node.stencil === 'database' ? (
                    // 3D Database Cylinder Shape
                    <g filter={isSelected ? 'url(#visio-shadow-active)' : 'url(#visio-shadow)'}>
                      <path
                        d={`M 0,16 
                            A ${node.width / 2},12 0 0,1 ${node.width},16 
                            L ${node.width},${node.height - 12} 
                            A ${node.width / 2},12 0 0,1 0,${node.height - 12} 
                            Z`}
                        fill={theme.fill}
                        stroke={theme.stroke}
                        strokeWidth={isSelected ? '2.5' : '1.5'}
                      />
                      {/* Top ellipse */}
                      <ellipse
                        cx={node.width / 2}
                        cy="16"
                        rx={node.width / 2}
                        ry="12"
                        fill="#fae8ff"
                        stroke={theme.stroke}
                        strokeWidth={isSelected ? '2.5' : '1.5'}
                      />
                      {/* Mid ring */}
                      <path
                        d={`M 0,${node.height / 2} A ${node.width / 2},10 0 0,0 ${node.width},${node.height / 2}`}
                        fill="none"
                        stroke={theme.stroke}
                        strokeWidth="1"
                        strokeDasharray="2,2"
                        opacity="0.6"
                      />
                    </g>
                  ) : node.stencil === 'cloud' ? (
                    // Cloud Stencil Shape
                    <g filter={isSelected ? 'url(#visio-shadow-active)' : 'url(#visio-shadow)'}>
                      <rect
                        x="0"
                        y="0"
                        width={node.width}
                        height={node.height}
                        rx="16"
                        fill={theme.fill}
                        stroke={theme.stroke}
                        strokeWidth={isSelected ? '2.5' : '1.5'}
                      />
                    </g>
                  ) : (
                    // Standard Visio Process / UI / Engine Box
                    <g filter={isSelected ? 'url(#visio-shadow-active)' : 'url(#visio-shadow)'}>
                      <rect
                        x="0"
                        y="0"
                        width={node.width}
                        height={node.height}
                        rx="8"
                        fill={theme.fill}
                        stroke={theme.stroke}
                        strokeWidth={isSelected ? '2.5' : '1.5'}
                      />
                      {/* Accent Header Bar */}
                      <rect
                        x="0"
                        y="0"
                        width={node.width}
                        height="24"
                        rx="8"
                        fill={theme.stroke}
                      />
                      {/* Mask bottom border of header */}
                      <rect
                        x="0"
                        y="16"
                        width={node.width}
                        height="8"
                        fill={theme.stroke}
                      />
                    </g>
                  )}

                  {/* Header text or top label */}
                  {node.stencil !== 'database' && (
                    <text
                      x="10"
                      y="16"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="700"
                      letterSpacing="0.02em"
                    >
                      {node.categoryLabel.toUpperCase()}
                    </text>
                  )}

                  {/* Stencil Icon & Main Label */}
                  <foreignObject
                    x="10"
                    y={node.stencil === 'database' ? '28' : '28'}
                    width={node.width - 20}
                    height={node.height - 32}
                  >
                    <div className="flex flex-col justify-center h-full text-left">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 leading-tight">
                        <span className="text-sky-600 shrink-0">
                          {renderIcon(node.icon, 'w-3.5 h-3.5')}
                        </span>
                        <span className="truncate">{node.label}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                        {node.subtitle}
                      </div>
                    </div>
                  </foreignObject>

                  {/* Connection Anchor Pins (Visio style connection points) */}
                  <circle cx="0" cy={node.height / 2} r="3" fill="#ffffff" stroke={theme.stroke} strokeWidth="1.5" />
                  <circle cx={node.width} cy={node.height / 2} r="3" fill="#ffffff" stroke={theme.stroke} strokeWidth="1.5" />
                  <circle cx={node.width / 2} cy="0" r="3" fill="#ffffff" stroke={theme.stroke} strokeWidth="1.5" />
                  <circle cx={node.width / 2} cy={node.height} r="3" fill="#ffffff" stroke={theme.stroke} strokeWidth="1.5" />
                </g>
              );
            })}
          </svg>

          {/* Quick Stencil Legend on bottom left of canvas */}
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs p-2 rounded-lg border border-slate-200 shadow-sm text-2xs space-y-1 z-10 max-w-xs">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <Info className="w-3 h-3 text-sky-600" />
              <span>Visio Stencil Shapes</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-600 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600"></span>
                <span>Presentation UI</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-blue-600"></span>
                <span>Process / Service</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-purple-600"></span>
                <span>AI & Cognitive</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-fuchsia-600"></span>
                <span>Database Cylinder</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-amber-600"></span>
                <span>Queue / Buffer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-slate-600"></span>
                <span>Cloud Integration</span>
              </div>
            </div>
          </div>
        </div>

        {/* Node Inspector Side Panel (Visio Shape Properties) */}
        {selectedNode ? (
          <div className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg z-20 overflow-y-auto">
            {/* Inspector Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-sky-600 text-white flex items-center justify-center">
                  {renderIcon(selectedNode.icon, 'w-4 h-4')}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 leading-tight">
                    {selectedNode.label}
                  </h3>
                  <div className="text-2xs text-slate-500 font-mono">
                    {selectedNode.categoryLabel}
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-sky-100 text-sky-800 rounded font-mono text-[10px] font-bold">
                {selectedNode.stencil.toUpperCase()}
              </span>
            </div>

            {/* Inspector Details */}
            <div className="p-4 space-y-4 text-xs">
              {/* File / Implementation */}
              {selectedNode.file && (
                <div>
                  <div className="text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Implementation File
                  </div>
                  <div className="px-2 py-1 bg-slate-100 rounded border border-slate-200 font-mono text-2xs text-slate-700 flex items-center justify-between">
                    <span className="truncate">{selectedNode.file}</span>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <div className="text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Architectural Role & Utility
                </div>
                <p className="text-slate-600 leading-relaxed text-2xs">
                  {selectedNode.description}
                </p>
              </div>

              {/* Key Features */}
              <div>
                <div className="text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Key Capabilities
                </div>
                <ul className="space-y-1">
                  {selectedNode.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-2xs text-slate-700">
                      <ChevronRight className="w-3 h-3 text-sky-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Inputs & Outputs Contract */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-600 mb-1">Inputs Contract</div>
                  <ul className="space-y-0.5 text-[10px] text-slate-600">
                    {selectedNode.inputs.map((inp, idx) => (
                      <li key={idx} className="truncate">• {inp}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-600 mb-1">Outputs Contract</div>
                  <ul className="space-y-0.5 text-[10px] text-slate-600">
                    {selectedNode.outputs.map((out, idx) => (
                      <li key={idx} className="truncate">• {out}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Connected Stencils */}
              {selectedNode.connections.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-2xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Downstream Data Pipelines
                  </div>
                  <div className="space-y-1">
                    {selectedNode.connections.map((targetId) => {
                      const target = ARCHITECTURE_NODES.find((n) => n.id === targetId);
                      if (!target) return null;
                      return (
                        <button
                          key={targetId}
                          onClick={() => setSelectedNodeId(target.id)}
                          className="w-full text-left p-1.5 bg-slate-50 hover:bg-sky-50 rounded border border-slate-200 hover:border-sky-300 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {renderIcon(target.icon, 'w-3 h-3 text-slate-500')}
                            <span className="text-2xs font-medium text-slate-800 truncate">
                              {target.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-sky-600 font-mono shrink-0">
                            Inspect →
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Copy Blueprint JSON */}
              <div className="pt-3 border-t border-slate-100">
                <button
                  onClick={handleCopyJSON}
                  className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-2xs font-semibold rounded-md border border-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedJSON ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedJSON ? 'Copied Model JSON' : 'Copy All Stencils JSON'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-80 bg-white border-l border-slate-200 p-6 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
            <Layers className="w-8 h-8 text-slate-300 mb-2" />
            <div className="font-semibold text-slate-700">Select any Visio Stencil</div>
            <div className="text-2xs text-slate-500 mt-1 max-w-[200px]">
              Click any component shape on the canvas to inspect its architectural specifications, algorithms, and data contracts.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Clock,
  UserCheck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  Copy,
  Check,
  Trash2,
  Edit3,
  Calendar,
  Sparkles,
  Tag,
  Stethoscope,
  Share2,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  BookmarkPlus,
  RefreshCw,
  FileDown,
} from 'lucide-react';
import {
  TestSession,
  PatientProfile,
  Laboratory,
  ClinicalObservation,
  ObservationCategory,
  ObservationPriority,
} from '../types/clinical';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';
import {
  getClinicalObservations,
  addClinicalObservation,
  updateClinicalObservation,
  deleteClinicalObservation,
  subscribeToStore,
  updateSessionNotes,
} from '../services/storageService';

interface ClinicalNotesSectionProps {
  session: TestSession;
  profile: PatientProfile;
  laboratory: Laboratory | null;
}

const CLINICAL_AUTHORS = [
  { name: 'Dr. Rebecca Martinez, MD', role: 'Internal Medicine Attending' },
  { name: 'Dr. Sarah Jenkins, MD', role: 'Consulting Hematologist' },
  { name: 'Dr. Marcus Vance, MD', role: 'Cardiometabolic Specialist' },
  { name: 'Dr. Alex Chen, MD', role: 'Clinical Pathologist & Reviewer' },
  { name: 'Elena Rostova, RN, BSN', role: 'Clinical Nurse Coordinator' },
  { name: 'David Miller, PharmD', role: 'Clinical Pharmacist' },
];

const CATEGORIES: { label: ObservationCategory; color: string; bg: string; border: string }[] = [
  {
    label: 'Diagnostic Impression',
    color: 'text-blue-800',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    label: 'Therapeutic Adjustment',
    color: 'text-emerald-800',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    label: 'Biomarker Shift Analysis',
    color: 'text-purple-800',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
  {
    label: 'Follow-up Directive',
    color: 'text-indigo-800',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
  },
  {
    label: 'Patient Consultation',
    color: 'text-teal-800',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
  },
  {
    label: 'Critical Alert & Safety',
    color: 'text-rose-800',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
  },
];

const PRIORITIES: { label: ObservationPriority; color: string; badgeBg: string; icon: any }[] = [
  {
    label: 'Routine',
    color: 'text-slate-700',
    badgeBg: 'bg-slate-100 border-slate-200',
    icon: CheckCircle2,
  },
  {
    label: 'Attention',
    color: 'text-blue-700',
    badgeBg: 'bg-blue-100/70 border-blue-200',
    icon: AlertCircle,
  },
  {
    label: 'High Priority',
    color: 'text-amber-800',
    badgeBg: 'bg-amber-100/80 border-amber-300',
    icon: AlertTriangle,
  },
  {
    label: 'Urgent',
    color: 'text-rose-800',
    badgeBg: 'bg-rose-100 border-rose-300',
    icon: AlertOctagon,
  },
];

export const ClinicalNotesSection: React.FC<ClinicalNotesSectionProps> = ({
  session,
  profile,
  laboratory,
}) => {
  const [observations, setObservations] = useState<ClinicalObservation[]>([]);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [summaryCopied, setSummaryCopied] = useState<boolean>(false);
  const [showFormalSummaryDrawer, setShowFormalSummaryDrawer] = useState<boolean>(false);

  // Form states for adding observation
  const [authorName, setAuthorName] = useState<string>(
    session.orderingPhysician || CLINICAL_AUTHORS[0].name
  );
  const [authorRole, setAuthorRole] = useState<string>(CLINICAL_AUTHORS[0].role);
  const [category, setCategory] = useState<ObservationCategory>('Diagnostic Impression');
  const [priority, setPriority] = useState<ObservationPriority>('Routine');
  const [narrative, setNarrative] = useState<string>('');
  const [selectedBiomarkers, setSelectedBiomarkers] = useState<string[]>([]);
  const [timestampMode, setTimestampMode] = useState<'current' | 'custom'>('current');
  const [customTimestamp, setCustomTimestamp] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<string | null>(null);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNarrative, setEditNarrative] = useState<string>('');
  const [editCategory, setEditCategory] = useState<ObservationCategory>('Diagnostic Impression');
  const [editPriority, setEditPriority] = useState<ObservationPriority>('Routine');

  // Load observations
  const loadObservations = () => {
    const list = getClinicalObservations(session.sessionId);
    setObservations(list);
  };

  useEffect(() => {
    loadObservations();
    const unsubscribe = subscribeToStore(() => {
      loadObservations();
    });
    return () => unsubscribe();
  }, [session.sessionId]);

  // Out of range biomarkers in this session
  const abnormalSessionBiomarkers = useMemo(() => {
    return session.results.filter((r) => r.status !== 'Normal');
  }, [session.results]);

  // Format timestamp helper
  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  // Relative time helper
  const getRelativeTime = (isoString: string) => {
    try {
      const now = new Date().getTime();
      const then = new Date(isoString).getTime();
      const diffSec = Math.floor((now - then) / 1000);

      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      const diffDays = Math.floor(diffSec / 86400);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays}d ago`;
      return formatDateTime(isoString).split(',')[0];
    } catch {
      return '';
    }
  };

  // Toggle biomarker tag
  const toggleBiomarker = (bmId: string) => {
    setSelectedBiomarkers((prev) =>
      prev.includes(bmId) ? prev.filter((id) => id !== bmId) : [...prev, bmId]
    );
  };

  // Quick template inserters
  const insertTemplate = (type: 'soap' | 'abnormal' | 'therapy' | 'followup' | 'critical') => {
    const abnormalNames = abnormalSessionBiomarkers
      .map((r) => {
        const cat = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === r.biomarkerId);
        return `${cat?.name || r.biomarkerId} (${r.resultValue} ${r.unitMeasured} [${r.status}])`;
      })
      .join(', ');

    if (type === 'soap') {
      setCategory('Diagnostic Impression');
      setPriority('Routine');
      setNarrative(
        `SUBJECTIVE: Patient reviewed in follow-up for lab panel drawn on ${session.collectionDate}. Fasting duration verified at ${session.fastingHours} hours.\n\nOBJECTIVE: Evaluated panel results. Primary out-of-range observations: ${abnormalNames || 'No critical analytical excursions recorded'}.\n\nASSESSMENT: Clinical findings reviewed in context of longitudinal history and current medications.\n\nPLAN: Maintain active therapeutic protocol. Re-evaluate targeted analytes at next interval.`
      );
    } else if (type === 'abnormal') {
      setCategory('Biomarker Shift Analysis');
      setPriority(abnormalSessionBiomarkers.some((b) => b.status.includes('Critical')) ? 'High Priority' : 'Attention');
      setNarrative(
        `Analytical correlation of out-of-range biomarkers: ${abnormalNames || 'Isolated borderline fluctuation'}.\n\nUnderlying pathophysiology consistent with active metabolic/inflammatory dynamics. Longitudinal comparison to prior baseline demonstrates notable trend trajectory requiring surveillance.`
      );
      setSelectedBiomarkers(abnormalSessionBiomarkers.map((b) => b.biomarkerId));
    } else if (type === 'therapy') {
      setCategory('Therapeutic Adjustment');
      setPriority('Attention');
      setNarrative(
        `THERAPEUTIC INTERVENTION: Formulated updated regimen adjustments based on current biomarker metrics.\n- Prescribed targeted intervention and dosage titration.\n- Patient counseled on nutrient-medication timing (avoiding conflicting supplements within 2 hours).\n- Hydration and lifestyle adherence emphasized.`
      );
    } else if (type === 'followup') {
      setCategory('Follow-up Directive');
      setPriority('Routine');
      setNarrative(
        `CLINICAL DIRECTIVE: Schedule repeat laboratory assessment in 90 to 120 days. Focus repeat requisition on CBC, metabolic panel, and targeted biomarkers. Secure clinical portal summary transmitted to patient.`
      );
    } else if (type === 'critical') {
      setCategory('Critical Alert & Safety');
      setPriority('Urgent');
      setNarrative(
        `SAFETY & ESCALATION PROTOCOL ACTIVATED: Marked out-of-range threshold crossed in session results: ${abnormalNames}.\nDirect clinical intervention initiated. Urgent clinical follow-up requested with attending specialist.`
      );
      setSelectedBiomarkers(abnormalSessionBiomarkers.map((b) => b.biomarkerId));
    }
  };

  // Handle Save New Observation
  const handleSaveObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!narrative.trim()) return;

    setIsSaving(true);

    const timestampToSave =
      timestampMode === 'custom' && customTimestamp
        ? new Date(customTimestamp).toISOString()
        : new Date().toISOString();

    const newObs = addClinicalObservation(session.sessionId, {
      author: authorName.trim() || 'Clinical Reviewer',
      role: authorRole.trim() || 'Attending Physician',
      category,
      priority,
      narrative: narrative.trim(),
      timestamp: timestampToSave,
      relatedBiomarkers: selectedBiomarkers,
    });

    setTimeout(() => {
      setIsSaving(false);
      setIsAdding(false);
      setNarrative('');
      setSelectedBiomarkers([]);
      setSaveSuccessBanner(`Observation successfully recorded and saved under ${newObs.author}.`);
      setTimeout(() => setSaveSuccessBanner(null), 4000);
      loadObservations();
    }, 200);
  };

  // Start editing observation
  const startEdit = (obs: ClinicalObservation) => {
    setEditingId(obs.id);
    setEditNarrative(obs.narrative);
    setEditCategory(obs.category);
    setEditPriority(obs.priority);
  };

  // Save inline edit
  const handleSaveEdit = (obsId: string) => {
    if (!editNarrative.trim()) return;
    updateClinicalObservation(session.sessionId, obsId, {
      narrative: editNarrative.trim(),
      category: editCategory,
      priority: editPriority,
    });
    setEditingId(null);
    loadObservations();
  };

  // Delete observation
  const handleDelete = (obsId: string) => {
    if (window.confirm('Delete this clinical observation from the session permanent record?')) {
      deleteClinicalObservation(session.sessionId, obsId);
      loadObservations();
    }
  };

  // Copy single note
  const handleCopyNote = (obs: ClinicalObservation) => {
    const text = `[HemaMetric Clinical Observation]\nSession Date: ${session.collectionDate}\nTimestamp: ${formatDateTime(obs.timestamp)}\nAuthor: ${obs.author} (${obs.role || 'Clinician'})\nCategory: ${obs.category} | Priority: ${obs.priority}\n\nObservation:\n${obs.narrative}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(obs.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Copy all notes
  const handleCopyAllNotes = () => {
    if (observations.length === 0) return;
    const header = `=========================================\nHEMAMETRIC CLINICAL OBSERVATIONS RECORD\nPatient: ${profile.firstName} ${profile.lastName} (MRN: ${profile.mrn})\nTest Session Date: ${session.collectionDate}\nFacility: ${laboratory?.labName || 'Clinical Laboratory'}\nOrdering Physician: ${session.orderingPhysician}\nTotal Observations: ${observations.length}\n=========================================\n\n`;

    const body = observations
      .map(
        (o, idx) =>
          `Entry #${idx + 1} | ${formatDateTime(o.timestamp)} (${getRelativeTime(o.timestamp)})\nAuthor: ${o.author} [${o.role || 'Staff'}]\nCategory: ${o.category} | Urgency: ${o.priority}\n${o.narrative}\n-----------------------------------------`
      )
      .join('\n\n');

    navigator.clipboard.writeText(header + body).then(() => {
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 2500);
    });
  };

  // Filter observations
  const filteredObservations = useMemo(() => {
    return observations.filter((o) => {
      const matchesCategory =
        selectedCategoryFilter === 'All' || o.category === selectedCategoryFilter;
      const matchesSearch =
        searchQuery === '' ||
        o.narrative.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.role && o.role.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [observations, selectedCategoryFilter, searchQuery]);

  return (
    <div id="clinical-notes-section" className="space-y-4 scroll-mt-6">
      {/* Main Section Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700">
                <FileText className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-indigo-900 tracking-wide uppercase font-mono">
                Clinical Narrative Documentation
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-indigo-100 text-indigo-800">
                {observations.length} {observations.length === 1 ? 'Observation' : 'Observations'}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Clinical Notes & Narrative Observations
            </h2>
            <p className="text-xs text-slate-500 max-w-2xl">
              Chronological narrative notes, clinical assessments, therapeutic directives, and attending physician observations for examination session <span className="font-mono font-medium text-slate-700">{session.sessionId}</span> ({session.collectionDate}).
            </p>
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              onClick={handleCopyAllNotes}
              disabled={observations.length === 0}
              className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                summaryCopied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
              title="Copy all narrative observations to clipboard"
            >
              {summaryCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied All Notes</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Clinical Record</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsAdding(!isAdding)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>{isAdding ? 'Close Composer' : 'Add Narrative Observation'}</span>
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessBanner && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs font-medium text-emerald-800 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessBanner}</span>
          </div>
        )}

        {/* Add Narrative Observation Composer */}
        {isAdding && (
          <form
            onSubmit={handleSaveObservation}
            className="p-5 bg-gradient-to-b from-indigo-50/40 to-slate-50 border border-indigo-200 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                <Stethoscope className="w-4 h-4 text-indigo-600" />
                <span>New Timestamped Clinical Observation</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Templates Bar */}
            <div className="space-y-1.5">
              <div className="text-2xs font-semibold text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>Insert Standard Clinical Formulation Snippet:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => insertTemplate('soap')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-2xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  + SOAP Framework
                </button>
                <button
                  type="button"
                  onClick={() => insertTemplate('abnormal')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-2xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  + Biomarker Correlation
                </button>
                <button
                  type="button"
                  onClick={() => insertTemplate('therapy')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-2xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  + Therapeutic Adjustment
                </button>
                <button
                  type="button"
                  onClick={() => insertTemplate('followup')}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-2xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  + Follow-up Order
                </button>
                <button
                  type="button"
                  onClick={() => insertTemplate('critical')}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded text-2xs font-medium text-rose-800 transition-colors cursor-pointer"
                >
                  + Critical Safety Alert
                </button>
              </div>
            </div>

            {/* Author, Role, Category, Priority Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">
                  Documenting Clinician
                </label>
                <select
                  value={authorName}
                  onChange={(e) => {
                    setAuthorName(e.target.value);
                    const found = CLINICAL_AUTHORS.find((a) => a.name === e.target.value);
                    if (found) setAuthorRole(found.role);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-indigo-500 cursor-pointer"
                >
                  {CLINICAL_AUTHORS.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <option value={session.orderingPhysician}>
                    {session.orderingPhysician} (Ordering Physician)
                  </option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">
                  Clinical Role / Specialty
                </label>
                <input
                  type="text"
                  value={authorRole}
                  onChange={(e) => setAuthorRole(e.target.value)}
                  placeholder="e.g. Attending Physician"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">
                  Observation Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ObservationCategory)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-indigo-500 cursor-pointer"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.label} value={c.label}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 block">
                  Clinical Urgency / Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ObservationPriority)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-indigo-500 cursor-pointer"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Timestamp Mode Selector */}
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-700">
              <span className="font-semibold text-slate-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>Observation Timestamp:</span>
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="tsMode"
                  checked={timestampMode === 'current'}
                  onChange={() => setTimestampMode('current')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Current Real-Time ({formatDateTime(new Date().toISOString())})</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="tsMode"
                  checked={timestampMode === 'custom'}
                  onChange={() => setTimestampMode('custom')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Specific / Retrospective Timestamp</span>
              </label>
              {timestampMode === 'custom' && (
                <input
                  type="datetime-local"
                  value={customTimestamp}
                  onChange={(e) => setCustomTimestamp(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-mono"
                />
              )}
            </div>

            {/* Tag Session Biomarkers */}
            <div className="space-y-1.5 pt-1">
              <label className="text-2xs font-semibold text-slate-600 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span>Tag Session Biomarkers (Click to associate with note):</span>
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white/70 border border-slate-200 rounded-lg">
                {session.results.map((r) => {
                  const cat = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === r.biomarkerId);
                  const isSelected = selectedBiomarkers.includes(r.biomarkerId);
                  const isAbnormal = r.status !== 'Normal';
                  return (
                    <button
                      key={r.resultId}
                      type="button"
                      onClick={() => toggleBiomarker(r.biomarkerId)}
                      className={`px-2 py-0.5 rounded text-2xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : isAbnormal
                          ? 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{cat?.name || r.biomarkerId}</span>
                      <span className="opacity-75 font-mono">
                        {r.resultValue} {r.unitMeasured}
                      </span>
                      {isAbnormal && (
                        <span className={`text-3xs font-bold ${isSelected ? 'text-amber-200' : 'text-amber-700'}`}>
                          • {r.status}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Narrative Observation Input */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800">
                  Clinical Narrative Observation & Assessment:
                </label>
                <span className="text-2xs text-slate-400 font-mono">
                  {narrative.length} characters • {narrative.trim() ? narrative.trim().split(/\s+/).length : 0} words
                </span>
              </div>
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={5}
                required
                placeholder="Enter clinical assessment, diagnostic impression, treatment response, dietary modifications, or surveillance instructions..."
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-indigo-500 font-sans leading-relaxed shadow-inner"
              />
            </div>

            {/* Form Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-indigo-100">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!narrative.trim() || isSaving}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving to Database...' : 'Save Narrative Observation'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Search & Category Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search narrative notes, clinicians, or diagnostic terms..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-indigo-500"
            />
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-2xs pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategoryFilter('All')}
              className={`px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategoryFilter === 'All'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Categories ({observations.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = observations.filter((o) => o.category === cat.label).length;
              if (count === 0 && selectedCategoryFilter !== cat.label) return null;
              return (
                <button
                  key={cat.label}
                  onClick={() => setSelectedCategoryFilter(cat.label)}
                  className={`px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    selectedCategoryFilter === cat.label
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Observations List / Chronological Timeline */}
        {filteredObservations.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-800">
                {searchQuery || selectedCategoryFilter !== 'All'
                  ? 'No observations match the current filter'
                  : 'No Narrative Observations Recorded Yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery || selectedCategoryFilter !== 'All'
                  ? 'Try clearing your search query or selecting "All Categories" to view recorded entries.'
                  : `Attending clinicians have not yet documented narrative observations for session ${session.sessionId}. Click below to add the first clinical entry.`}
              </p>
            </div>
            {!isAdding && (
              <button
                onClick={() => setIsAdding(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Record First Narrative Observation</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {filteredObservations.map((obs) => {
              const catConfig = CATEGORIES.find((c) => c.label === obs.category) || CATEGORIES[0];
              const prioConfig = PRIORITIES.find((p) => p.label === obs.priority) || PRIORITIES[0];
              const PrioIcon = prioConfig.icon;
              const isEditing = editingId === obs.id;

              return (
                <div
                  key={obs.id}
                  className="p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all shadow-2xs space-y-3"
                >
                  {/* Observation Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Clinician Avatar & Info */}
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center justify-center shrink-0">
                          {obs.author
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900">{obs.author}</span>
                            <span className="text-3xs text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-medium">
                              Verified Clinician
                            </span>
                          </div>
                          <div className="text-3xs text-slate-500 font-medium">
                            {obs.role || 'Clinical Attending'}
                          </div>
                        </div>
                      </div>

                      <span className="text-slate-300 hidden sm:inline" aria-hidden="true">|</span>

                      {/* Timestamp Badge */}
                      <div className="flex items-center gap-1.5 text-2xs text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-mono">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formatDateTime(obs.timestamp)}</span>
                        <span className="text-slate-400">({getRelativeTime(obs.timestamp)})</span>
                      </div>
                    </div>

                    {/* Category & Priority Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-md text-2xs font-semibold border ${catConfig.bg} ${catConfig.color} ${catConfig.border}`}
                      >
                        {obs.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-2xs font-semibold border flex items-center gap-1 ${prioConfig.badgeBg} ${prioConfig.color}`}
                      >
                        <PrioIcon className="w-3 h-3" />
                        <span>{obs.priority}</span>
                      </span>
                    </div>
                  </div>

                  {/* Attached Biomarkers Chips */}
                  {obs.relatedBiomarkers && obs.relatedBiomarkers.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-2xs">
                      <span className="text-3xs font-semibold uppercase font-mono text-slate-400">
                        Correlated Biomarkers:
                      </span>
                      {obs.relatedBiomarkers.map((bmId) => {
                        const cat = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === bmId);
                        const result = session.results.find((r) => r.biomarkerId === bmId);
                        return (
                          <span
                            key={bmId}
                            className={`px-2 py-0.5 rounded text-2xs font-medium border flex items-center gap-1 ${
                              result && result.status !== 'Normal'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            <span>{cat?.name || bmId}</span>
                            {result && (
                              <span className="font-mono text-3xs opacity-80">
                                ({result.resultValue} {result.unitMeasured})
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Narrative Body */}
                  {isEditing ? (
                    <div className="space-y-3 pt-1">
                      <textarea
                        value={editNarrative}
                        onChange={(e) => setEditNarrative(e.target.value)}
                        rows={4}
                        className="w-full bg-white border border-indigo-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-indigo-500 font-sans"
                      />
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-xs">
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value as ObservationCategory)}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-2xs font-medium cursor-pointer"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c.label} value={c.label}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={editPriority}
                            onChange={(e) => setEditPriority(e.target.value as ObservationPriority)}
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-2xs font-medium cursor-pointer"
                          >
                            {PRIORITIES.map((p) => (
                              <option key={p.label} value={p.label}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 text-2xs font-medium text-slate-600 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(obs.id)}
                            className="px-3 py-1 text-2xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded cursor-pointer"
                          >
                            Save Updates
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line pl-1 font-sans">
                      {obs.narrative}
                    </div>
                  )}

                  {/* Card Bottom Bar & Tools */}
                  {!isEditing && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-2xs text-slate-500">
                      <div className="flex items-center gap-2">
                        {obs.lastEditedAt && (
                          <span className="italic text-slate-400">
                            Last edited: {formatDateTime(obs.lastEditedAt)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyNote(obs)}
                          className="hover:text-slate-800 p-1 rounded hover:bg-slate-100 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Copy observation narrative"
                        >
                          {copiedId === obs.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(obs)}
                          className="hover:text-indigo-700 p-1 rounded hover:bg-indigo-50 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Edit this observation"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(obs.id)}
                          className="hover:text-rose-700 p-1 rounded hover:bg-rose-50 flex items-center gap-1 transition-colors cursor-pointer"
                          title="Delete observation"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

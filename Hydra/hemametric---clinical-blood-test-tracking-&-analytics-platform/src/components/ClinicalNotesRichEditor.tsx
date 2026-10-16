import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Clock,
  Check,
  Copy,
  Save,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  FileText,
  UserCheck,
  BookmarkPlus,
  Eraser,
  Highlighter,
} from 'lucide-react';
import { updateSessionNotes } from '../services/storageService';

interface ClinicalNotesRichEditorProps {
  sessionId: string;
  initialNotes: string;
  initialNotesHtml?: string;
  lastEditedAt?: string;
  author?: string;
  patientName: string;
  collectionDate: string;
  onSaved?: (newNotes: string, newNotesHtml: string) => void;
}

const CLINICAL_AUTHORS = [
  'Dr. Sarah Jenkins, MD (Internal Medicine)',
  'Dr. Alex Chen, MD (Pathologist & Reviewer)',
  'Dr. Marcus Vance, MD (Cardiometabolic Specialist)',
  'Dr. Elena Rostova, MD (Clinical Hematologist)',
  'Attending Clinical Reviewer',
];

export const ClinicalNotesRichEditor: React.FC<ClinicalNotesRichEditorProps> = ({
  sessionId,
  initialNotes,
  initialNotesHtml,
  lastEditedAt,
  author,
  patientName,
  collectionDate,
  onSaved,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string>(
    author || CLINICAL_AUTHORS[0]
  );
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(lastEditedAt || null);
  const [wordCount, setWordCount] = useState<number>(0);
  const [charCount, setCharCount] = useState<number>(0);

  // Initialize or update editor content on session change
  useEffect(() => {
    if (editorRef.current) {
      const contentToLoad = initialNotesHtml || initialNotes || '';
      // If content is plain text without HTML tags, wrap appropriately or set directly
      if (contentToLoad && !contentToLoad.includes('<')) {
        editorRef.current.innerHTML = `<p>${contentToLoad.replace(/\n/g, '<br/>')}</p>`;
      } else {
        editorRef.current.innerHTML = contentToLoad;
      }
      updateCounts();
      setIsDirty(false);
      setLastSavedTime(lastEditedAt || null);
    }
  }, [sessionId, initialNotes, initialNotesHtml, lastEditedAt]);

  const updateCounts = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
    setCharCount(text.length);
  };

  const handleInput = () => {
    setIsDirty(true);
    setSaveSuccess(false);
    updateCounts();
  };

  // Rich-text formatting command handler
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    setIsDirty(true);
    updateCounts();
  };

  // Insert structured clinical snippet templates
  const insertTemplate = (templateType: 'soap' | 'differential' | 'cardiometabolic' | 'normal') => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const timestamp = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    let templateHtml = '';

    if (templateType === 'soap') {
      templateHtml = `
        <h3 style="font-weight: 700; color: #1e293b; margin-top: 12px; margin-bottom: 4px;">Subjective Findings:</h3>
        <p>Patient attended for follow-up laboratory evaluation on ${collectionDate}. Reports adherence to current regimen. No acute symptoms of fatigue, syncope, or uncharacteristic chest discomfort reported.</p>
        <h3 style="font-weight: 700; color: #1e293b; margin-top: 12px; margin-bottom: 4px;">Objective Laboratory Correlation:</h3>
        <p>Review of venous specimen panel demonstrates key analytical findings. Critical and marked deviations highlighted in reference overlay table.</p>
        <h3 style="font-weight: 700; color: #1e293b; margin-top: 12px; margin-bottom: 4px;">Diagnostic Assessment:</h3>
        <p>Primary diagnostic impressions and pathophysiological considerations formulated from multi-analyte trends.</p>
        <h3 style="font-weight: 700; color: #1e293b; margin-top: 12px; margin-bottom: 4px;">Therapeutic & Surveillance Plan:</h3>
        <ul>
          <li>Continue current medical management and lifestyle adjustments.</li>
          <li>Repeat targeted diagnostic panel in 90 to 120 days.</li>
          <li>Patient notified of results via secure clinical portal.</li>
        </ul>
      `;
    } else if (templateType === 'differential') {
      templateHtml = `
        <h3 style="font-weight: 700; color: #1e293b; margin-top: 12px; margin-bottom: 4px;">Diagnostic Impression & Differentials:</h3>
        <p><strong>Primary Impression:</strong> Evaluated abnormal biomarker deviation in context of current clinical history.</p>
        <h4 style="font-weight: 600; color: #334155; margin-top: 8px; margin-bottom: 4px;">Differential Diagnoses Considered:</h4>
        <ol>
          <li>Reactive inflammatory response vs. early subclinical dysregulation.</li>
          <li>Secondary dietary/lifestyle-induced metabolic elevation.</li>
          <li>Transient benign physiological fluctuation.</li>
        </ol>
        <p style="margin-top: 8px;"><strong>Recommended Next Steps:</strong> Re-test fasting specimen and consider ultrasound/complementary imaging if elevations persist.</p>
      `;
    } else if (templateType === 'cardiometabolic') {
      templateHtml = `
        <h3 style="font-weight: 700; color: #1e293b; margin-top: 12px; margin-bottom: 4px;">Cardiometabolic Risk Observation:</h3>
        <p>Atherogenic particle balance and glycemic metrics reviewed. Derived ratios (Triglyceride/HDL and De Ritis index) monitored longitudinally.</p>
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 8px 12px; margin: 8px 0; border-radius: 4px; color: #78350f;">
          <strong>Clinical Caution:</strong> Monitor visceral adiposity, fasting insulin sensitivity, and endothelial markers to mitigate vascular risk.
        </div>
      `;
    } else if (templateType === 'normal') {
      templateHtml = `
        <h3 style="font-weight: 700; color: #1e293b; margin-top: 12px; margin-bottom: 4px;">Routine Laboratory Surveillance:</h3>
        <p>Comprehensive blood panel evaluated on ${collectionDate}. All measured biomarkers reside comfortably within standard biological reference intervals. Stable homeostasis confirmed.</p>
        <p><strong>Plan:</strong> Schedule routine annual surveillance visit.</p>
      `;
    }

    // Insert at cursor or append
    document.execCommand('insertHTML', false, templateHtml);
    setIsDirty(true);
    updateCounts();
  };

  // Insert current timestamp and signature
  const insertTimestampSignature = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const now = new Date();
    const formatted = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const stamp = `<p style="color: #64748b; font-size: 0.85em; margin: 8px 0; font-family: monospace;"><em>— Recorded on ${formatted} by ${selectedAuthor}</em></p>`;
    document.execCommand('insertHTML', false, stamp);
    setIsDirty(true);
    updateCounts();
  };

  // Insert alert/caution callout block
  const insertAlertCallout = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const callout = `
      <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 10px 14px; margin: 10px 0; border-radius: 6px; color: #9f1239;">
        <strong>Diagnostic Flag:</strong> Document specific clinical anomaly, unexpected out-of-range value, or urgent intervention required.
      </div>
    `;
    document.execCommand('insertHTML', false, callout);
    setIsDirty(true);
    updateCounts();
  };

  // Save handler
  const handleSave = () => {
    if (!editorRef.current) return;
    setIsSaving(true);

    const htmlContent = editorRef.current.innerHTML;
    const textContent = editorRef.current.innerText || '';

    // Save to persistent storage service
    const success = updateSessionNotes(
      sessionId,
      textContent,
      htmlContent,
      selectedAuthor
    );

    setTimeout(() => {
      setIsSaving(false);
      if (success) {
        setIsDirty(false);
        setSaveSuccess(true);
        const nowIso = new Date().toISOString();
        setLastSavedTime(nowIso);
        if (onSaved) {
          onSaved(textContent, htmlContent);
        }
        setTimeout(() => setSaveSuccess(false), 3500);
      }
    }, 300);
  };

  // Reset to original
  const handleReset = () => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialNotesHtml || initialNotes || '';
      setIsDirty(false);
      setSaveSuccess(false);
      updateCounts();
    }
  };

  // Copy plain text or formatted text to clipboard
  const handleCopy = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
      {/* Header with Title and Clinician Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
            <FileText className="w-4 h-4" />
            <span>Clinical Documentation & Diagnostic Observations</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Subjective Notes & Attending Physician Observations
          </h2>
          <p className="text-xs text-slate-500">
            Document patient-reported symptoms, objective laboratory correlations, diagnostic impressions, and treatment plans for {patientName}.
          </p>
        </div>

        {/* Attending Clinician Selector */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <UserCheck className="w-4 h-4 text-slate-400" />
          <div className="space-y-0.5">
            <label htmlFor="clinician-author-select" className="text-3xs text-slate-400 uppercase font-mono block">Documenting Clinician</label>
            <select
              id="clinician-author-select"
              value={selectedAuthor}
              onChange={(e) => {
                setSelectedAuthor(e.target.value);
                setIsDirty(true);
              }}
              className="bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs font-medium text-slate-900 focus:outline-none cursor-pointer"
            >
              {CLINICAL_AUTHORS.map((auth) => (
                <option key={auth} value={auth}>
                  {auth}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Structured Clinical Template Snippets Bar */}
      <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-2xs overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0 text-slate-700 font-semibold">
          <BookmarkPlus className="w-3.5 h-3.5 text-blue-600" />
          <span>Insert Structured Framework:</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => insertTemplate('soap')}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            + SOAP Note Framework
          </button>
          <button
            type="button"
            onClick={() => insertTemplate('differential')}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            + Differential Diagnoses
          </button>
          <button
            type="button"
            onClick={() => insertTemplate('cardiometabolic')}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            + Cardiometabolic Focus
          </button>
          <button
            type="button"
            onClick={() => insertTemplate('normal')}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            + Routine Baseline Clearance
          </button>
        </div>
      </div>

      {/* Rich-Text Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-100/90 border border-slate-200 rounded-t-lg text-xs">
        {/* Style toggles */}
        <div className="flex items-center gap-0.5 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('bold')}
            title="Bold (Ctrl+B)"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('italic')}
            title="Italic (Ctrl+I)"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('underline')}
            title="Underline (Ctrl+U)"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('strikeThrough')}
            title="Strikethrough"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
        </div>

        {/* Headings */}
        <div className="flex items-center gap-0.5 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h3>')}
            title="Section Heading (H3)"
            className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 font-bold text-2xs transition-colors cursor-pointer flex items-center gap-0.5"
          >
            <Heading2 className="w-3.5 h-3.5" />
            <span>H3</span>
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<h4>')}
            title="Subheading (H4)"
            className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 font-bold text-2xs transition-colors cursor-pointer flex items-center gap-0.5"
          >
            <Heading3 className="w-3.5 h-3.5" />
            <span>H4</span>
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<p>')}
            title="Normal Paragraph"
            className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 text-2xs transition-colors cursor-pointer"
          >
            Body
          </button>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-0.5 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={() => executeCommand('insertUnorderedList')}
            title="Bulleted List"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('insertOrderedList')}
            title="Numbered List"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('formatBlock', '<blockquote>')}
            title="Quote / Finding Block"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Quote className="w-4 h-4" />
          </button>
        </div>

        {/* Clinical Enhancements */}
        <div className="flex items-center gap-1 border-r border-slate-300 pr-1.5 mr-1">
          <button
            type="button"
            onClick={insertAlertCallout}
            title="Insert Diagnostic Caution Callout"
            className="px-2 py-1 rounded hover:bg-rose-100 text-rose-700 font-semibold text-2xs transition-colors cursor-pointer flex items-center gap-1"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Flag Box</span>
          </button>
          <button
            type="button"
            onClick={insertTimestampSignature}
            title="Insert Date/Time Clinician Signature"
            className="px-2 py-1 rounded hover:bg-slate-200 text-slate-700 text-2xs transition-colors cursor-pointer flex items-center gap-1"
          >
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Time Stamp</span>
          </button>
        </div>

        {/* Clear formatting */}
        <button
          type="button"
          onClick={() => executeCommand('removeFormat')}
          title="Clear formatting"
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer ml-auto"
        >
          <Eraser className="w-4 h-4" />
        </button>
      </div>

      {/* WYSIWYG Editable Canvas */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          spellCheck={true}
          className="min-h-[220px] max-h-[500px] overflow-y-auto p-4 bg-white border border-t-0 border-slate-200 rounded-b-lg text-slate-900 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500 prose prose-slate max-w-none"
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
          data-placeholder="Enter subjective patient history, physical examination findings, diagnostic observations, or therapeutic plans for this laboratory test session..."
        />

        {/* Empty state hint */}
        {wordCount === 0 && (
          <div className="absolute top-4 left-4 text-slate-400 text-sm pointer-events-none select-none">
            Enter subjective patient history, physical examination correlations, diagnostic observations, or therapeutic plans for this session...
          </div>
        )}
      </div>

      {/* Editor Status & Action Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs">
        {/* Statistics & Saved State */}
        <div className="flex items-center gap-3 text-slate-500 text-2xs">
          <span className="font-mono">
            {wordCount} words · {charCount} chars
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          {saveSuccess ? (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Saved to EHR Patient Record</span>
            </span>
          ) : isDirty ? (
            <span className="text-amber-700 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Unsaved changes in draft</span>
            </span>
          ) : lastSavedTime ? (
            <span className="text-slate-500 font-mono">
              Last saved: {new Date(lastSavedTime).toLocaleDateString()} {new Date(lastSavedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span className="text-slate-400">Ready for clinical entry</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Copy formatted note to clipboard"
          >
            {copySuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span>Copy for EHR</span>
              </>
            )}
          </button>

          {isDirty && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-md transition-colors cursor-pointer"
            >
              Discard Changes
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              isDirty
                ? 'bg-blue-700 hover:bg-blue-800 text-white'
                : 'bg-slate-800 hover:bg-slate-900 text-white'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Observations'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

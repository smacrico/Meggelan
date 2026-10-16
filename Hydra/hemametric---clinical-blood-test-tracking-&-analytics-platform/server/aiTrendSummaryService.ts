import { GoogleGenAI } from '@google/genai';
import {
  PatientProfile,
  TestSession,
  BiomarkerResult,
} from '../src/types/clinical';
import { MASTER_BIOMARKER_CATALOG } from '../src/data/seedData';

export type SummaryTone = 'specialist' | 'patient' | 'brief';
export type TimeHorizon = 'all' | 'latest-two' | '1y' | '2y';

export interface SignificantShift {
  biomarkerId: string;
  name: string;
  category: string;
  unit: string;
  baselineValue: number;
  latestValue: number;
  baselineDate: string;
  latestDate: string;
  absoluteChange: number;
  percentChange: number;
  direction: 'up' | 'down' | 'stable';
  significance: 'critical' | 'high' | 'moderate' | 'mild' | 'stable';
  statusTransition: {
    from: string;
    to: string;
    isWorsening: boolean;
    isImproving: boolean;
  };
  clinicalInterpretation: string;
}

export interface PanelSummary {
  category: string;
  status: 'stable' | 'attention-required' | 'critical' | 'improved';
  highlight: string;
}

export interface AiTrendSummaryResult {
  success: boolean;
  source: 'gemini-3.8-flash' | 'clinical-heuristic-engine';
  timestamp: string;
  patient: {
    profileId: string;
    name: string;
    mrn: string;
    gender: string;
    age: number;
    conditions: string[];
    medications: string[];
  };
  timeHorizon: {
    baselineDate: string;
    latestDate: string;
    sessionCount: number;
    horizonDays: number;
    mode: TimeHorizon;
  };
  tone: SummaryTone;
  executiveSynopsis: string;
  narrativeSummary: string;
  significantShifts: SignificantShift[];
  panelSummaries: PanelSummary[];
  clinicalKeyTakeaways: string[];
  suggestedActions: string[];
}

/**
 * Calculate patient age from DOB
 */
function calculateAge(dob: string): number {
  if (!dob) return 45;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return isNaN(age) ? 45 : age;
}

/**
 * Filter and sort sessions chronologically based on horizon
 */
export function getAnalyzedSessions(sessions: TestSession[], horizon: TimeHorizon): TestSession[] {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime()
  );

  if (sorted.length <= 1) return sorted;

  if (horizon === 'latest-two') {
    return sorted.slice(-2);
  }

  if (horizon === '1y' || horizon === '2y') {
    const latestDate = new Date(sorted[sorted.length - 1].collectionDate);
    const months = horizon === '1y' ? 12 : 24;
    const cutoff = new Date(latestDate);
    cutoff.setMonth(cutoff.getMonth() - months);
    const filtered = sorted.filter((s) => new Date(s.collectionDate) >= cutoff);
    return filtered.length >= 2 ? filtered : sorted.slice(-2);
  }

  return sorted;
}

/**
 * Compute detailed biomarker shifts between baseline (first in window) and latest session
 */
export function computeBiomarkerShifts(
  sessions: TestSession[],
  profile: PatientProfile
): SignificantShift[] {
  if (sessions.length < 2) return [];

  const baselineSession = sessions[0];
  const latestSession = sessions[sessions.length - 1];
  const isFemale = profile.gender === 'Female';

  const shifts: SignificantShift[] = [];

  // Match biomarkers present in both or newly abnormal
  const catalogMap = new Map(MASTER_BIOMARKER_CATALOG.map((b) => [b.biomarkerId, b]));

  latestSession.results.forEach((latestRes) => {
    const baselineRes = baselineSession.results.find((r) => r.biomarkerId === latestRes.biomarkerId);
    if (!baselineRes) return;

    const catalogItem = catalogMap.get(latestRes.biomarkerId);
    const name = catalogItem ? catalogItem.name : latestRes.biomarkerId;
    const category = catalogItem ? catalogItem.category : 'General Chemistry';
    const unit = latestRes.unitMeasured;

    const valA = baselineRes.resultValue;
    const valB = latestRes.resultValue;
    const absChange = Number((valB - valA).toFixed(2));
    const pctChange = valA !== 0 ? Number((((valB - valA) / Math.abs(valA)) * 100).toFixed(1)) : 0;

    const direction: 'up' | 'down' | 'stable' =
      pctChange > 2 ? 'up' : pctChange < -2 ? 'down' : 'stable';

    const statusA = baselineRes.status;
    const statusB = latestRes.status;

    const refLow = catalogItem ? (isFemale ? catalogItem.refLowFemale : catalogItem.refLowMale) : latestRes.refLow;
    const refHigh = catalogItem ? (isFemale ? catalogItem.refHighFemale : catalogItem.refHighMale) : latestRes.refHigh;

    // Check if shift is worsening or improving
    let isWorsening = false;
    let isImproving = false;

    if (statusA === 'Normal' && statusB !== 'Normal') {
      isWorsening = true;
    } else if (statusA !== 'Normal' && statusB === 'Normal') {
      isImproving = true;
    } else if (statusB.includes('Critical') && !statusA.includes('Critical')) {
      isWorsening = true;
    } else if (statusA.includes('Critical') && !statusB.includes('Critical')) {
      isImproving = true;
    }

    // Determine clinical shift significance
    let significance: 'critical' | 'high' | 'moderate' | 'mild' | 'stable' = 'stable';
    const absPct = Math.abs(pctChange);

    if (statusB.includes('Critical') || (statusA.includes('Critical') && statusB.includes('Critical'))) {
      significance = 'critical';
    } else if (isWorsening && absPct >= 15) {
      significance = 'high';
    } else if (absPct >= 25) {
      significance = 'high';
    } else if (absPct >= 12 || isWorsening || isImproving) {
      significance = 'moderate';
    } else if (absPct >= 5) {
      significance = 'mild';
    }

    // Generate clinical interpretation text
    let interpretation = '';
    if (significance === 'critical') {
      interpretation = `Critical excursion: ${name} shifted ${pctChange > 0 ? '+' : ''}${pctChange}% to ${valB} ${unit} (Ref: ${refLow}-${refHigh}), reaching clinical alert criteria.`;
    } else if (isWorsening) {
      interpretation = `Deteriorating trajectory: ${name} changed by ${pctChange > 0 ? '+' : ''}${pctChange}%, transitioning from ${statusA} to ${statusB}.`;
    } else if (isImproving) {
      interpretation = `Favorable response: ${name} normalized from ${statusA} to ${statusB} (${pctChange > 0 ? '+' : ''}${pctChange}%).`;
    } else if (absPct >= 15) {
      interpretation = `Substantial longitudinal shift: ${name} moved ${pctChange > 0 ? '+' : ''}${pctChange}% (${valA} → ${valB} ${unit}).`;
    } else {
      interpretation = `Stable variance: ${name} maintained consistent baseline at ${valB} ${unit} (${pctChange > 0 ? '+' : ''}${pctChange}%).`;
    }

    shifts.push({
      biomarkerId: latestRes.biomarkerId,
      name,
      category,
      unit,
      baselineValue: valA,
      latestValue: valB,
      baselineDate: baselineSession.collectionDate,
      latestDate: latestSession.collectionDate,
      absoluteChange: absChange,
      percentChange: pctChange,
      direction,
      significance,
      statusTransition: {
        from: statusA,
        to: statusB,
        isWorsening,
        isImproving,
      },
      clinicalInterpretation: interpretation,
    });
  });

  // Sort by clinical significance: critical first, then high, then moderate, then magnitude of percent change
  const priorityMap = { critical: 4, high: 3, moderate: 2, mild: 1, stable: 0 };
  return shifts.sort((a, b) => {
    const diff = priorityMap[b.significance] - priorityMap[a.significance];
    if (diff !== 0) return diff;
    return Math.abs(b.percentChange) - Math.abs(a.percentChange);
  });
}

/**
 * Generate heuristic fallback summary when offline or Gemini API key is absent
 */
export function generateHeuristicTrendSummary(
  profile: PatientProfile,
  sessions: TestSession[],
  shifts: SignificantShift[],
  tone: SummaryTone,
  horizon: TimeHorizon
): AiTrendSummaryResult {
  const patientAge = calculateAge(profile.dob);
  const baselineDate = sessions[0]?.collectionDate || 'N/A';
  const latestDate = sessions[sessions.length - 1]?.collectionDate || 'N/A';
  const horizonDays = Math.max(
    1,
    Math.round(
      (new Date(latestDate).getTime() - new Date(baselineDate).getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  const topCriticals = shifts.filter((s) => s.significance === 'critical');
  const topHighs = shifts.filter((s) => s.significance === 'high');
  const topImproves = shifts.filter((s) => s.statusTransition.isImproving);

  // Group shifts by category
  const categories = Array.from(new Set(shifts.map((s) => s.category)));
  const panelSummaries: PanelSummary[] = categories.map((cat) => {
    const catShifts = shifts.filter((s) => s.category === cat);
    const hasCrit = catShifts.some((s) => s.significance === 'critical');
    const hasWorsening = catShifts.some((s) => s.statusTransition.isWorsening);
    const hasImproving = catShifts.some((s) => s.statusTransition.isImproving);

    let status: PanelSummary['status'] = 'stable';
    if (hasCrit) status = 'critical';
    else if (hasWorsening) status = 'attention-required';
    else if (hasImproving) status = 'improved';

    const topShift = catShifts[0];
    const highlight = topShift
      ? `${topShift.name} exhibited a ${topShift.percentChange > 0 ? '+' : ''}${topShift.percentChange}% delta (${topShift.baselineValue} → ${topShift.latestValue} ${topShift.unit}).`
      : 'Values within biological reference limits.';

    return { category: cat, status, highlight };
  });

  // Synopsis generation based on tone
  let executiveSynopsis = '';
  let narrativeSummary = '';
  const takeaways: string[] = [];
  const actions: string[] = [];

  if (tone === 'specialist') {
    executiveSynopsis = `Longitudinal laboratory evaluation for ${profile.firstName} ${profile.lastName} (MRN: ${profile.mrn}, ${patientAge}yo ${profile.gender}) across ${sessions.length} sessions (${baselineDate} to ${latestDate}, ${horizonDays}d surveillance horizon). Trajectory reflects notable biochemical shifts in ${categories.slice(0, 3).join(', ')}${topCriticals.length > 0 ? ' with critical alert thresholds triggered' : ''}.`;

    narrativeSummary = `### Clinical Pathology Longitudinal Review\n\n**Patient Context:** ${profile.firstName} ${profile.lastName}, a ${patientAge}-year-old ${profile.gender} with documented history of ${profile.medicalConditions.join(', ') || 'no prior chronic diagnoses'}, evaluated across ${sessions.length} specimen collection points from **${baselineDate}** to **${latestDate}**.\n\n` +
      `#### 1. Significant Biomarker Shift Velocity & Critical Alerts\n` +
      shifts.slice(0, 6).map((s) => `- **${s.name} (${s.category}):** Shifted from **${s.baselineValue} ${s.unit}** (${s.statusTransition.from}) to **${s.latestValue} ${s.unit}** (${s.statusTransition.to}), representing a **${s.percentChange > 0 ? '+' : ''}${s.percentChange}% delta** (${s.clinicalInterpretation}).`).join('\n') +
      `\n\n#### 2. Panel-by-Panel Longitudinal Impressions\n` +
      panelSummaries.map((p) => `- **${p.category}:** *Status: ${p.status.toUpperCase()}* — ${p.highlight}`).join('\n') +
      `\n\n#### 3. Pathophysiological Assessment\n` +
      `Observed biomarker trajectories correlate with active physiological remodeling. ${topCriticals.length > 0 ? 'Urgent attention is warranted for critical value departures.' : 'The velocity of shifts indicates therapeutic response or progressive subclinical drift requiring continued serial monitoring.'}`;

    takeaways.push(
      `${shifts.length} biomarkers evaluated; ${topHighs.length + topCriticals.length} demonstrated clinically significant longitudinal variance (≥12% delta or status transition).`,
      topCriticals.length > 0
        ? `CRITICAL ALERT: ${topCriticals.map((c) => c.name).join(', ')} require immediate clinical review.`
        : `Primary dynamic variance identified in ${categories[0] || 'metabolic markers'}.`,
      topImproves.length > 0
        ? `Favorable normalization observed in ${topImproves.map((i) => i.name).join(', ')}.`
        : `Serial trend shows active biomarker divergence from baseline.`
    );

    actions.push(
      `Schedule follow-up targeted repeat panel in 30-60 days for unstable biomarkers.`,
      `Cross-reference findings against current pharmacotherapy (${profile.medications.join(', ') || 'None recorded'}).`,
      `Consider secondary confirmatory assays for out-of-range parameters.`
    );
  } else if (tone === 'patient') {
    executiveSynopsis = `Welcome ${profile.firstName}. This plain-language summary compares your blood test results from ${baselineDate} to ${latestDate}. Overall, we observed important updates in your ${categories.slice(0, 2).join(' and ')} that help you and your doctor see how your body is responding over time.`;

    narrativeSummary = `### Your Blood Test Health Update\n\nHello **${profile.firstName}**, here is a clear summary of how your lab numbers have changed over the last ${Math.round(horizonDays / 30)} months (from ${baselineDate} to ${latestDate}):\n\n` +
      `#### What Changed the Most?\n` +
      shifts.slice(0, 5).map((s) => {
        const changeWord = s.direction === 'up' ? 'increased' : s.direction === 'down' ? 'decreased' : 'stayed about the same';
        const goodOrBad = s.statusTransition.isImproving ? '👍 (improving towards healthy range)' : s.statusTransition.isWorsening ? '⚠️ (moved outside standard range)' : 'ℹ️';
        return `- **${s.name}:** Your level ${changeWord} by **${Math.abs(s.percentChange)}%** (from ${s.baselineValue} to ${s.latestValue} ${s.unit}). ${goodOrBad}`;
      }).join('\n') +
      `\n\n#### Main Takeaway\n` +
      `Your tests show clear trends that provide valuable clues about your daily nutrition, activity, and recovery. Discussing these with your doctor will help you decide if any simple adjustments to medications or daily habits are needed.`;

    takeaways.push(
      `Most numbers remained steady, while key markers like ${shifts[0]?.name || 'iron/lipids'} showed active movement.`,
      topImproves.length > 0
        ? `Positive progress: ${topImproves.map((i) => i.name).join(', ')} showed improvement toward healthy target ranges.`
        : `Your provider will help guide you on the best steps for any out-of-range results.`
    );

    actions.push(
      `Review these shifts with your primary physician at your next consultation.`,
      `Continue taking prescribed medications consistently unless instructed by your provider.`,
      `Maintain balanced hydration and nutrition prior to future scheduled blood draws.`
    );
  } else {
    // Brief / Executive rounds
    executiveSynopsis = `ROUNDS BRIEF: ${profile.lastName}, ${profile.firstName} | MRN ${profile.mrn} | ${patientAge}yo ${profile.gender} | Window: ${baselineDate} → ${latestDate} (${sessions.length} sessions). Significant shifts: ${shifts.filter((s) => s.significance !== 'stable').length}.`;

    narrativeSummary = `* **Patient:** ${profile.lastName}, ${profile.firstName} (${patientAge}y ${profile.gender}) | MRN: ${profile.mrn}\n` +
      `* **Observation Window:** ${baselineDate} to ${latestDate} (${sessions.length} visits)\n` +
      `* **Critical Alerts:** ${topCriticals.length > 0 ? topCriticals.map((c) => `${c.name} (${c.latestValue} ${c.unit})`).join(', ') : 'None'}\n` +
      `* **Key Shift Velocities:**\n` +
      shifts.slice(0, 5).map((s) => `  - ${s.name}: ${s.baselineValue} → ${s.latestValue} ${s.unit} (${s.percentChange > 0 ? '+' : ''}${s.percentChange}%) [${s.statusTransition.from} → ${s.statusTransition.to}]`).join('\n') +
      `\n* **Panel Highlights:** ${panelSummaries.map((p) => `${p.category}: ${p.status}`).join(' | ')}`;

    takeaways.push(
      `Key biomarker variance: ${shifts.slice(0, 3).map((s) => `${s.name} (${s.percentChange > 0 ? '+' : ''}${s.percentChange}%)`).join(', ')}.`,
      topCriticals.length > 0 ? `Urgent flag for ${topCriticals.map((c) => c.name).join(', ')}.` : `No life-threatening critical panics present.`
    );

    actions.push(`Review with attending physician`, `Repeat panel at 6-8 week follow-up`);
  }

  return {
    success: true,
    source: 'clinical-heuristic-engine',
    timestamp: new Date().toISOString(),
    patient: {
      profileId: profile.profileId,
      name: `${profile.firstName} ${profile.lastName}`,
      mrn: profile.mrn,
      gender: profile.gender,
      age: patientAge,
      conditions: profile.medicalConditions,
      medications: profile.medications,
    },
    timeHorizon: {
      baselineDate,
      latestDate,
      sessionCount: sessions.length,
      horizonDays,
      mode: horizon,
    },
    tone,
    executiveSynopsis,
    narrativeSummary,
    significantShifts: shifts,
    panelSummaries,
    clinicalKeyTakeaways: takeaways,
    suggestedActions: actions,
  };
}

/**
 * Generate AI-powered Patient Blood Test Trend Summary using @google/genai Gemini 3.8 Flash
 */
export async function generatePatientTrendSummary(
  profile: PatientProfile,
  sessions: TestSession[],
  tone: SummaryTone = 'specialist',
  horizon: TimeHorizon = 'all'
): Promise<AiTrendSummaryResult> {
  const analyzedSessions = getAnalyzedSessions(sessions, horizon);

  if (analyzedSessions.length < 2) {
    throw new Error('At least two test sessions are required to analyze longitudinal biomarker trends.');
  }

  const shifts = computeBiomarkerShifts(analyzedSessions, profile);
  const apiKey = process.env.GEMINI_API_KEY;

  // If no Gemini API key configured, use clinical heuristic engine
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    console.log('[AI Trend Summary] GEMINI_API_KEY not configured. Falling back to clinical heuristic engine.');
    return generateHeuristicTrendSummary(profile, analyzedSessions, shifts, tone, horizon);
  }

  try {
    const ai = new GoogleGenAI();
    const patientAge = calculateAge(profile.dob);
    const baselineDate = analyzedSessions[0].collectionDate;
    const latestDate = analyzedSessions[analyzedSessions.length - 1].collectionDate;
    const horizonDays = Math.max(
      1,
      Math.round(
        (new Date(latestDate).getTime() - new Date(baselineDate).getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    // Prepare concise shift payload for the LLM prompt
    const topShiftsPrompt = shifts.map((s) => ({
      name: s.name,
      category: s.category,
      unit: s.unit,
      baseline: `${s.baselineValue} (${s.statusTransition.from}) on ${s.baselineDate}`,
      latest: `${s.latestValue} (${s.statusTransition.to}) on ${s.latestDate}`,
      percentDelta: `${s.percentChange > 0 ? '+' : ''}${s.percentChange}%`,
      direction: s.direction,
      significance: s.significance,
      worsening: s.statusTransition.isWorsening,
      improving: s.statusTransition.isImproving,
    }));

    const systemInstruction = `You are a world-class board-certified Clinical Pathologist and Internal Medicine Specialist assisting with clinical decision support.
Your task is to analyze longitudinal blood test sessions for a patient and produce a high-caliber natural language trend summary highlighting significant biomarker shifts.
Tone requested: ${tone.toUpperCase()}.
- If SPECIALIST: Write rigorous medical narrative using pathophysiological mechanism, velocity of shift, clinical significance, differential diagnosis flags, and evidence-based surveillance recommendations.
- If PATIENT: Write warm, clear, empathetic, accessible prose explaining in plain English what improved, what worsened, and practical discussion points for their next doctor's visit.
- If BRIEF: Write concise, bulleted clinical rounds format with high-yield numbers and delta percentages.

Always structure your JSON response with:
- "executiveSynopsis": 2-3 sentence executive synopsis.
- "narrativeSummary": Multi-paragraph rich Markdown clinical narrative analyzing the longitudinal trends and key biomarker shifts.
- "clinicalKeyTakeaways": Array of 3-5 bullet points.
- "suggestedActions": Array of 3-4 actionable clinical follow-up recommendations.
- "panelHighlights": Array of objects { "category": string, "status": "stable" | "attention-required" | "critical" | "improved", "highlight": string }`;

    const promptContent = `Patient Profile:
- Name: ${profile.firstName} ${profile.lastName}
- Age: ${patientAge} (${profile.dob})
- Gender: ${profile.gender}
- MRN: ${profile.mrn}
- Known Conditions: ${profile.medicalConditions.join(', ') || 'None recorded'}
- Active Medications: ${profile.medications.join(', ') || 'None recorded'}

Surveillance Window:
- Total sessions in window: ${analyzedSessions.length}
- From: ${baselineDate} to ${latestDate} (${horizonDays} days)

Longitudinal Biomarker Shifts (Computed Delta %):
${JSON.stringify(topShiftsPrompt, null, 2)}

Provide your expert clinical trend synthesis strictly in valid JSON format matching the schema described.`;

    const geminiPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptContent,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API request timeout (6s threshold)')), 6000)
    );

    const response = await Promise.race([geminiPromise, timeoutPromise]);

    const text = response.text?.trim() || '';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // If JSON parse fails, fallback cleanly
      return generateHeuristicTrendSummary(profile, analyzedSessions, shifts, tone, horizon);
    }

    const panelSummaries: PanelSummary[] = Array.isArray(parsed.panelHighlights)
      ? parsed.panelHighlights.map((ph: any) => ({
          category: String(ph.category || 'General'),
          status: ['stable', 'attention-required', 'critical', 'improved'].includes(ph.status)
            ? ph.status
            : 'stable',
          highlight: String(ph.highlight || ''),
        }))
      : [];

    return {
      success: true,
      source: 'gemini-3.8-flash',
      timestamp: new Date().toISOString(),
      patient: {
        profileId: profile.profileId,
        name: `${profile.firstName} ${profile.lastName}`,
        mrn: profile.mrn,
        gender: profile.gender,
        age: patientAge,
        conditions: profile.medicalConditions,
        medications: profile.medications,
      },
      timeHorizon: {
        baselineDate,
        latestDate,
        sessionCount: analyzedSessions.length,
        horizonDays,
        mode: horizon,
      },
      tone,
      executiveSynopsis: parsed.executiveSynopsis || `Patient trend analysis from ${baselineDate} to ${latestDate}.`,
      narrativeSummary: parsed.narrativeSummary || text,
      significantShifts: shifts,
      panelSummaries: panelSummaries.length > 0 ? panelSummaries : generateHeuristicTrendSummary(profile, analyzedSessions, shifts, tone, horizon).panelSummaries,
      clinicalKeyTakeaways: Array.isArray(parsed.clinicalKeyTakeaways) ? parsed.clinicalKeyTakeaways : [],
      suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
    };
  } catch (err: any) {
    console.warn('[AI Trend Summary] Gemini API call encountered error:', err.message);
    // Graceful fallback to heuristic engine
    return generateHeuristicTrendSummary(profile, analyzedSessions, shifts, tone, horizon);
  }
}

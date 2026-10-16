import { PatientProfile, TestSession } from '../types/clinical';

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

const cache = new Map<string, AiTrendSummaryResult>();

export async function fetchAiTrendSummary(
  profile: PatientProfile,
  sessions: TestSession[],
  tone: SummaryTone = 'specialist',
  horizon: TimeHorizon = 'all',
  forceRefresh = false
): Promise<AiTrendSummaryResult> {
  const cacheKey = `${profile.profileId}_${sessions.length}_${tone}_${horizon}`;
  if (!forceRefresh && cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const response = await fetch('/api/ai/trends-summary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profile,
      sessions,
      tone,
      horizon,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate trend summary`);
  }

  const result: AiTrendSummaryResult = await response.json();
  cache.set(cacheKey, result);
  return result;
}

export function formatEhrExport(result: AiTrendSummaryResult): string {
  const p = result.patient;
  const h = result.timeHorizon;
  const criticals = result.significantShifts.filter((s) => s.significance === 'critical');

  let text = `=================================================================\n`;
  text += `HEMAMETRIC CLINICAL LONGITUDINAL TREND SYNTHESIS\n`;
  text += `Generated: ${new Date(result.timestamp).toLocaleString()}\n`;
  text += `AI Model Engine: ${result.source}\n`;
  text += `=================================================================\n\n`;
  text += `PATIENT DEMOGRAPHICS:\n`;
  text += `Name: ${p.name} | MRN: ${p.mrn} | Age: ${p.age}y | Gender: ${p.gender}\n`;
  text += `Conditions: ${p.conditions.join(', ') || 'None recorded'}\n`;
  text += `Active Medications: ${p.medications.join(', ') || 'None recorded'}\n\n`;
  text += `SURVEILLANCE HORIZON:\n`;
  text += `Baseline: ${h.baselineDate} -> Latest: ${h.latestDate} (${h.sessionCount} sessions, ${h.horizonDays} days)\n\n`;
  text += `EXECUTIVE CLINICAL SYNOPSIS:\n`;
  text += `${result.executiveSynopsis}\n\n`;

  if (criticals.length > 0) {
    text += `CRITICAL BIOMARKER ESCALATIONS:\n`;
    criticals.forEach((c) => {
      text += `[!] ${c.name} (${c.category}): ${c.baselineValue} -> ${c.latestValue} ${c.unit} (${c.percentChange > 0 ? '+' : ''}${c.percentChange}%) [${c.statusTransition.from} -> ${c.statusTransition.to}]\n`;
    });
    text += `\n`;
  }

  text += `SIGNIFICANT BIOMARKER SHIFTS (DELTA VELOCITY):\n`;
  result.significantShifts.slice(0, 8).forEach((s) => {
    text += `- ${s.name}: ${s.baselineValue} -> ${s.latestValue} ${s.unit} (${s.percentChange > 0 ? '+' : ''}${s.percentChange}%) | ${s.statusTransition.from} -> ${s.statusTransition.to}\n  Pathophysiological Note: ${s.clinicalInterpretation}\n`;
  });

  text += `\nCLINICAL KEY TAKEAWAYS:\n`;
  result.clinicalKeyTakeaways.forEach((k) => {
    text += `* ${k}\n`;
  });

  text += `\nSUGGESTED SURVEILLANCE & ACTIONS:\n`;
  result.suggestedActions.forEach((a) => {
    text += `* ${a}\n`;
  });

  text += `\n=================================================================\n`;
  return text;
}

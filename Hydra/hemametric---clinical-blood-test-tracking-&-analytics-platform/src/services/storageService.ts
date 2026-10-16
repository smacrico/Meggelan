import {
  PatientProfile,
  Laboratory,
  TestSession,
  AlertHistory,
  ClinicalObservation,
} from '../types/clinical';
import {
  INITIAL_PATIENT_PROFILES,
  INITIAL_TEST_SESSIONS,
  LABORATORIES,
  INITIAL_ALERT_HISTORY,
} from '../data/seedData';

const STORAGE_KEYS = {
  PROFILES: 'hemametric_profiles_v1',
  SESSIONS: 'hemametric_sessions_v1',
  LABS: 'hemametric_labs_v1',
  ALERTS: 'hemametric_alerts_v1',
  SELECTED_PROFILE: 'hemametric_selected_profile_v1',
  OBSERVATIONS: 'hemametric_clinical_observations_v2',
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function subscribeToStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// INITIALIZATION FROM SQLITE SERVER API
// ---------------------------------------------------------------------------

let isInitializedFromSqlite = false;

export async function initStorageFromSqlite(): Promise<void> {
  if (isInitializedFromSqlite) return;
  try {
    const [profRes, sessRes, labsRes, alertsRes] = await Promise.all([
      fetch('/api/profiles').then((r) => r.json()).catch(() => null),
      fetch('/api/sessions').then((r) => r.json()).catch(() => null),
      fetch('/api/labs').then((r) => r.json()).catch(() => null),
      fetch('/api/alerts').then((r) => r.json()).catch(() => null),
    ]);

    if (profRes?.success && Array.isArray(profRes.profiles) && profRes.profiles.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profRes.profiles));
    }
    if (sessRes?.success && Array.isArray(sessRes.sessions)) {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessRes.sessions));
    }
    if (labsRes?.success && Array.isArray(labsRes.labs) && labsRes.labs.length > 0) {
      localStorage.setItem(STORAGE_KEYS.LABS, JSON.stringify(labsRes.labs));
    }
    if (alertsRes?.success && Array.isArray(alertsRes.alerts)) {
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alertsRes.alerts));
    }

    isInitializedFromSqlite = true;
    notify();
  } catch (err) {
    console.warn('SQLite server sync notice (using local offline cache):', err);
  }
}

// Automatically trigger background SQLite sync on import
if (typeof window !== 'undefined') {
  initStorageFromSqlite();
}

// ---------------------------------------------------------------------------
// DATA ACCESS & PERSISTENCE TO SQLITE
// ---------------------------------------------------------------------------

export function getProfiles(): PatientProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse profiles', e);
  }
  localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(INITIAL_PATIENT_PROFILES));
  return INITIAL_PATIENT_PROFILES;
}

export function saveProfiles(profiles: PatientProfile[]) {
  localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  notify();
}

export function getSessions(): TestSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse sessions', e);
  }
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(INITIAL_TEST_SESSIONS));
  return INITIAL_TEST_SESSIONS;
}

export function saveSessions(sessions: TestSession[]) {
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  notify();
}

export function getLabs(): Laboratory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LABS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse labs', e);
  }
  localStorage.setItem(STORAGE_KEYS.LABS, JSON.stringify(LABORATORIES));
  return LABORATORIES;
}

export function getAlerts(): AlertHistory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ALERTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse alerts', e);
  }
  localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(INITIAL_ALERT_HISTORY));
  return INITIAL_ALERT_HISTORY;
}

export function saveAlerts(alerts: AlertHistory[]) {
  localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
  notify();
}

export function getSelectedProfileId(): string {
  const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_PROFILE);
  if (saved) return saved;
  const profiles = getProfiles();
  const firstId = profiles.length > 0 ? profiles[0].profileId : 'pat-eleanor-01';
  localStorage.setItem(STORAGE_KEYS.SELECTED_PROFILE, firstId);
  return firstId;
}

export function setSelectedProfileId(id: string) {
  localStorage.setItem(STORAGE_KEYS.SELECTED_PROFILE, id);
  notify();
}

export function addSession(newSession: TestSession, newAlerts: AlertHistory[] = []) {
  const sessions = getSessions();
  sessions.push(newSession);
  saveSessions(sessions);

  if (newAlerts.length > 0) {
    const alerts = getAlerts();
    alerts.unshift(...newAlerts);
    saveAlerts(alerts);
  }

  // Persist to SQLite Database via backend
  fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: newSession, alerts: newAlerts }),
  }).catch((err) => console.error('Failed to sync session to SQLite:', err));
}

export function deleteSession(sessionId: string) {
  const sessions = getSessions().filter((s) => s.sessionId !== sessionId);
  saveSessions(sessions);

  // Sync to SQLite Database
  fetch(`/api/sessions/${sessionId}`, {
    method: 'DELETE',
  }).catch((err) => console.error('Failed to delete session in SQLite:', err));
}

export function updateSession(updatedSession: TestSession): boolean {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.sessionId === updatedSession.sessionId);
  if (idx !== -1) {
    sessions[idx] = updatedSession;
    saveSessions(sessions);

    fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: updatedSession }),
    }).catch((err) => console.error('Failed to update session in SQLite:', err));

    return true;
  }
  return false;
}

export function updateSessionNotes(
  sessionId: string,
  notes: string,
  notesHtml?: string,
  author?: string
): boolean {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.sessionId === sessionId);
  if (idx !== -1) {
    sessions[idx] = {
      ...sessions[idx],
      notes,
      notesHtml: notesHtml !== undefined ? notesHtml : notes,
      notesLastEditedAt: new Date().toISOString(),
      notesAuthor: author || sessions[idx].notesAuthor || 'Clinical Reviewer',
    };
    saveSessions(sessions);

    // Sync to SQLite Database
    fetch(`/api/sessions/${sessionId}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, notesHtml, author }),
    }).catch((err) => console.error('Failed to sync notes to SQLite:', err));

    return true;
  }
  return false;
}

export function acknowledgeAlert(alertId: string, clinicianName: string = 'Dr. Clinical Reviewer') {
  const alerts = getAlerts();
  const idx = alerts.findIndex((a) => a.alertId === alertId);
  if (idx !== -1) {
    alerts[idx].acknowledged = true;
    alerts[idx].acknowledgedBy = clinicianName;
    alerts[idx].acknowledgedAt = new Date().toISOString();
    saveAlerts(alerts);

    // Sync to SQLite Database
    fetch(`/api/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicianName }),
    }).catch((err) => console.error('Failed to acknowledge alert in SQLite:', err));
  }
}

export function saveOrUpdateProfile(profile: PatientProfile) {
  const profiles = getProfiles();
  const idx = profiles.findIndex((p) => p.profileId === profile.profileId);
  if (idx !== -1) {
    profiles[idx] = profile;
  } else {
    profiles.push(profile);
  }
  saveProfiles(profiles);

  // Sync to SQLite Database
  fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  }).catch((err) => console.error('Failed to sync profile to SQLite:', err));
}

// ---------------------------------------------------------------------------
// CLINICAL NARRATIVE OBSERVATIONS
// ---------------------------------------------------------------------------

export const INITIAL_CLINICAL_OBSERVATIONS: Record<string, ClinicalObservation[]> = {
  'sess-ev-01': [
    {
      id: 'obs-ev1-1',
      sessionId: 'sess-ev-01',
      timestamp: '2024-01-16T11:15:00Z',
      author: 'Dr. Rebecca Martinez, MD',
      role: 'Internal Medicine Attending',
      category: 'Diagnostic Impression',
      priority: 'High Priority',
      narrative: 'Marked microcytic hypochromic indices noted with Ferritin severely depleted at 8.5 ng/mL (critical low threshold) and Hemoglobin reduced to 10.8 g/dL. Clinical presentation correlates with chronic fatigue and exertional dyspnea. Serum iron (38 µg/dL) and TSAT (11.2%) confirm iron-deficient erythropoiesis without overt gastrointestinal blood loss reported.',
      relatedBiomarkers: ['bm-ferr', 'bm-hgb', 'bm-tsat', 'bm-iron']
    },
    {
      id: 'obs-ev1-2',
      sessionId: 'sess-ev-01',
      timestamp: '2024-01-16T14:40:00Z',
      author: 'Dr. Rebecca Martinez, MD',
      role: 'Internal Medicine Attending',
      category: 'Therapeutic Adjustment',
      priority: 'High Priority',
      narrative: 'Initiated oral iron bisglycinate chelate 65mg elemental iron once daily on an empty stomach with 500mg ascorbic acid to optimize mucosal absorption. Advised patient strictly against co-ingesting calcium, antacids, or polyphenolic teas within a 2-hour window. Scheduled re-test of CBC and iron kinetics in 90 days.',
      relatedBiomarkers: ['bm-ferr']
    },
    {
      id: 'obs-ev1-3',
      sessionId: 'sess-ev-01',
      timestamp: '2024-01-22T09:30:00Z',
      author: 'Elena Rostova, RN, BSN',
      role: 'Clinical Nurse Coordinator',
      category: 'Patient Consultation',
      priority: 'Routine',
      narrative: 'Telehealth check-in completed. Patient confirms good gastrointestinal tolerance of iron bisglycinate without nausea or constipation. Advised on incorporating heme-iron rich dietary sources (grass-fed red meat, poultry, spinach) and keeping a hydration log.',
      relatedBiomarkers: []
    }
  ],
  'sess-ev-02': [
    {
      id: 'obs-ev2-1',
      sessionId: 'sess-ev-02',
      timestamp: '2024-04-19T10:20:00Z',
      author: 'Dr. Rebecca Martinez, MD',
      role: 'Internal Medicine Attending',
      category: 'Biomarker Shift Analysis',
      priority: 'Routine',
      narrative: 'Early therapeutic response verified. Ferritin has increased from 8.5 to 16.2 ng/mL and Hemoglobin has improved to 11.6 g/dL. TSAT is progressing towards normal (18.4%). Patient reports subjective improvement in afternoon stamina.',
      relatedBiomarkers: ['bm-ferr', 'bm-hgb', 'bm-tsat']
    },
    {
      id: 'obs-ev2-2',
      sessionId: 'sess-ev-02',
      timestamp: '2024-04-19T11:05:00Z',
      author: 'Dr. Sarah Jenkins, MD',
      role: 'Consulting Hematologist',
      category: 'Follow-up Directive',
      priority: 'Routine',
      narrative: 'Maintain current oral iron regimen for an additional 6 months to ensure bone marrow reticuloendothelial iron stores are fully replenished beyond baseline serum saturation.',
      relatedBiomarkers: ['bm-ferr']
    }
  ],
  'sess-ev-04': [
    {
      id: 'obs-ev4-1',
      sessionId: 'sess-ev-04',
      timestamp: '2025-10-11T13:15:00Z',
      author: 'Dr. Sarah Jenkins, MD',
      role: 'Internal Medicine Attending',
      category: 'Biomarker Shift Analysis',
      priority: 'Attention',
      narrative: 'Long-term hematologic reconstitution successful: Ferritin now robust at 32.4 ng/mL and Hemoglobin optimized at 13.6 g/dL. However, multi-session trend reveals gradual glycemic creep, with Fasting Blood Glucose reaching 101 mg/dL and HbA1c at 5.7% (borderline prediabetic cutoff).',
      relatedBiomarkers: ['bm-ferr', 'bm-glu', 'bm-hba1c']
    },
    {
      id: 'obs-ev4-2',
      sessionId: 'sess-ev-04',
      timestamp: '2025-10-11T14:00:00Z',
      author: 'Dr. Marcus Vance, MD',
      role: 'Cardiometabolic Specialist',
      category: 'Therapeutic Adjustment',
      priority: 'Attention',
      narrative: 'Recommended dietary refinement: reduction of refined carbohydrates and ultra-processed snacks. Transition iron supplementation to a maintenance schedule of alternate-day dosing (30mg twice weekly) to prevent hepatic ferritin overload.',
      relatedBiomarkers: ['bm-glu', 'bm-hba1c']
    }
  ],
  'sess-mr-01': [
    {
      id: 'obs-mr1-1',
      sessionId: 'sess-mr-01',
      timestamp: '2024-04-13T09:00:00Z',
      author: 'Dr. Marcus Vance, MD',
      role: 'Cardiometabolic Specialist',
      category: 'Diagnostic Impression',
      priority: 'Urgent',
      narrative: 'Atherogenic triad identified: marked Hypertriglyceridemia (285 mg/dL), depressed HDL (34 mg/dL), and Triglyceride/HDL ratio of 8.38 indicating severe insulin resistance. Concurrent elevation of ALT (52 U/L) suggests steatohepatitis risk. Commenced lifestyle and statin protocol.',
      relatedBiomarkers: ['bm-tg', 'bm-hdl', 'bm-alt']
    }
  ]
};

export function getAllObservationsMap(): Record<string, ClinicalObservation[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OBSERVATIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse observations', e);
  }
  localStorage.setItem(STORAGE_KEYS.OBSERVATIONS, JSON.stringify(INITIAL_CLINICAL_OBSERVATIONS));
  return INITIAL_CLINICAL_OBSERVATIONS;
}

export function saveAllObservationsMap(map: Record<string, ClinicalObservation[]>) {
  localStorage.setItem(STORAGE_KEYS.OBSERVATIONS, JSON.stringify(map));
  notify();
}

export function getClinicalObservations(sessionId: string): ClinicalObservation[] {
  const map = getAllObservationsMap();
  return (map[sessionId] || []).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function addClinicalObservation(
  sessionId: string,
  observation: Omit<ClinicalObservation, 'id' | 'timestamp' | 'sessionId'> & {
    id?: string;
    timestamp?: string;
    sessionId?: string;
  }
): ClinicalObservation {
  const map = getAllObservationsMap();
  const currentList = map[sessionId] || [];

  const newObs: ClinicalObservation = {
    id: observation.id || `obs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sessionId,
    timestamp: observation.timestamp || new Date().toISOString(),
    author: observation.author,
    role: observation.role || 'Clinical Attending',
    category: observation.category,
    priority: observation.priority,
    narrative: observation.narrative,
    relatedBiomarkers: observation.relatedBiomarkers || [],
    lastEditedAt: new Date().toISOString(),
  };

  const updatedList = [newObs, ...currentList];
  map[sessionId] = updatedList;
  saveAllObservationsMap(map);

  // Sync with test_sessions representation in storage if present
  const sessions = getSessions();
  const sIdx = sessions.findIndex((s) => s.sessionId === sessionId);
  if (sIdx !== -1) {
    sessions[sIdx].clinicalObservations = updatedList;
    saveSessions(sessions);
  }

  // Sync to backend SQLite
  fetch(`/api/sessions/${sessionId}/observations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newObs),
  }).catch((err) => console.error('Failed to sync observation to SQLite:', err));

  return newObs;
}

export function updateClinicalObservation(
  sessionId: string,
  observationId: string,
  updates: Partial<ClinicalObservation>
): boolean {
  const map = getAllObservationsMap();
  const currentList = map[sessionId] || [];
  const idx = currentList.findIndex((o) => o.id === observationId);

  if (idx !== -1) {
    currentList[idx] = {
      ...currentList[idx],
      ...updates,
      lastEditedAt: new Date().toISOString(),
    };
    map[sessionId] = currentList;
    saveAllObservationsMap(map);

    // Sync with test_sessions representation in storage if present
    const sessions = getSessions();
    const sIdx = sessions.findIndex((s) => s.sessionId === sessionId);
    if (sIdx !== -1) {
      sessions[sIdx].clinicalObservations = currentList;
      saveSessions(sessions);
    }

    // Sync to backend SQLite
    fetch(`/api/sessions/${sessionId}/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentList[idx]),
    }).catch((err) => console.error('Failed to sync updated observation to SQLite:', err));

    return true;
  }
  return false;
}

export function deleteClinicalObservation(sessionId: string, observationId: string): boolean {
  const map = getAllObservationsMap();
  const currentList = map[sessionId] || [];
  const filtered = currentList.filter((o) => o.id !== observationId);

  if (filtered.length !== currentList.length) {
    map[sessionId] = filtered;
    saveAllObservationsMap(map);

    // Sync with test_sessions representation
    const sessions = getSessions();
    const sIdx = sessions.findIndex((s) => s.sessionId === sessionId);
    if (sIdx !== -1) {
      sessions[sIdx].clinicalObservations = filtered;
      saveSessions(sessions);
    }

    // Sync to backend SQLite
    fetch(`/api/sessions/${sessionId}/observations/${observationId}`, {
      method: 'DELETE',
    }).catch((err) => console.error('Failed to delete observation in SQLite:', err));

    return true;
  }
  return false;
}

export function resetToSeedData() {
  localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(INITIAL_PATIENT_PROFILES));
  localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(INITIAL_TEST_SESSIONS));
  localStorage.setItem(STORAGE_KEYS.LABS, JSON.stringify(LABORATORIES));
  localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(INITIAL_ALERT_HISTORY));
  localStorage.setItem(STORAGE_KEYS.SELECTED_PROFILE, INITIAL_PATIENT_PROFILES[0].profileId);
  localStorage.setItem(STORAGE_KEYS.OBSERVATIONS, JSON.stringify(INITIAL_CLINICAL_OBSERVATIONS));
  notify();

  // Reset SQLite Database
  fetch('/api/reset', { method: 'POST' })
    .catch((err) => console.error('Failed to reset SQLite database:', err));
}

// ---------------------------------------------------------------------------
// SQLITE DATABASE MANAGEMENT UTILITIES
// ---------------------------------------------------------------------------

export interface SqliteDbStats {
  filePath: string;
  fileSizeBytes: number;
  fileModified: string;
  patientCount: number;
  sessionCount: number;
  biomarkerResultCount: number;
  alertCount: number;
  laboratoryCount: number;
}

export async function fetchSqliteDbStats(): Promise<SqliteDbStats | null> {
  try {
    const res = await fetch('/api/db/stats');
    const json = await res.json();
    if (json.success) return json.stats;
  } catch (err) {
    console.error('Failed to fetch SQLite stats:', err);
  }
  return null;
}

export async function executeSqliteQuery(query: string): Promise<{ columns: string[]; rows: any[][] }> {
  const res = await fetch('/api/db/sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'SQL query failed');
  }
  return json.result;
}

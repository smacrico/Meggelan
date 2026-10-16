import { TestSession, AlertHistory } from '../types/clinical';
import { addSession } from './storageService';

export type PollingStatus = 'idle' | 'polling' | 'new-results' | 'paused' | 'error';

export interface IncomingLabItem {
  id: string;
  accessionNumber: string;
  hl7ControlId: string;
  sourceLab: string;
  labId: string;
  profileId: string;
  patientName: string;
  collectionDate: string;
  fastingHours: number;
  orderingPhysician: string;
  receivedAt: string;
  status: 'pending' | 'acknowledged' | 'committed';
  urgency: 'Routine' | 'Priority' | 'Panic/Stat';
  summaryDescription: string;
  session: TestSession;
  alerts: AlertHistory[];
}

export interface PollingAuditLogEntry {
  id: string;
  timestamp: string;
  type: 'poll' | 'inbound-received' | 'auto-committed' | 'manual-committed' | 'dismissed' | 'simulated' | 'error';
  httpStatus?: number;
  durationMs?: number;
  message: string;
  details?: string;
}

export interface LabPollingState {
  isPolling: boolean;
  intervalSeconds: number;
  autoCommit: boolean;
  soundNotification: boolean;
  lastPolledAt: string | null;
  nextPollSeconds: number;
  pollCount: number;
  status: PollingStatus;
  pendingItems: IncomingLabItem[];
  recentCommittedIds: string[];
  auditLogs: PollingAuditLogEntry[];
  connectedGateways: Array<{ labId: string; name: string; status: string }>;
}

const STORAGE_KEY_CONFIG = 'hemametric_lab_polling_config_v1';

// Internal state
let state: LabPollingState = {
  isPolling: true,
  intervalSeconds: 20,
  autoCommit: false, // Default to clinical safety: clinician reviews & approves incoming session
  soundNotification: true,
  lastPolledAt: null,
  nextPollSeconds: 20,
  pollCount: 0,
  status: 'idle',
  pendingItems: [],
  recentCommittedIds: [],
  auditLogs: [
    {
      id: `log-init-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'poll',
      message: 'LIS Interface Gateway initialized. Connecting to HL7 v2.5.1 MLLP & FHIR R4 lab feeds...',
    },
  ],
  connectedGateways: [
    { labId: 'lab-quest-01', name: 'Quest Diagnostics Regional', status: 'Online (MLLP 2575)' },
    { labId: 'lab-labcorp-02', name: 'Labcorp Burlington Core Lab', status: 'Online (FHIR R4)' },
    { labId: 'lab-mayo-03', name: 'Mayo Clinic Laboratories', status: 'Online (HL7 TLS)' },
  ],
};

// Load saved preferences if available
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      state.isPolling = parsed.isPolling ?? true;
      state.intervalSeconds = parsed.intervalSeconds ?? 20;
      state.autoCommit = parsed.autoCommit ?? false;
      state.soundNotification = parsed.soundNotification ?? true;
      state.nextPollSeconds = state.intervalSeconds;
    }
  } catch (e) {
    console.error('Failed to load lab polling config', e);
  }
}

function saveConfig() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        STORAGE_KEY_CONFIG,
        JSON.stringify({
          isPolling: state.isPolling,
          intervalSeconds: state.intervalSeconds,
          autoCommit: state.autoCommit,
          soundNotification: state.soundNotification,
        })
      );
    } catch (e) {
      console.error('Failed to save lab polling config', e);
    }
  }
}

type StateListener = (state: LabPollingState) => void;
const listeners = new Set<StateListener>();

function notify() {
  listeners.forEach((l) => l({ ...state, pendingItems: [...state.pendingItems], auditLogs: [...state.auditLogs] }));
}

export function subscribeToPolling(listener: StateListener): () => void {
  listeners.add(listener);
  // Send current state immediately
  listener({ ...state, pendingItems: [...state.pendingItems], auditLogs: [...state.auditLogs] });
  return () => {
    listeners.delete(listener);
  };
}

export function getPollingState(): LabPollingState {
  return { ...state, pendingItems: [...state.pendingItems], auditLogs: [...state.auditLogs] };
}

// Gentle medical notification ping using Web Audio API
function playMedicalChime() {
  if (!state.soundNotification || typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.08, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.5);
  } catch (err) {
    // Audio context may be restricted by autoplay policy before user gesture
  }
}

// Add an audit log entry
function addAuditLog(
  type: PollingAuditLogEntry['type'],
  message: string,
  extra: { httpStatus?: number; durationMs?: number; details?: string } = {}
) {
  const entry: PollingAuditLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    type,
    message,
    httpStatus: extra.httpStatus,
    durationMs: extra.durationMs,
    details: extra.details,
  };

  state.auditLogs.unshift(entry);
  if (state.auditLogs.length > 50) {
    state.auditLogs.pop();
  }
}

// ---------------------------------------------------------------------------
// CORE POLLING ENGINE
// ---------------------------------------------------------------------------

let pollTimerId: any = null;
let countdownTimerId: any = null;

export async function pollNow(profileId?: string): Promise<{ count: number; items: IncomingLabItem[] }> {
  state.status = 'polling';
  notify();

  const startTime = Date.now();
  let url = '/api/lab-feed/poll';
  if (profileId) {
    url += `?profileId=${encodeURIComponent(profileId)}`;
  }

  try {
    const res = await fetch(url);
    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const incoming: IncomingLabItem[] = Array.isArray(data.incoming) ? data.incoming : [];

    state.lastPolledAt = new Date().toISOString();
    state.pollCount += 1;
    state.nextPollSeconds = state.intervalSeconds;

    // Filter items that haven't been committed yet
    const existingIds = new Set(state.pendingItems.map((p) => p.id));
    const committedIds = new Set(state.recentCommittedIds);
    const newItems = incoming.filter((item) => !existingIds.has(item.id) && !committedIds.has(item.session?.sessionId));

    if (newItems.length > 0) {
      state.pendingItems = [...newItems, ...state.pendingItems];
      state.status = 'new-results';

      addAuditLog(
        'inbound-received',
        `Discovered ${newItems.length} incoming lab result session(s) from LIS feed: ${newItems.map((n) => n.accessionNumber).join(', ')}`,
        { httpStatus: 200, durationMs, details: `Source labs: ${newItems.map((n) => n.sourceLab).join('; ')}` }
      );

      playMedicalChime();

      // If Auto-Commit is enabled, automatically inject into SQLite and local store
      if (state.autoCommit) {
        for (const item of newItems) {
          await commitPendingItem(item.id, true);
        }
      }
    } else {
      state.status = 'idle';
      addAuditLog('poll', `LIS Feed poll complete (${durationMs}ms) - 0 new test sessions pending`, {
        httpStatus: 200,
        durationMs,
      });
    }

    notify();
    return { count: newItems.length, items: newItems };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    state.status = 'error';
    addAuditLog('error', `LIS Feed polling error: ${err.message}`, { durationMs });
    notify();
    return { count: 0, items: [] };
  }
}

export async function simulateIncomingResult(
  scenario: 'routine' | 'cardiac-inflammatory' | 'hepatic-flare' | 'cbc-infection-panic' = 'routine',
  profileId: string = 'pat-eleanor-01',
  labId?: string
): Promise<IncomingLabItem | null> {
  const startTime = Date.now();
  try {
    const res = await fetch('/api/lab-feed/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, profileId, labId }),
    });

    const durationMs = Date.now() - startTime;
    if (!res.ok) {
      throw new Error(`Simulation failed: ${res.statusText}`);
    }

    const data = await res.json();
    const item: IncomingLabItem = data.item;

    addAuditLog(
      'simulated',
      `Simulated incoming LIS test session: [${item.accessionNumber}] ${item.patientName} (${item.summaryDescription})`,
      { httpStatus: 200, durationMs }
    );

    // Immediately trigger poll to pick it up
    await pollNow();
    return item;
  } catch (err: any) {
    addAuditLog('error', `Failed to simulate incoming LIS test session: ${err.message}`);
    notify();
    return null;
  }
}

export async function commitPendingItem(itemIdOrSessionId: string, isAuto: boolean = false): Promise<boolean> {
  const idx = state.pendingItems.findIndex(
    (item) => item.id === itemIdOrSessionId || item.session?.sessionId === itemIdOrSessionId
  );

  if (idx === -1) return false;

  const item = state.pendingItems[idx];
  // Remove from pending
  state.pendingItems.splice(idx, 1);
  state.recentCommittedIds.push(item.session.sessionId);

  // Mark session as verified or completed
  const sessionToCommit: TestSession = {
    ...item.session,
    status: 'Verified',
  };

  // Commit to storage & SQLite
  addSession(sessionToCommit, item.alerts || []);

  // Acknowledge on server LIS feed
  fetch('/api/lab-feed/acknowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: item.id, sessionId: item.session.sessionId }),
  }).catch((err) => console.warn('Could not acknowledge feed item on server:', err));

  addAuditLog(
    isAuto ? 'auto-committed' : 'manual-committed',
    `${isAuto ? 'Auto-committed' : 'Clinician verified & committed'} lab session [${item.accessionNumber}] for ${item.patientName} (${item.session.results.length} biomarkers) to SQLite database`,
    { details: `Session ID: ${item.session.sessionId}` }
  );

  notify();
  return true;
}

export async function commitAllPending(): Promise<number> {
  const items = [...state.pendingItems];
  let committed = 0;
  for (const item of items) {
    const ok = await commitPendingItem(item.id, false);
    if (ok) committed++;
  }
  return committed;
}

export async function dismissPendingItem(itemIdOrSessionId: string): Promise<boolean> {
  const idx = state.pendingItems.findIndex(
    (item) => item.id === itemIdOrSessionId || item.session?.sessionId === itemIdOrSessionId
  );

  if (idx === -1) return false;

  const item = state.pendingItems[idx];
  state.pendingItems.splice(idx, 1);

  // Acknowledge on server so it doesn't reappear
  fetch('/api/lab-feed/acknowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: item.id, sessionId: item.session?.sessionId }),
  }).catch(() => {});

  addAuditLog(
    'dismissed',
    `Dismissed incoming lab session [${item.accessionNumber}] for ${item.patientName} from ingestion staging queue`
  );

  notify();
  return true;
}

export function clearAuditLogs() {
  state.auditLogs = [];
  notify();
}

// ---------------------------------------------------------------------------
// TIMING CONTROLS
// ---------------------------------------------------------------------------

function runCountdown() {
  if (!state.isPolling) return;
  state.nextPollSeconds -= 1;
  if (state.nextPollSeconds <= 0) {
    state.nextPollSeconds = state.intervalSeconds;
    pollNow();
  }
  notify();
}

export function startPolling(intervalSeconds?: number) {
  if (intervalSeconds) {
    state.intervalSeconds = intervalSeconds;
  }
  state.isPolling = true;
  state.status = 'idle';
  state.nextPollSeconds = state.intervalSeconds;
  saveConfig();

  clearInterval(countdownTimerId);
  countdownTimerId = setInterval(runCountdown, 1000);

  // Initial poll on startup
  pollNow();
}

export function stopPolling() {
  state.isPolling = false;
  state.status = 'paused';
  clearInterval(countdownTimerId);
  saveConfig();
  notify();
}

export function togglePolling() {
  if (state.isPolling) {
    stopPolling();
  } else {
    startPolling();
  }
}

export function setIntervalSeconds(seconds: number) {
  state.intervalSeconds = Math.max(5, Math.min(300, seconds));
  state.nextPollSeconds = state.intervalSeconds;
  saveConfig();
  notify();
}

export function setAutoCommit(enabled: boolean) {
  state.autoCommit = enabled;
  saveConfig();
  notify();
}

export function setSoundNotification(enabled: boolean) {
  state.soundNotification = enabled;
  saveConfig();
  notify();
}

// Auto-start polling on module load in browser
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (state.isPolling) {
      startPolling();
    }
  }, 1000);
}

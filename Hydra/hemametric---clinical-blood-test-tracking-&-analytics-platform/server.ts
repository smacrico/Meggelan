import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  getDb,
  getDbStats,
  exportDbBuffer,
  getAllProfiles,
  saveOrUpdateProfileDb,
  getAllSessions,
  addSessionDb,
  updateSessionNotesDb,
  deleteSessionDb,
  getAllLaboratories,
  getAllAlerts,
  acknowledgeAlertDb,
  executeRawSql,
  resetDatabaseToSeed,
  getSessionObservationsDb,
  saveSessionObservationDb,
  deleteSessionObservationDb,
} from './server/sqliteDatabase';
import {
  getPendingFeedItems,
  getAllFeedItems,
  acknowledgeFeedItem,
  generateSimulatedLabSession,
  clearFeedQueue,
} from './server/mockLisFeed';
import {
  generatePatientTrendSummary,
  SummaryTone,
  TimeHorizon,
} from './server/aiTrendSummaryService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// SQLITE API ENDPOINTS
// ---------------------------------------------------------------------------

// Database Status & File Statistics
app.get('/api/db/stats', async (_req: Request, res: Response) => {
  try {
    await getDb();
    const stats = getDbStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download Raw SQLite Database File
app.get('/api/db/export', async (_req: Request, res: Response) => {
  try {
    await getDb();
    const buffer = exportDbBuffer();
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', 'attachment; filename="hemametric.sqlite"');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Run Custom SQL Query on SQLite Database
app.post('/api/db/sql', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ success: false, error: 'Query is required' });
      return;
    }
    const result = await executeRawSql(query);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Patient Profiles
app.get('/api/profiles', async (_req: Request, res: Response) => {
  try {
    const profiles = await getAllProfiles();
    res.json({ success: true, profiles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/profiles', async (req: Request, res: Response) => {
  try {
    const profile = req.body;
    await saveOrUpdateProfileDb(profile);
    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test Sessions
app.get('/api/sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = await getAllSessions();
    res.json({ success: true, sessions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sessions', async (req: Request, res: Response) => {
  try {
    const { session, alerts } = req.body;
    await addSessionDb(session, alerts || []);
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/sessions/:id/notes', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, notesHtml, author } = req.body;
    await updateSessionNotesDb(id, notes, notesHtml, author);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteSessionDb(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clinical Observations for Test Sessions
app.get('/api/sessions/:id/observations', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const observations = await getSessionObservationsDb(id);
    res.json({ success: true, observations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sessions/:id/observations', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const observation = req.body;
    await saveSessionObservationDb(id, observation);
    res.json({ success: true, observation });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/sessions/:sessionId/observations/:obsId', async (req: Request, res: Response) => {
  try {
    const { sessionId, obsId } = req.params;
    await deleteSessionObservationDb(sessionId, obsId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Laboratories
app.get('/api/labs', async (_req: Request, res: Response) => {
  try {
    const labs = await getAllLaboratories();
    res.json({ success: true, labs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alerts
app.get('/api/alerts', async (_req: Request, res: Response) => {
  try {
    const alerts = await getAllAlerts();
    res.json({ success: true, alerts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/alerts/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { clinicianName } = req.body;
    await acknowledgeAlertDb(id, clinicianName || 'Dr. Clinical Reviewer');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset Database to Seed Data
app.post('/api/reset', async (_req: Request, res: Response) => {
  try {
    await resetDatabaseToSeed();
    res.json({ success: true, message: 'SQLite database reset to original clinical seed data' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// REAL-TIME LABORATORY MOCK API POLLING & HL7 FEED ENDPOINTS
// ---------------------------------------------------------------------------

// Poll for pending incoming lab results
app.get('/api/lab-feed/poll', (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string | undefined;
    const pending = getPendingFeedItems(profileId);
    res.json({
      success: true,
      connected: true,
      channel: 'HL7 v2.5.1 / FHIR R4 Inbound LIS Gateway',
      endpoint: 'mllp://lis-gateway.questdiagnostics.com:2575',
      polledAt: new Date().toISOString(),
      pendingCount: pending.length,
      incoming: pending,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simulate a new incoming lab result from LIS
app.post('/api/lab-feed/simulate', (req: Request, res: Response) => {
  try {
    const options = req.body || {};
    const created = generateSimulatedLabSession(options);
    res.json({
      success: true,
      message: 'New laboratory test session generated in LIS incoming queue',
      item: created,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Acknowledge an ingested or reviewed feed item
app.post('/api/lab-feed/acknowledge', (req: Request, res: Response) => {
  try {
    const { id, sessionId } = req.body;
    const target = id || sessionId;
    if (!target) {
      res.status(400).json({ success: false, error: 'id or sessionId is required' });
      return;
    }
    const acked = acknowledgeFeedItem(target);
    res.json({ success: true, acknowledged: acked });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// LIS status & all items
app.get('/api/lab-feed/status', (_req: Request, res: Response) => {
  try {
    const all = getAllFeedItems();
    const pending = getPendingFeedItems();
    res.json({
      success: true,
      connected: true,
      uptimeSeconds: Math.floor(process.uptime()),
      totalInboundCount: all.length,
      pendingCount: pending.length,
      connectedGateways: [
        { labId: 'lab-quest-01', name: 'Quest Diagnostics Regional', status: 'Online (MLLP 2575)' },
        { labId: 'lab-labcorp-02', name: 'Labcorp Burlington Core Lab', status: 'Online (FHIR R4)' },
        { labId: 'lab-mayo-03', name: 'Mayo Clinic Laboratories', status: 'Online (HL7 over TLS)' },
      ],
      items: all,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/lab-feed/clear', (_req: Request, res: Response) => {
  try {
    clearFeedQueue();
    res.json({ success: true, message: 'LIS incoming feed queue cleared' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// AI-POWERED PATIENT BLOOD TEST TREND SUMMARY (GEMINI 3.8 FLASH)
// ---------------------------------------------------------------------------
app.post('/api/ai/trends-summary', async (req: Request, res: Response) => {
  try {
    let { profile, sessions, profileId, tone, horizon } = req.body;

    tone = (tone as SummaryTone) || 'specialist';
    horizon = (horizon as TimeHorizon) || 'all';

    // If profile and sessions not provided directly in body, fetch from SQLite
    if (!profile || !sessions) {
      if (!profileId) {
        res.status(400).json({ success: false, error: 'profileId or profile & sessions is required' });
        return;
      }
      const allProfs = await getAllProfiles();
      profile = allProfs.find((p) => p.profileId === profileId);
      if (!profile) {
        res.status(404).json({ success: false, error: `Profile ${profileId} not found` });
        return;
      }
      const allSess = await getAllSessions();
      sessions = allSess.filter((s) => s.profileId === profileId);
    }

    if (!sessions || sessions.length < 2) {
      res.status(400).json({
        success: false,
        error: 'At least two test sessions are required to analyze longitudinal biomarker trends.',
      });
      return;
    }

    const summaryResult = await generatePatientTrendSummary(profile, sessions, tone, horizon);
    res.json(summaryResult);
  } catch (err: any) {
    console.error('[AI Trend Summary] Error processing trend summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// VITE DEV SERVER / STATIC ASSETS
// ---------------------------------------------------------------------------

async function startServer() {
  // Ensure SQLite DB is initialized
  console.log('[SQLite] Initializing SQLite database...');
  await getDb();
  console.log('[SQLite] Database initialized and verified.');

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite dev middleware in development
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HemaMetric Server] Server listening on http://0.0.0.0:${PORT}`);
    console.log(`[HemaMetric Server] SQLite Database: ./hemametric.sqlite`);
  });
}

startServer().catch((err) => {
  console.error('[HemaMetric Server] Fatal error starting server:', err);
  process.exit(1);
});

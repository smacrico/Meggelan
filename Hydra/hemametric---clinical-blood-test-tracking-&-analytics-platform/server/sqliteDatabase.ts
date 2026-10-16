import initSqlJs, { Database } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import {
  INITIAL_PATIENT_PROFILES,
  INITIAL_TEST_SESSIONS,
  LABORATORIES,
  INITIAL_ALERT_HISTORY,
} from '../src/data/seedData';
import {
  PatientProfile,
  Laboratory,
  TestSession,
  BiomarkerResult,
  DerivedMetric,
  AlertHistory,
} from '../src/types/clinical';

const DB_FILE_PATH = path.resolve(process.cwd(), 'hemametric.sqlite');

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE_PATH);
      dbInstance = new SQL.Database(fileBuffer);
      // Run migrations / verify tables
      initTables(dbInstance);
      return dbInstance;
    } catch (err) {
      console.error('Failed to load existing SQLite database, creating new:', err);
    }
  }

  dbInstance = new SQL.Database();
  initTables(dbInstance);
  seedInitialData(dbInstance);
  persistDb();

  return dbInstance;
}

export function persistDb() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE_PATH, buffer);
  } catch (err) {
    console.error('Error persisting SQLite database to disk:', err);
  }
}

export function getDbStats() {
  let fileSizeBytes = 0;
  let fileModified = new Date().toISOString();
  if (fs.existsSync(DB_FILE_PATH)) {
    const stat = fs.statSync(DB_FILE_PATH);
    fileSizeBytes = stat.size;
    fileModified = stat.mtime.toISOString();
  }

  if (!dbInstance) {
    return {
      filePath: DB_FILE_PATH,
      fileSizeBytes,
      fileModified,
      patientCount: 0,
      sessionCount: 0,
      biomarkerResultCount: 0,
      alertCount: 0,
      laboratoryCount: 0,
    };
  }

  const patientCount = dbInstance.exec('SELECT COUNT(*) as c FROM patient_profiles')[0]?.values[0][0] as number || 0;
  const sessionCount = dbInstance.exec('SELECT COUNT(*) as c FROM test_sessions')[0]?.values[0][0] as number || 0;
  const biomarkerResultCount = dbInstance.exec('SELECT COUNT(*) as c FROM biomarker_results')[0]?.values[0][0] as number || 0;
  const alertCount = dbInstance.exec('SELECT COUNT(*) as c FROM alerts')[0]?.values[0][0] as number || 0;
  const laboratoryCount = dbInstance.exec('SELECT COUNT(*) as c FROM laboratories')[0]?.values[0][0] as number || 0;

  return {
    filePath: DB_FILE_PATH,
    fileSizeBytes,
    fileModified,
    patientCount,
    sessionCount,
    biomarkerResultCount,
    alertCount,
    laboratoryCount,
  };
}

export function exportDbBuffer(): Buffer {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }
  const data = dbInstance.export();
  return Buffer.from(data);
}

function initTables(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS laboratories (
      lab_id TEXT PRIMARY KEY,
      lab_name TEXT NOT NULL,
      country TEXT,
      city TEXT,
      accreditation TEXT,
      license_number TEXT
    );

    CREATE TABLE IF NOT EXISTS patient_profiles (
      profile_id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      dob TEXT NOT NULL,
      gender TEXT NOT NULL,
      blood_type TEXT,
      mrn TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      medical_conditions_json TEXT,
      medications_json TEXT,
      created_date TEXT
    );

    CREATE TABLE IF NOT EXISTS test_sessions (
      session_id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      lab_id TEXT NOT NULL,
      collection_date TEXT NOT NULL,
      fasting_hours REAL NOT NULL,
      report_file TEXT,
      notes TEXT,
      notes_html TEXT,
      notes_last_edited_at TEXT,
      notes_author TEXT,
      ordering_physician TEXT NOT NULL,
      status TEXT NOT NULL,
      created_date TEXT,
      FOREIGN KEY (profile_id) REFERENCES patient_profiles(profile_id),
      FOREIGN KEY (lab_id) REFERENCES laboratories(lab_id)
    );

    CREATE TABLE IF NOT EXISTS biomarker_results (
      result_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      biomarker_id TEXT NOT NULL,
      result_value REAL NOT NULL,
      unit_measured TEXT NOT NULL,
      ref_low REAL NOT NULL,
      ref_high REAL NOT NULL,
      status TEXT NOT NULL,
      flag TEXT,
      notes TEXT,
      FOREIGN KEY (session_id) REFERENCES test_sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS derived_metrics (
      metric_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      unit TEXT NOT NULL,
      status TEXT NOT NULL,
      target_optimal_range TEXT,
      formula_description TEXT,
      clinical_interpretation TEXT,
      reference_cutoff TEXT,
      FOREIGN KEY (session_id) REFERENCES test_sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      alert_id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      result_id TEXT,
      severity TEXT NOT NULL,
      biomarker_name TEXT NOT NULL,
      value_recorded REAL,
      reference_interval TEXT,
      message TEXT NOT NULL,
      clinical_guideline TEXT NOT NULL,
      generated_on TEXT NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      acknowledged_by TEXT,
      acknowledged_at TEXT,
      FOREIGN KEY (profile_id) REFERENCES patient_profiles(profile_id),
      FOREIGN KEY (session_id) REFERENCES test_sessions(session_id)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS clinical_observations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      author TEXT NOT NULL,
      role TEXT,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      narrative TEXT NOT NULL,
      related_biomarkers_json TEXT,
      last_edited_at TEXT,
      FOREIGN KEY (session_id) REFERENCES test_sessions(session_id)
    );
  `);
}

export function seedInitialData(db: Database) {
  // Clear any existing
  db.run('DELETE FROM alerts');
  db.run('DELETE FROM derived_metrics');
  db.run('DELETE FROM biomarker_results');
  db.run('DELETE FROM test_sessions');
  db.run('DELETE FROM patient_profiles');
  db.run('DELETE FROM laboratories');

  // Insert Labs
  for (const lab of LABORATORIES) {
    db.run(
      'INSERT INTO laboratories (lab_id, lab_name, country, city, accreditation, license_number) VALUES (?, ?, ?, ?, ?, ?)',
      [lab.labId, lab.labName, lab.country, lab.city, lab.accreditation, lab.licenseNumber]
    );
  }

  // Insert Patient Profiles
  for (const p of INITIAL_PATIENT_PROFILES) {
    db.run(
      `INSERT INTO patient_profiles (profile_id, first_name, last_name, dob, gender, blood_type, mrn, email, phone, medical_conditions_json, medications_json, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.profileId,
        p.firstName,
        p.lastName,
        p.dob,
        p.gender,
        p.bloodType || null,
        p.mrn,
        p.email,
        p.phone,
        JSON.stringify(p.medicalConditions),
        JSON.stringify(p.medications),
        p.createdDate,
      ]
    );
  }

  // Insert Sessions, Results, Derived Metrics
  for (const sess of INITIAL_TEST_SESSIONS) {
    db.run(
      `INSERT INTO test_sessions (session_id, profile_id, lab_id, collection_date, fasting_hours, report_file, notes, notes_html, notes_last_edited_at, notes_author, ordering_physician, status, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sess.sessionId,
        sess.profileId,
        sess.labId,
        sess.collectionDate,
        sess.fastingHours,
        sess.reportFile || null,
        sess.notes,
        sess.notesHtml || sess.notes,
        sess.notesLastEditedAt || null,
        sess.notesAuthor || sess.orderingPhysician,
        sess.orderingPhysician,
        sess.status,
        sess.createdDate,
      ]
    );

    // Results
    for (const r of sess.results) {
      db.run(
        `INSERT INTO biomarker_results (result_id, session_id, biomarker_id, result_value, unit_measured, ref_low, ref_high, status, flag, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.resultId,
          sess.sessionId,
          r.biomarkerId,
          r.resultValue,
          r.unitMeasured,
          r.refLow,
          r.refHigh,
          r.status,
          r.flag || null,
          r.notes || null,
        ]
      );
    }

    // Derived metrics
    for (const dm of sess.derivedMetrics) {
      db.run(
        `INSERT INTO derived_metrics (metric_id, session_id, metric_name, metric_value, unit, status, target_optimal_range, formula_description, clinical_interpretation, reference_cutoff)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dm.metricId,
          sess.sessionId,
          dm.metricName,
          dm.metricValue,
          dm.unit,
          dm.status,
          dm.targetOptimalRange,
          dm.formulaDescription,
          dm.clinicalInterpretation,
          dm.referenceCutoff,
        ]
      );
    }
  }

  // Insert Alerts
  for (const a of INITIAL_ALERT_HISTORY) {
    db.run(
      `INSERT INTO alerts (alert_id, profile_id, session_id, result_id, severity, biomarker_name, value_recorded, reference_interval, message, clinical_guideline, generated_on, acknowledged, acknowledged_by, acknowledged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        a.alertId,
        a.profileId,
        a.sessionId,
        a.resultId || null,
        a.severity,
        a.biomarkerName,
        a.valueRecorded || null,
        a.referenceInterval || null,
        a.message,
        a.clinicalGuideline,
        a.generatedOn,
        a.acknowledged ? 1 : 0,
        a.acknowledgedBy || null,
        a.acknowledgedAt || null,
      ]
    );
  }

  // Default active profile setting
  db.run(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    ['selected_profile_id', INITIAL_PATIENT_PROFILES[0].profileId]
  );
}

// ---------------------------------------------------------------------------
// DATA ACCESS FUNCTIONS
// ---------------------------------------------------------------------------

export async function getAllLaboratories(): Promise<Laboratory[]> {
  const db = await getDb();
  const res = db.exec('SELECT lab_id, lab_name, country, city, accreditation, license_number FROM laboratories');
  if (!res.length || !res[0].values) return [];

  return res[0].values.map((v) => ({
    labId: v[0] as string,
    labName: v[1] as string,
    country: v[2] as string,
    city: v[3] as string,
    accreditation: v[4] as string,
    licenseNumber: v[5] as string,
  }));
}

export async function getAllProfiles(): Promise<PatientProfile[]> {
  const db = await getDb();
  const res = db.exec(
    'SELECT profile_id, first_name, last_name, dob, gender, blood_type, mrn, email, phone, medical_conditions_json, medications_json, created_date FROM patient_profiles ORDER BY last_name ASC'
  );
  if (!res.length || !res[0].values) return [];

  return res[0].values.map((v) => ({
    profileId: v[0] as string,
    firstName: v[1] as string,
    lastName: v[2] as string,
    dob: v[3] as string,
    gender: v[4] as any,
    bloodType: (v[5] as string) || undefined,
    mrn: v[6] as string,
    email: v[7] as string,
    phone: v[8] as string,
    medicalConditions: v[9] ? JSON.parse(v[9] as string) : [],
    medications: v[10] ? JSON.parse(v[10] as string) : [],
    createdDate: v[11] as string,
  }));
}

export async function saveOrUpdateProfileDb(p: PatientProfile): Promise<void> {
  const db = await getDb();
  db.run(
    `INSERT INTO patient_profiles (profile_id, first_name, last_name, dob, gender, blood_type, mrn, email, phone, medical_conditions_json, medications_json, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_id) DO UPDATE SET
       first_name=excluded.first_name,
       last_name=excluded.last_name,
       dob=excluded.dob,
       gender=excluded.gender,
       blood_type=excluded.blood_type,
       mrn=excluded.mrn,
       email=excluded.email,
       phone=excluded.phone,
       medical_conditions_json=excluded.medical_conditions_json,
       medications_json=excluded.medications_json`,
    [
      p.profileId,
      p.firstName,
      p.lastName,
      p.dob,
      p.gender,
      p.bloodType || null,
      p.mrn,
      p.email,
      p.phone,
      JSON.stringify(p.medicalConditions),
      JSON.stringify(p.medications),
      p.createdDate || new Date().toISOString(),
    ]
  );
  persistDb();
}

export async function getAllSessions(): Promise<TestSession[]> {
  const db = await getDb();
  const sessionRes = db.exec(
    `SELECT session_id, profile_id, lab_id, collection_date, fasting_hours, report_file, notes, notes_html, notes_last_edited_at, notes_author, ordering_physician, status, created_date
     FROM test_sessions
     ORDER BY collection_date ASC`
  );

  if (!sessionRes.length || !sessionRes[0].values) return [];

  // Query all results
  const resultsRes = db.exec(
    `SELECT result_id, session_id, biomarker_id, result_value, unit_measured, ref_low, ref_high, status, flag, notes
     FROM biomarker_results`
  );

  const resultsBySession = new Map<string, BiomarkerResult[]>();
  if (resultsRes.length && resultsRes[0].values) {
    for (const v of resultsRes[0].values) {
      const sId = v[1] as string;
      const list = resultsBySession.get(sId) || [];
      list.push({
        resultId: v[0] as string,
        sessionId: sId,
        biomarkerId: v[2] as string,
        resultValue: v[3] as number,
        unitMeasured: v[4] as string,
        refLow: v[5] as number,
        refHigh: v[6] as number,
        status: v[7] as any,
        flag: (v[8] as string) || undefined,
        notes: (v[9] as string) || undefined,
      });
      resultsBySession.set(sId, list);
    }
  }

  // Query all derived metrics
  const derivedRes = db.exec(
    `SELECT metric_id, session_id, metric_name, metric_value, unit, status, target_optimal_range, formula_description, clinical_interpretation, reference_cutoff
     FROM derived_metrics`
  );

  const derivedBySession = new Map<string, DerivedMetric[]>();
  if (derivedRes.length && derivedRes[0].values) {
    for (const v of derivedRes[0].values) {
      const sId = v[1] as string;
      const list = derivedBySession.get(sId) || [];
      list.push({
        metricId: v[0] as string,
        sessionId: sId,
        metricName: v[2] as string,
        metricValue: v[3] as number,
        unit: v[4] as string,
        status: v[5] as any,
        targetOptimalRange: v[6] as string,
        formulaDescription: v[7] as string,
        clinicalInterpretation: v[8] as string,
        referenceCutoff: v[9] as string,
      });
      derivedBySession.set(sId, list);
    }
  }

  return sessionRes[0].values.map((v) => {
    const sId = v[0] as string;
    return {
      sessionId: sId,
      profileId: v[1] as string,
      labId: v[2] as string,
      collectionDate: v[3] as string,
      fastingHours: v[4] as number,
      reportFile: (v[5] as string) || undefined,
      notes: (v[6] as string) || '',
      notesHtml: (v[7] as string) || (v[6] as string) || '',
      notesLastEditedAt: (v[8] as string) || undefined,
      notesAuthor: (v[9] as string) || undefined,
      orderingPhysician: v[10] as string,
      status: v[11] as any,
      createdDate: v[12] as string,
      results: resultsBySession.get(sId) || [],
      derivedMetrics: derivedBySession.get(sId) || [],
    };
  });
}

export async function addSessionDb(sess: TestSession, newAlerts: AlertHistory[] = []): Promise<void> {
  const db = await getDb();

  db.run(
    `INSERT INTO test_sessions (session_id, profile_id, lab_id, collection_date, fasting_hours, report_file, notes, notes_html, notes_last_edited_at, notes_author, ordering_physician, status, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sess.sessionId,
      sess.profileId,
      sess.labId,
      sess.collectionDate,
      sess.fastingHours,
      sess.reportFile || null,
      sess.notes,
      sess.notesHtml || sess.notes,
      sess.notesLastEditedAt || null,
      sess.notesAuthor || sess.orderingPhysician,
      sess.orderingPhysician,
      sess.status,
      sess.createdDate || new Date().toISOString(),
    ]
  );

  for (const r of sess.results) {
    db.run(
      `INSERT INTO biomarker_results (result_id, session_id, biomarker_id, result_value, unit_measured, ref_low, ref_high, status, flag, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.resultId,
        sess.sessionId,
        r.biomarkerId,
        r.resultValue,
        r.unitMeasured,
        r.refLow,
        r.refHigh,
        r.status,
        r.flag || null,
        r.notes || null,
      ]
    );
  }

  for (const dm of sess.derivedMetrics) {
    db.run(
      `INSERT INTO derived_metrics (metric_id, session_id, metric_name, metric_value, unit, status, target_optimal_range, formula_description, clinical_interpretation, reference_cutoff)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dm.metricId,
        sess.sessionId,
        dm.metricName,
        dm.metricValue,
        dm.unit,
        dm.status,
        dm.targetOptimalRange,
        dm.formulaDescription,
        dm.clinicalInterpretation,
        dm.referenceCutoff,
      ]
    );
  }

  if (newAlerts && newAlerts.length > 0) {
    for (const a of newAlerts) {
      db.run(
        `INSERT INTO alerts (alert_id, profile_id, session_id, result_id, severity, biomarker_name, value_recorded, reference_interval, message, clinical_guideline, generated_on, acknowledged, acknowledged_by, acknowledged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.alertId,
          a.profileId,
          a.sessionId,
          a.resultId || null,
          a.severity,
          a.biomarkerName,
          a.valueRecorded || null,
          a.referenceInterval || null,
          a.message,
          a.clinicalGuideline,
          a.generatedOn,
          a.acknowledged ? 1 : 0,
          a.acknowledgedBy || null,
          a.acknowledgedAt || null,
        ]
      );
    }
  }

  persistDb();
}

export async function updateSessionNotesDb(
  sessionId: string,
  notes: string,
  notesHtml?: string,
  author?: string
): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();

  db.run(
    `UPDATE test_sessions
     SET notes = ?, notes_html = ?, notes_last_edited_at = ?, notes_author = ?
     WHERE session_id = ?`,
    [notes, notesHtml || notes, now, author || 'Clinical Attending', sessionId]
  );

  persistDb();
  return true;
}

export async function deleteSessionDb(sessionId: string): Promise<boolean> {
  const db = await getDb();
  db.run('DELETE FROM alerts WHERE session_id = ?', [sessionId]);
  db.run('DELETE FROM derived_metrics WHERE session_id = ?', [sessionId]);
  db.run('DELETE FROM biomarker_results WHERE session_id = ?', [sessionId]);
  db.run('DELETE FROM test_sessions WHERE session_id = ?', [sessionId]);
  persistDb();
  return true;
}

export async function getAllAlerts(): Promise<AlertHistory[]> {
  const db = await getDb();
  const res = db.exec(
    `SELECT alert_id, profile_id, session_id, result_id, severity, biomarker_name, value_recorded, reference_interval, message, clinical_guideline, generated_on, acknowledged, acknowledged_by, acknowledged_at
     FROM alerts
     ORDER BY generated_on DESC`
  );

  if (!res.length || !res[0].values) return [];

  return res[0].values.map((v) => ({
    alertId: v[0] as string,
    profileId: v[1] as string,
    sessionId: v[2] as string,
    resultId: (v[3] as string) || undefined,
    severity: v[4] as any,
    biomarkerName: v[5] as string,
    valueRecorded: (v[6] as number) || undefined,
    referenceInterval: (v[7] as string) || undefined,
    message: v[8] as string,
    clinicalGuideline: v[9] as string,
    generatedOn: v[10] as string,
    acknowledged: Boolean(v[11]),
    acknowledgedBy: (v[12] as string) || undefined,
    acknowledgedAt: (v[13] as string) || undefined,
  }));
}

export async function acknowledgeAlertDb(
  alertId: string,
  clinicianName: string = 'Dr. Clinical Reviewer'
): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(
    `UPDATE alerts
     SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ?
     WHERE alert_id = ?`,
    [clinicianName, now, alertId]
  );
  persistDb();
  return true;
}

export async function getSessionObservationsDb(sessionId: string): Promise<any[]> {
  const db = await getDb();
  const res = db.exec(
    `SELECT id, session_id, timestamp, author, role, category, priority, narrative, related_biomarkers_json, last_edited_at
     FROM clinical_observations
     WHERE session_id = ?
     ORDER BY timestamp DESC`,
    [sessionId]
  );
  if (!res.length || !res[0].values) return [];
  return res[0].values.map((v) => ({
    id: v[0] as string,
    sessionId: v[1] as string,
    timestamp: v[2] as string,
    author: v[3] as string,
    role: (v[4] as string) || undefined,
    category: v[5] as string,
    priority: v[6] as string,
    narrative: v[7] as string,
    relatedBiomarkers: v[8] ? JSON.parse(v[8] as string) : [],
    lastEditedAt: (v[9] as string) || undefined,
  }));
}

export async function saveSessionObservationDb(sessionId: string, obs: any): Promise<void> {
  const db = await getDb();
  db.run(
    `INSERT INTO clinical_observations (id, session_id, timestamp, author, role, category, priority, narrative, related_biomarkers_json, last_edited_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       author = excluded.author,
       role = excluded.role,
       category = excluded.category,
       priority = excluded.priority,
       narrative = excluded.narrative,
       related_biomarkers_json = excluded.related_biomarkers_json,
       last_edited_at = excluded.last_edited_at`,
    [
      obs.id,
      sessionId,
      obs.timestamp || new Date().toISOString(),
      obs.author,
      obs.role || null,
      obs.category,
      obs.priority,
      obs.narrative,
      JSON.stringify(obs.relatedBiomarkers || []),
      obs.lastEditedAt || new Date().toISOString(),
    ]
  );
  persistDb();
}

export async function deleteSessionObservationDb(sessionId: string, obsId: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM clinical_observations WHERE session_id = ? AND id = ?', [sessionId, obsId]);
  persistDb();
}

export async function executeRawSql(sqlQuery: string): Promise<{ columns: string[]; rows: any[][] }> {
  const db = await getDb();
  const res = db.exec(sqlQuery);
  if (!res.length) {
    persistDb();
    return { columns: [], rows: [] };
  }
  persistDb();
  return {
    columns: res[0].columns,
    rows: res[0].values,
  };
}

export async function resetDatabaseToSeed(): Promise<void> {
  const db = await getDb();
  seedInitialData(db);
  persistDb();
}

/**
 * Real-Time Laboratory Information System (LIS) Mock Feed Generator
 * Simulates inbound HL7 v2.5.1 ORU_R01 / FHIR DiagnosticReport feeds
 * from clinical pathology providers (Quest Diagnostics, Labcorp, Mayo Clinic Laboratories).
 */

export interface QueuedLabFeedItem {
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
  session: any;
  alerts: any[];
}

let feedCounter = 1001;
const queue: QueuedLabFeedItem[] = [];

// Seed an initial incoming item ready for discovery
function seedInitialFeed() {
  if (queue.length > 0) return;

  const now = new Date();
  const sessionDate = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sessionId = `sess-lis-quest-${Date.now()}`;
  const accession = `QL-2026-${feedCounter++}`;

  queue.push({
    id: `feed-item-${Date.now()}-1`,
    accessionNumber: accession,
    hl7ControlId: `MSH|^~\\&|QUEST_DIAGNOSTICS|LIS_NODE_12|HEMAMETRIC|CLINIC_EHR|${now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}||ORU^R01|MSG${feedCounter}|P|2.5.1`,
    sourceLab: 'Quest Diagnostics Regional Reference Lab',
    labId: 'lab-quest-01',
    profileId: 'pat-eleanor-01',
    patientName: 'Eleanor Vance',
    collectionDate: sessionDate,
    fastingHours: 12,
    orderingPhysician: 'Dr. Sarah Jenkins, MD',
    receivedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
    status: 'pending',
    urgency: 'Routine',
    summaryDescription: 'Routine Follow-up: Comprehensive Metabolic & Lipid Subfraction Panel',
    session: {
      sessionId,
      profileId: 'pat-eleanor-01',
      labId: 'lab-quest-01',
      collectionDate: sessionDate,
      fastingHours: 12,
      orderingPhysician: 'Dr. Sarah Jenkins, MD',
      status: 'Pending Review',
      notes: 'Automated real-time feed ingestion from Quest Diagnostics LIS gateway (Accession #' + accession + '). Awaiting clinician sign-off.',
      notesHtml: '<p>Automated real-time feed ingestion from Quest Diagnostics LIS gateway (Accession #' + accession + '). Awaiting clinician sign-off.</p>',
      notesAuthor: 'Quest LIS Interface Engine',
      createdDate: new Date().toISOString(),
      results: [
        {
          resultId: `res-${sessionId}-glu`,
          sessionId,
          biomarkerId: 'bm-glu',
          resultValue: 98,
          unitMeasured: 'mg/dL',
          refLow: 70,
          refHigh: 99,
          status: 'Normal',
        },
        {
          resultId: `res-${sessionId}-hba1c`,
          sessionId,
          biomarkerId: 'bm-hba1c',
          resultValue: 5.7,
          unitMeasured: '%',
          refLow: 4.0,
          refHigh: 5.6,
          status: 'High',
          flag: 'H',
        },
        {
          resultId: `res-${sessionId}-chol`,
          sessionId,
          biomarkerId: 'bm-chol',
          resultValue: 196,
          unitMeasured: 'mg/dL',
          refLow: 125,
          refHigh: 200,
          status: 'Normal',
        },
        {
          resultId: `res-${sessionId}-ldl`,
          sessionId,
          biomarkerId: 'bm-ldl',
          resultValue: 104,
          unitMeasured: 'mg/dL',
          refLow: 50,
          refHigh: 100,
          status: 'High',
          flag: 'H',
        },
        {
          resultId: `res-${sessionId}-hdl`,
          sessionId,
          biomarkerId: 'bm-hdl',
          resultValue: 62,
          unitMeasured: 'mg/dL',
          refLow: 50,
          refHigh: 90,
          status: 'Normal',
        },
        {
          resultId: `res-${sessionId}-tg`,
          sessionId,
          biomarkerId: 'bm-tg',
          resultValue: 130,
          unitMeasured: 'mg/dL',
          refLow: 35,
          refHigh: 150,
          status: 'Normal',
        },
        {
          resultId: `res-${sessionId}-crp`,
          sessionId,
          biomarkerId: 'bm-crp',
          resultValue: 1.1,
          unitMeasured: 'mg/L',
          refLow: 0.1,
          refHigh: 3.0,
          status: 'Normal',
        },
        {
          resultId: `res-${sessionId}-creat`,
          sessionId,
          biomarkerId: 'bm-creat',
          resultValue: 0.88,
          unitMeasured: 'mg/dL',
          refLow: 0.5,
          refHigh: 1.1,
          status: 'Normal',
        },
        {
          resultId: `res-${sessionId}-alt`,
          sessionId,
          biomarkerId: 'bm-alt',
          resultValue: 24,
          unitMeasured: 'U/L',
          refLow: 7,
          refHigh: 35,
          status: 'Normal',
        },
      ],
      derivedMetrics: [
        {
          metricId: `dm-${sessionId}-tghdl`,
          sessionId,
          metricName: 'Triglyceride / HDL Ratio',
          metricValue: 2.1,
          unit: 'ratio',
          status: 'Borderline',
          targetOptimalRange: '< 2.0',
          formulaDescription: 'Triglycerides / HDL Cholesterol',
          clinicalInterpretation: 'Borderline ratio; lifestyle modification indicated.',
          referenceCutoff: '< 2.0',
        },
        {
          metricId: `dm-${sessionId}-nonhdl`,
          sessionId,
          metricName: 'Non-HDL Cholesterol',
          metricValue: 134,
          unit: 'mg/dL',
          status: 'Elevated',
          targetOptimalRange: '< 130',
          formulaDescription: 'Total Cholesterol - HDL Cholesterol',
          clinicalInterpretation: 'Borderline elevated atherogenic cholesterol particles.',
          referenceCutoff: '< 130 mg/dL',
        },
      ],
    },
    alerts: [
      {
        alertId: `alt-lis-${Date.now()}-1`,
        profileId: 'pat-eleanor-01',
        sessionId,
        severity: 'Warning',
        biomarkerName: 'Hemoglobin A1c',
        valueRecorded: 5.7,
        referenceInterval: '4.0 - 5.6 %',
        message: 'Hemoglobin A1c out of standard range (5.7 %, expected 4.0-5.6).',
        clinicalGuideline: 'Early prediabetes screening threshold per ADA guidelines.',
        generatedOn: now.toISOString(),
        acknowledged: false,
      },
    ],
  });
}

seedInitialFeed();

export function getPendingFeedItems(profileId?: string): QueuedLabFeedItem[] {
  if (profileId) {
    return queue.filter((item) => item.status === 'pending' && item.profileId === profileId);
  }
  return queue.filter((item) => item.status === 'pending');
}

export function getAllFeedItems(): QueuedLabFeedItem[] {
  return [...queue];
}

export function acknowledgeFeedItem(itemIdOrSessionId: string): boolean {
  const item = queue.find(
    (q) => q.id === itemIdOrSessionId || q.session?.sessionId === itemIdOrSessionId
  );
  if (item) {
    item.status = 'acknowledged';
    return true;
  }
  return false;
}

export function clearFeedQueue() {
  queue.length = 0;
}

export interface SimulationOptions {
  scenario?: 'routine' | 'cardiac-inflammatory' | 'hepatic-flare' | 'cbc-infection-panic';
  profileId?: string;
  patientName?: string;
  labId?: string;
  sourceLab?: string;
  orderingPhysician?: string;
}

export function generateSimulatedLabSession(options: SimulationOptions = {}): QueuedLabFeedItem {
  const scenario = options.scenario || 'routine';
  const profileId = options.profileId || 'pat-eleanor-01';
  const patientName =
    options.patientName ||
    (profileId === 'pat-marcus-02'
      ? 'Marcus Chen'
      : profileId === 'pat-sofia-03'
      ? 'Sofia Rodriguez'
      : 'Eleanor Vance');

  const now = new Date();
  const sessionDate = now.toISOString().split('T')[0];
  const sessionId = `sess-lis-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const accession = `LC-${now.getFullYear()}-${feedCounter++}`;

  let labId = options.labId || 'lab-labcorp-02';
  let sourceLab = options.sourceLab || 'Labcorp Burlington Core Laboratory';
  let urgency: 'Routine' | 'Priority' | 'Panic/Stat' = 'Routine';
  let summary = 'Standard Inbound Lab Session';
  let results: any[] = [];
  let alerts: any[] = [];
  let derivedMetrics: any[] = [];

  if (scenario === 'cardiac-inflammatory') {
    urgency = 'Priority';
    summary = 'Cardiovascular & Acute Systemic Inflammatory Biomarkers Panel';
    results = [
      {
        resultId: `res-${sessionId}-crp`,
        sessionId,
        biomarkerId: 'bm-crp',
        resultValue: 4.8,
        unitMeasured: 'mg/L',
        refLow: 0.1,
        refHigh: 3.0,
        status: 'High',
        flag: 'H',
      },
      {
        resultId: `res-${sessionId}-chol`,
        sessionId,
        biomarkerId: 'bm-chol',
        resultValue: 228,
        unitMeasured: 'mg/dL',
        refLow: 125,
        refHigh: 200,
        status: 'High',
        flag: 'H',
      },
      {
        resultId: `res-${sessionId}-ldl`,
        sessionId,
        biomarkerId: 'bm-ldl',
        resultValue: 148,
        unitMeasured: 'mg/dL',
        refLow: 50,
        refHigh: 100,
        status: 'High',
        flag: 'H',
      },
      {
        resultId: `res-${sessionId}-hdl`,
        sessionId,
        biomarkerId: 'bm-hdl',
        resultValue: 44,
        unitMeasured: 'mg/dL',
        refLow: 50,
        refHigh: 90,
        status: 'Low',
        flag: 'L',
      },
      {
        resultId: `res-${sessionId}-tg`,
        sessionId,
        biomarkerId: 'bm-tg',
        resultValue: 180,
        unitMeasured: 'mg/dL',
        refLow: 35,
        refHigh: 150,
        status: 'High',
        flag: 'H',
      },
      {
        resultId: `res-${sessionId}-glu`,
        sessionId,
        biomarkerId: 'bm-glu',
        resultValue: 104,
        unitMeasured: 'mg/dL',
        refLow: 70,
        refHigh: 99,
        status: 'High',
        flag: 'H',
      },
    ];
    alerts.push({
      alertId: `alt-lis-${Date.now()}-crp`,
      profileId,
      sessionId,
      severity: 'Warning',
      biomarkerName: 'High Sensitivity CRP',
      valueRecorded: 4.8,
      referenceInterval: '0.1 - 3.0 mg/L',
      message: 'High Sensitivity CRP markedly elevated at 4.8 mg/L indicating active vascular inflammation or tissue stress.',
      clinicalGuideline: 'AHA/CDC risk stratifies hs-CRP > 3.0 mg/L as high relative cardiovascular risk.',
      generatedOn: now.toISOString(),
      acknowledged: false,
    });
    derivedMetrics.push({
      metricId: `dm-${sessionId}-tghdl`,
      sessionId,
      metricName: 'Triglyceride / HDL Ratio',
      metricValue: 4.09,
      unit: 'ratio',
      status: 'High Risk',
      targetOptimalRange: '< 2.0',
      formulaDescription: 'Triglycerides / HDL Cholesterol',
      clinicalInterpretation: 'Substantial atherogenic dyslipidemia and insulin resistance indicator.',
      referenceCutoff: '< 2.0',
    });
  } else if (scenario === 'hepatic-flare') {
    labId = 'lab-mayo-03';
    sourceLab = 'Mayo Clinic Laboratories Rochester';
    urgency = 'Priority';
    summary = 'Comprehensive Hepatic Enzymes & Liver Profile';
    results = [
      {
        resultId: `res-${sessionId}-alt`,
        sessionId,
        biomarkerId: 'bm-alt',
        resultValue: 78,
        unitMeasured: 'U/L',
        refLow: 7,
        refHigh: 35,
        status: 'High',
        flag: 'H',
      },
      {
        resultId: `res-${sessionId}-ast`,
        sessionId,
        biomarkerId: 'bm-ast',
        resultValue: 62,
        unitMeasured: 'U/L',
        refLow: 10,
        refHigh: 35,
        status: 'High',
        flag: 'H',
      },
      {
        resultId: `res-${sessionId}-ferr`,
        sessionId,
        biomarkerId: 'bm-ferr',
        resultValue: 410,
        unitMeasured: 'ng/mL',
        refLow: 15,
        refHigh: 150,
        status: 'High',
        flag: 'H',
      },
      {
        resultId: `res-${sessionId}-bili`,
        sessionId,
        biomarkerId: 'bm-bili',
        resultValue: 1.1,
        unitMeasured: 'mg/dL',
        refLow: 0.2,
        refHigh: 1.2,
        status: 'Normal',
      },
      {
        resultId: `res-${sessionId}-plt`,
        sessionId,
        biomarkerId: 'bm-plt',
        resultValue: 215,
        unitMeasured: '10^3/uL',
        refLow: 150,
        refHigh: 400,
        status: 'Normal',
      },
    ];
    alerts.push({
      alertId: `alt-lis-${Date.now()}-alt`,
      profileId,
      sessionId,
      severity: 'Warning',
      biomarkerName: 'Alanine Aminotransferase (ALT)',
      valueRecorded: 78,
      referenceInterval: '7 - 35 U/L',
      message: 'ALT acutely elevated (>2x ULN). Evaluate for non-alcoholic fatty liver disease (MASLD), medication hepatotoxicity, or acute hepatic injury.',
      clinicalGuideline: 'ACG clinical guideline for abnormal liver biochemistries.',
      generatedOn: now.toISOString(),
      acknowledged: false,
    });
    derivedMetrics.push({
      metricId: `dm-${sessionId}-de-ritis`,
      sessionId,
      metricName: 'De Ritis Ratio (AST/ALT)',
      metricValue: 0.79,
      unit: 'ratio',
      status: 'Optimal',
      targetOptimalRange: '< 1.0',
      formulaDescription: 'AST / ALT',
      clinicalInterpretation: 'Ratio < 1.0 is characteristic of steatohepatitis/NAFLD rather than alcoholic or cirrhotic etiologies.',
      referenceCutoff: '< 1.0',
    });
  } else if (scenario === 'cbc-infection-panic') {
    urgency = 'Panic/Stat';
    summary = 'STAT CBC & Differential: Severe Leukocytosis & Neutrophilia';
    results = [
      {
        resultId: `res-${sessionId}-wbc`,
        sessionId,
        biomarkerId: 'bm-wbc',
        resultValue: 15.6,
        unitMeasured: '10^3/uL',
        refLow: 4.5,
        refHigh: 11.0,
        status: 'High',
        flag: 'H',
      },
      {
        resultId: `res-${sessionId}-neut`,
        sessionId,
        biomarkerId: 'bm-neut',
        resultValue: 12.1,
        unitMeasured: '10^3/uL',
        refLow: 1.8,
        refHigh: 7.5,
        status: 'High',
        flag: 'H',
      },
      {
        resultId: `res-${sessionId}-lymph`,
        sessionId,
        biomarkerId: 'bm-lymph',
        resultValue: 1.6,
        unitMeasured: '10^3/uL',
        refLow: 1.0,
        refHigh: 4.0,
        status: 'Normal',
      },
      {
        resultId: `res-${sessionId}-hgb`,
        sessionId,
        biomarkerId: 'bm-hgb',
        resultValue: 13.5,
        unitMeasured: 'g/dL',
        refLow: 12.0,
        refHigh: 15.5,
        status: 'Normal',
      },
      {
        resultId: `res-${sessionId}-plt`,
        sessionId,
        biomarkerId: 'bm-plt',
        resultValue: 345,
        unitMeasured: '10^3/uL',
        refLow: 150,
        refHigh: 400,
        status: 'Normal',
      },
      {
        resultId: `res-${sessionId}-crp`,
        sessionId,
        biomarkerId: 'bm-crp',
        resultValue: 18.2,
        unitMeasured: 'mg/L',
        refLow: 0.1,
        refHigh: 3.0,
        status: 'Critical High',
        flag: 'CH',
      },
    ];
    alerts.push({
      alertId: `alt-lis-${Date.now()}-panic`,
      profileId,
      sessionId,
      severity: 'Critical',
      biomarkerName: 'C-Reactive Protein (hs-CRP)',
      valueRecorded: 18.2,
      referenceInterval: '0.1 - 3.0 mg/L',
      message: 'CRITICAL HIGH: CRP at 18.2 mg/L (>6x upper limit) alongside leukocytosis (WBC 15.6). Immediate clinical evaluation for acute bacterial infection or systemic inflammatory storm required.',
      clinicalGuideline: 'Execute STAT clinical alert protocol; evaluate vitals, fever, focal infection sources, or acute coronary syndrome.',
      generatedOn: now.toISOString(),
      acknowledged: false,
    });
    derivedMetrics.push({
      metricId: `dm-${sessionId}-nlr`,
      sessionId,
      metricName: 'NLR (Neutrophil/Lymphocyte)',
      metricValue: 7.56,
      unit: 'ratio',
      status: 'High Risk',
      targetOptimalRange: '1.2 - 2.5',
      formulaDescription: 'Neutrophils / Lymphocytes',
      clinicalInterpretation: 'Marked systemic neutrophilia / stress response exceeding critical threshold (>3.5).',
      referenceCutoff: '< 2.5',
    });
  } else {
    // Routine metabolic & lipid panel
    summary = 'Routine Ambulatory Health Check & Lipid Subfractions';
    results = [
      {
        resultId: `res-${sessionId}-glu`,
        sessionId,
        biomarkerId: 'bm-glu',
        resultValue: 92,
        unitMeasured: 'mg/dL',
        refLow: 70,
        refHigh: 99,
        status: 'Normal',
      },
      {
        resultId: `res-${sessionId}-chol`,
        sessionId,
        biomarkerId: 'bm-chol',
        resultValue: 188,
        unitMeasured: 'mg/dL',
        refLow: 125,
        refHigh: 200,
        status: 'Normal',
      },
      {
        resultId: `res-${sessionId}-hdl`,
        sessionId,
        biomarkerId: 'bm-hdl',
        resultValue: 58,
        unitMeasured: 'mg/dL',
        refLow: 50,
        refHigh: 90,
        status: 'Normal',
      },
      {
        resultId: `res-${sessionId}-ldl`,
        sessionId,
        biomarkerId: 'bm-ldl',
        resultValue: 108,
        unitMeasured: 'mg/dL',
        refLow: 50,
        refHigh: 100,
        status: 'High',
        flag: 'H',
      },
      {
        resultId: `res-${sessionId}-tg`,
        sessionId,
        biomarkerId: 'bm-tg',
        resultValue: 110,
        unitMeasured: 'mg/dL',
        refLow: 35,
        refHigh: 150,
        status: 'Normal',
      },
      {
        resultId: `res-${sessionId}-crp`,
        sessionId,
        biomarkerId: 'bm-crp',
        resultValue: 0.9,
        unitMeasured: 'mg/L',
        refLow: 0.1,
        refHigh: 3.0,
        status: 'Normal',
      },
      {
        resultId: `res-${sessionId}-creat`,
        sessionId,
        biomarkerId: 'bm-creat',
        resultValue: 0.85,
        unitMeasured: 'mg/dL',
        refLow: 0.5,
        refHigh: 1.1,
        status: 'Normal',
      },
    ];
    derivedMetrics.push({
      metricId: `dm-${sessionId}-tghdl`,
      sessionId,
      metricName: 'Triglyceride / HDL Ratio',
      metricValue: 1.9,
      unit: 'ratio',
      status: 'Optimal',
      targetOptimalRange: '< 2.0',
      formulaDescription: 'Triglycerides / HDL Cholesterol',
      clinicalInterpretation: 'Favorable cardiometabolic and insulin sensitivity marker.',
      referenceCutoff: '< 2.0',
    });
  }

  const newFeedItem: QueuedLabFeedItem = {
    id: `feed-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    accessionNumber: accession,
    hl7ControlId: `MSH|^~\\&|${sourceLab.replace(/ /g, '_')}|LIS_R4|HEMAMETRIC|CLINIC_EHR|${now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}||ORU^R01|MSG${feedCounter}|P|2.5.1`,
    sourceLab,
    labId,
    profileId,
    patientName,
    collectionDate: sessionDate,
    fastingHours: 12,
    orderingPhysician: options.orderingPhysician || 'Dr. Sarah Jenkins, MD',
    receivedAt: now.toISOString(),
    status: 'pending',
    urgency,
    summaryDescription: summary,
    session: {
      sessionId,
      profileId,
      labId,
      collectionDate: sessionDate,
      fastingHours: 12,
      orderingPhysician: options.orderingPhysician || 'Dr. Sarah Jenkins, MD',
      status: 'Pending Review',
      notes: `Automated real-time HL7 ORU_R01 feed ingestion from ${sourceLab} (Accession #${accession}). Inbound payload verified.`,
      notesHtml: `<p>Automated real-time HL7 ORU_R01 feed ingestion from <strong>${sourceLab}</strong> (Accession #${accession}). Inbound payload verified.</p>`,
      notesAuthor: 'HL7 LIS Engine',
      createdDate: now.toISOString(),
      results,
      derivedMetrics,
    },
    alerts,
  };

  queue.unshift(newFeedItem);
  return newFeedItem;
}

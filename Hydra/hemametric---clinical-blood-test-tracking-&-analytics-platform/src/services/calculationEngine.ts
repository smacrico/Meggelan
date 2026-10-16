import {
  BiomarkerCatalogItem,
  BiomarkerResult,
  DerivedMetric,
  PatientProfile,
  ResultStatus,
  AlertHistory,
  AlertSeverity,
} from '../types/clinical';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';

export function getBiomarkerCatalogItem(biomarkerId: string): BiomarkerCatalogItem | undefined {
  return MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === biomarkerId);
}

export function evaluateBiomarkerStatus(
  val: number,
  refLow: number,
  refHigh: number,
  criticalLow?: number,
  criticalHigh?: number
): { status: ResultStatus; flag?: string } {
  if (criticalHigh !== undefined && val >= criticalHigh) {
    return { status: 'Critical High', flag: 'CH' };
  }
  if (criticalLow !== undefined && val <= criticalLow) {
    return { status: 'Critical Low', flag: 'CL' };
  }
  if (val > refHigh) {
    return { status: 'High', flag: 'H' };
  }
  if (val < refLow) {
    return { status: 'Low', flag: 'L' };
  }
  return { status: 'Normal' };
}

export function computeDerivedMetrics(
  sessionId: string,
  results: BiomarkerResult[],
  profile?: PatientProfile
): DerivedMetric[] {
  const metrics: DerivedMetric[] = [];
  const map = new Map<string, number>();

  results.forEach((r) => {
    map.set(r.biomarkerId, r.resultValue);
  });

  // 1. NLR (Neutrophil to Lymphocyte Ratio)
  const neut = map.get('bm-neut');
  const lymph = map.get('bm-lymph');
  if (neut !== undefined && lymph !== undefined && lymph > 0) {
    const val = Number((neut / lymph).toFixed(2));
    let status: DerivedMetric['status'] = 'Optimal';
    let interp = 'Normal inflammatory index.';
    if (val > 3.5) {
      status = 'High Risk';
      interp = 'Marked systemic inflammatory activity or stress state.';
    } else if (val > 2.5) {
      status = 'Elevated';
      interp = 'Mild to moderate low-grade systemic inflammation.';
    } else if (val < 1.0) {
      status = 'Borderline';
      interp = 'Low neutrophil count or relative lymphocytosis.';
    }
    metrics.push({
      metricId: `dm-${sessionId}-nlr`,
      sessionId,
      metricName: 'NLR (Neutrophil/Lymphocyte)',
      metricValue: val,
      unit: 'ratio',
      status,
      targetOptimalRange: '1.2 - 2.5',
      formulaDescription: 'Neutrophils / Lymphocytes',
      clinicalInterpretation: interp,
      referenceCutoff: '< 2.5',
    });
  }

  // 2. PLR (Platelet to Lymphocyte Ratio)
  const plt = map.get('bm-plt');
  if (plt !== undefined && lymph !== undefined && lymph > 0) {
    // plt is in 10^3/uL, lymph is in 10^3/uL -> ratio is plt * 1000 / (lymph * 1000) = plt / lymph
    const val = Number((plt / lymph).toFixed(1));
    let status: DerivedMetric['status'] = 'Optimal';
    let interp = 'Normal thrombosis/inflammatory potential.';
    if (val > 200) {
      status = 'High Risk';
      interp = 'Elevated thrombotic-inflammatory risk.';
    } else if (val > 150) {
      status = 'Elevated';
      interp = 'Moderate pro-inflammatory platelet activation.';
    }
    metrics.push({
      metricId: `dm-${sessionId}-plr`,
      sessionId,
      metricName: 'PLR (Platelet/Lymphocyte)',
      metricValue: val,
      unit: 'ratio',
      status,
      targetOptimalRange: '90 - 150',
      formulaDescription: 'Platelets / Lymphocytes',
      clinicalInterpretation: interp,
      referenceCutoff: '< 150',
    });
  }

  // 3. De Ritis Ratio (AST / ALT)
  const ast = map.get('bm-ast');
  const alt = map.get('bm-alt');
  if (ast !== undefined && alt !== undefined && alt > 0) {
    const val = Number((ast / alt).toFixed(2));
    let status: DerivedMetric['status'] = 'Optimal';
    let interp = 'Healthy balanced hepatic transaminases.';
    if (val < 0.8) {
      status = 'Borderline';
      interp = 'AST/ALT < 0.8 frequently corresponds with non-alcoholic fatty liver (MASLD).';
    } else if (val > 2.0) {
      status = 'High Risk';
      interp = 'Ratio > 2.0 highly indicative of alcoholic etiology or advanced fibrosis/cirrhosis.';
    } else if (val > 1.4) {
      status = 'Elevated';
      interp = 'Mild disproportionate AST elevation (muscle damage or progressive fibrosis).';
    }
    metrics.push({
      metricId: `dm-${sessionId}-deritis`,
      sessionId,
      metricName: 'De Ritis Ratio (AST/ALT)',
      metricValue: val,
      unit: 'ratio',
      status,
      targetOptimalRange: '0.8 - 1.4',
      formulaDescription: 'AST / ALT',
      clinicalInterpretation: interp,
      referenceCutoff: '0.8 - 1.4',
    });
  }

  // 4. LDL / HDL Ratio
  const ldl = map.get('bm-ldl');
  const hdl = map.get('bm-hdl');
  if (ldl !== undefined && hdl !== undefined && hdl > 0) {
    const val = Number((ldl / hdl).toFixed(2));
    let status: DerivedMetric['status'] = 'Optimal';
    let interp = 'Optimal atherogenic particle gradient.';
    if (val > 3.5) {
      status = 'High Risk';
      interp = 'High atherogenic cardiovascular burden.';
    } else if (val >= 2.5) {
      status = 'Elevated';
      interp = 'Moderate atherogenic risk; lifestyle or pharmacotherapy review warranted.';
    }
    metrics.push({
      metricId: `dm-${sessionId}-ldlhdl`,
      sessionId,
      metricName: 'LDL / HDL Ratio',
      metricValue: val,
      unit: 'ratio',
      status,
      targetOptimalRange: '< 2.5',
      formulaDescription: 'LDL Cholesterol / HDL Cholesterol',
      clinicalInterpretation: interp,
      referenceCutoff: '< 2.5',
    });
  }

  // 5. Triglyceride / HDL Ratio
  const tg = map.get('bm-tg');
  if (tg !== undefined && hdl !== undefined && hdl > 0) {
    const val = Number((tg / hdl).toFixed(2));
    let status: DerivedMetric['status'] = 'Optimal';
    let interp = 'Optimal insulin sensitivity and lipid particle distribution.';
    if (val > 3.0) {
      status = 'High Risk';
      interp = 'High surrogate marker for insulin resistance, metabolic syndrome, and small dense LDL.';
    } else if (val >= 2.0) {
      status = 'Borderline';
      interp = 'Emerging insulin resistance and hypertriglyceridemic risk.';
    }
    metrics.push({
      metricId: `dm-${sessionId}-tghdl`,
      sessionId,
      metricName: 'Triglyceride / HDL Ratio',
      metricValue: val,
      unit: 'ratio',
      status,
      targetOptimalRange: '< 2.0',
      formulaDescription: 'Triglycerides / HDL Cholesterol',
      clinicalInterpretation: interp,
      referenceCutoff: '< 2.0',
    });
  }

  // 6. Non-HDL Cholesterol
  const chol = map.get('bm-chol');
  if (chol !== undefined && hdl !== undefined) {
    const val = Math.round(chol - hdl);
    let status: DerivedMetric['status'] = 'Optimal';
    let interp = 'Atherogenic apoB particle volume within target.';
    if (val > 160) {
      status = 'High Risk';
      interp = 'Marked atherogenic burden exceeding ESC/AHA guideline cutoffs.';
    } else if (val > 130) {
      status = 'Elevated';
      interp = 'Borderline elevated atherogenic cholesterol.';
    }
    metrics.push({
      metricId: `dm-${sessionId}-nonhdl`,
      sessionId,
      metricName: 'Non-HDL Cholesterol',
      metricValue: val,
      unit: 'mg/dL',
      status,
      targetOptimalRange: '< 130',
      formulaDescription: 'Total Cholesterol - HDL Cholesterol',
      clinicalInterpretation: interp,
      referenceCutoff: '< 130 mg/dL',
    });
  }

  // 7. FIB-4 Index (Fibrosis-4 Score)
  if (profile && ast !== undefined && alt !== undefined && plt !== undefined && alt > 0) {
    const birthYear = new Date(profile.dob).getFullYear();
    const age = new Date().getFullYear() - birthYear;
    // Formula: (Age * AST) / (Platelet * sqrt(ALT))
    const fib4 = Number(((age * ast) / (plt * Math.sqrt(alt))).toFixed(2));
    let status: DerivedMetric['status'] = 'Optimal';
    let interp = 'Low probability of advanced hepatic fibrosis (F3-F4) with high negative predictive value (>90%).';
    if (fib4 > 2.67) {
      status = 'High Risk';
      interp = 'High probability of advanced fibrosis; recommend hepatology referral and elastography (FibroScan).';
    } else if (fib4 >= 1.3) {
      status = 'Borderline';
      interp = 'Indeterminate zone; repeat monitoring in 6-12 months suggested.';
    }
    metrics.push({
      metricId: `dm-${sessionId}-fib4`,
      sessionId,
      metricName: 'FIB-4 Liver Fibrosis Index',
      metricValue: fib4,
      unit: 'score',
      status,
      targetOptimalRange: '< 1.30',
      formulaDescription: '(Age × AST) / (Platelets × √ALT)',
      clinicalInterpretation: interp,
      referenceCutoff: '< 1.30',
    });
  }

  return metrics;
}

export function generateAlertsForSession(
  sessionId: string,
  profileId: string,
  results: BiomarkerResult[],
  previousResults?: BiomarkerResult[]
): AlertHistory[] {
  const alerts: AlertHistory[] = [];
  const now = new Date().toISOString();

  results.forEach((r) => {
    const catalogItem = getBiomarkerCatalogItem(r.biomarkerId);
    const name = catalogItem?.name || r.biomarkerId;

    if (r.status === 'Critical Low' || r.status === 'Critical High') {
      alerts.push({
        alertId: `alt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        profileId,
        sessionId,
        resultId: r.resultId,
        severity: 'Critical',
        biomarkerName: name,
        valueRecorded: r.resultValue,
        referenceInterval: `${r.refLow} - ${r.refHigh} ${r.unitMeasured}`,
        message: `CRITICAL ${r.status.toUpperCase()}: ${name} recorded at ${r.resultValue} ${r.unitMeasured}. Immediate clinician evaluation required.`,
        clinicalGuideline: 'Follow urgent laboratory panic-value notification protocol and clinical stabilization guidelines.',
        generatedOn: now,
        acknowledged: false,
      });
    } else if (r.status === 'High' || r.status === 'Low') {
      alerts.push({
        alertId: `alt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        profileId,
        sessionId,
        resultId: r.resultId,
        severity: 'Warning',
        biomarkerName: name,
        valueRecorded: r.resultValue,
        referenceInterval: `${r.refLow} - ${r.refHigh} ${r.unitMeasured}`,
        message: `${name} out of standard range (${r.resultValue} ${r.unitMeasured}, expected ${r.refLow}-${r.refHigh}).`,
        clinicalGuideline: catalogItem?.clinicalSignificance || 'Monitor in subsequent session and correlate with patient clinical presentation.',
        generatedOn: now,
        acknowledged: false,
      });
    }
  });

  // Check delta if previous results exist
  if (previousResults && previousResults.length > 0) {
    const prevMap = new Map(previousResults.map((pr) => [pr.biomarkerId, pr.resultValue]));
    results.forEach((r) => {
      const prevVal = prevMap.get(r.biomarkerId);
      if (prevVal !== undefined && prevVal > 0) {
        const pctChange = ((r.resultValue - prevVal) / prevVal) * 100;
        const catalogItem = getBiomarkerCatalogItem(r.biomarkerId);
        const name = catalogItem?.name || r.biomarkerId;

        // If sudden jump > 35% in key markers like Ferritin, ALT, or CRP
        if (Math.abs(pctChange) >= 40 && (r.biomarkerId === 'bm-alt' || r.biomarkerId === 'bm-crp' || r.biomarkerId === 'bm-ferr')) {
          alerts.push({
            alertId: `alt-delta-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            profileId,
            sessionId,
            resultId: r.resultId,
            severity: Math.abs(pctChange) >= 60 ? 'Warning' : 'Informational',
            biomarkerName: name,
            valueRecorded: r.resultValue,
            referenceInterval: `${r.refLow} - ${r.refHigh} ${r.unitMeasured}`,
            message: `Longitudinal shift alert: ${name} shifted by ${pctChange > 0 ? '+' : ''}${pctChange.toFixed(1)}% compared to the prior test visit (from ${prevVal} to ${r.resultValue} ${r.unitMeasured}).`,
            clinicalGuideline: 'Review recent patient lifestyle changes, concurrent viral illness, medication adherence, or acute stress events.',
            generatedOn: now,
            acknowledged: false,
          });
        }
      }
    });
  }

  return alerts;
}

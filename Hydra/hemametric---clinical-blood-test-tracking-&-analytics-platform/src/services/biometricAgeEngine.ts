import {
  PatientProfile,
  TestSession,
  BiometricAgeEstimation,
  BiometricAgeDomain,
  BiometricAgeBiomarkerDriver,
  BiometricAgeSessionPoint,
  BiometricAgeRejuvenationLever,
  BiometricAgeWeights,
} from '../types/clinical';
import { evaluateBiomarkerStatus } from './calculationEngine';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';

export type { BiometricAgeWeights } from '../types/clinical';

export const DEFAULT_BIOMETRIC_AGE_WEIGHTS: BiometricAgeWeights = {
  inflammation: 0.30,
  cardiovascular: 0.40,
  metabolic: 0.30,
};

/**
 * Calculates Biometric Age estimation based on weighted analysis of:
 * 1. Inflammation (hs-CRP, leukocyte ratios)
 * 2. Cardiovascular (Lipid panel: LDL, HDL, Triglycerides, TG/HDL ratio)
 * 3. Metabolic (Fasting Glucose, HbA1c)
 * and their longitudinal visit-to-visit trends.
 */
export function calculateBiometricAge(
  profile: PatientProfile,
  sessions: TestSession[],
  weights: BiometricAgeWeights = DEFAULT_BIOMETRIC_AGE_WEIGHTS
): BiometricAgeEstimation {
  // Sort sessions chronologically ascending
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime()
  );

  const latestSession = sortedSessions[sortedSessions.length - 1];
  const refDate = latestSession ? new Date(latestSession.collectionDate) : new Date();
  const dobDate = new Date(profile.dob);

  // Chronological Age (in fractional years to 1 decimal place)
  const msDiff = refDate.getTime() - dobDate.getTime();
  const rawChronoAge = msDiff / (1000 * 60 * 60 * 24 * 365.25);
  const chronologicalAge = Number(Math.max(18, rawChronoAge).toFixed(1));

  if (!latestSession || latestSession.results.length === 0) {
    return createDefaultBiometricAge(chronologicalAge, weights);
  }

  // Extract analyte histories across sessions to compute trajectories
  const biomarkerHistory = new Map<string, { date: string; value: number }[]>();
  sortedSessions.forEach((sess) => {
    sess.results.forEach((r) => {
      const hist = biomarkerHistory.get(r.biomarkerId) || [];
      hist.push({ date: sess.collectionDate, value: r.resultValue });
      biomarkerHistory.set(r.biomarkerId, hist);
    });
  });

  const latestMap = new Map(latestSession.results.map((r) => [r.biomarkerId, r.resultValue]));
  const isFemale = profile.gender === 'Female';

  // Helper to compute directional trend for a biomarker
  const getBiomarkerTrend = (biomarkerId: string): { trend: 'Improving' | 'Stable' | 'Worsening'; annualRate: number } => {
    const hist = biomarkerHistory.get(biomarkerId);
    if (!hist || hist.length < 2) {
      return { trend: 'Stable', annualRate: 0 };
    }
    const first = hist[0];
    const last = hist[hist.length - 1];
    const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
    const years = Math.max(0.1, days / 365.25);
    const rate = (last.value - first.value) / years;

    // For HDL, higher is improving
    if (biomarkerId === 'bm-hdl') {
      if (rate > 2.0) return { trend: 'Improving', annualRate: Number(rate.toFixed(1)) };
      if (rate < -2.0) return { trend: 'Worsening', annualRate: Number(rate.toFixed(1)) };
      return { trend: 'Stable', annualRate: Number(rate.toFixed(1)) };
    }

    // For CRP, LDL, TG, Glucose, HbA1c, higher is worsening
    if (rate > 0.05 * first.value) return { trend: 'Worsening', annualRate: Number(rate.toFixed(1)) };
    if (rate < -0.05 * first.value) return { trend: 'Improving', annualRate: Number(rate.toFixed(1)) };
    return { trend: 'Stable', annualRate: Number(rate.toFixed(1)) };
  };

  // ----------------------------------------------------
  // 1. INFLAMMATION DOMAIN (hs-CRP & systemic cytokine strain)
  // ----------------------------------------------------
  const crpVal = latestMap.get('bm-crp');
  const neutVal = latestMap.get('bm-neut');
  const lymphVal = latestMap.get('bm-lymph');
  const inflDrivers: BiometricAgeBiomarkerDriver[] = [];

  let rawInflDelta = 0;

  if (crpVal !== undefined) {
    const crpTrend = getBiomarkerTrend('bm-crp');
    let crpContribution = 0;
    let crpRationale = '';

    if (crpVal < 0.8) {
      crpContribution = -2.2;
      crpRationale = 'Quiescent systemic cytokine activity; vascular endothelium protected from micro-inflammatory strain.';
    } else if (crpVal <= 1.5) {
      crpContribution = -0.6;
      crpRationale = 'Low-normal inflammatory baseline within standard physiologic boundaries.';
    } else if (crpVal <= 3.0) {
      crpContribution = +1.6;
      crpRationale = 'Mild systemic low-grade inflammation (inflammaging); elevated baseline cytokine signaling.';
    } else if (crpVal <= 5.0) {
      crpContribution = +3.6;
      crpRationale = 'Moderate systemic inflammatory activity; accelerated arterial intima-media stiffening risk.';
    } else if (crpVal <= 10.0) {
      crpContribution = +5.4;
      crpRationale = 'High vascular inflammatory activity exceeding AHA/CDC cardiovascular risk cut-offs.';
    } else {
      crpContribution = +7.5;
      crpRationale = 'Severe acute/subacute inflammatory response accelerating biological senescence.';
    }

    // Trend modifier
    if (crpTrend.trend === 'Improving') {
      crpContribution -= 1.2;
      crpRationale += ' (Favorable downward trajectory reduces inflammatory age load).';
    } else if (crpTrend.trend === 'Worsening') {
      crpContribution += 1.4;
      crpRationale += ' (Progressive upward slope indicates compounding vascular strain).';
    }

    rawInflDelta += crpContribution;

    const crpItem = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === 'bm-crp');
    const crpStatus = evaluateBiomarkerStatus(crpVal, crpItem?.refLowMale || 0.1, crpItem?.refHighMale || 3.0).status;

    inflDrivers.push({
      biomarkerId: 'bm-crp',
      name: 'High-Sensitivity C-Reactive Protein (hs-CRP)',
      value: crpVal,
      unit: 'mg/L',
      optimalRange: '< 0.8 mg/L',
      status: crpStatus,
      trendDirection: crpTrend.trend,
      annualRate: crpTrend.annualRate,
      contributionYears: Number(crpContribution.toFixed(1)),
      clinicalRationale: crpRationale,
    });
  } else {
    // If no CRP, neutral baseline
    rawInflDelta = 0;
  }

  // NLR modifier (leukocyte balance)
  if (neutVal !== undefined && lymphVal !== undefined && lymphVal > 0) {
    const nlr = Number((neutVal / lymphVal).toFixed(2));
    let nlrContrib = 0;
    if (nlr > 3.2) {
      nlrContrib = +1.2;
      rawInflDelta += nlrContrib;
    } else if (nlr < 1.8 && rawInflDelta <= 0) {
      nlrContrib = -0.5;
      rawInflDelta += nlrContrib;
    }

    inflDrivers.push({
      biomarkerId: 'dm-nlr',
      name: 'Neutrophil-to-Lymphocyte Ratio (NLR)',
      value: nlr,
      unit: 'ratio',
      optimalRange: '1.2 - 2.5',
      status: nlr > 3.0 ? 'High' : 'Normal',
      trendDirection: 'Stable',
      contributionYears: Number(nlrContrib.toFixed(1)),
      clinicalRationale: nlr > 2.8 ? 'Elevated leukocyte activation indicating systemic cellular stress.' : 'Balanced innate and adaptive leukocyte ratio.',
    });
  }

  // Clamp raw inflammation delta to clinically realistic bounds (-4.0 to +8.5 years)
  rawInflDelta = Math.min(8.5, Math.max(-4.0, rawInflDelta));

  // ----------------------------------------------------
  // 2. CARDIOVASCULAR DOMAIN (Lipid Panel & Atherogenic Index)
  // ----------------------------------------------------
  const ldlVal = latestMap.get('bm-ldl');
  const hdlVal = latestMap.get('bm-hdl');
  const tgVal = latestMap.get('bm-tg');
  const cholVal = latestMap.get('bm-chol');
  const cardioDrivers: BiometricAgeBiomarkerDriver[] = [];

  let rawCardioDelta = 0;

  // LDL contribution
  if (ldlVal !== undefined) {
    const ldlTrend = getBiomarkerTrend('bm-ldl');
    let ldlContrib = 0;
    let ldlRationale = '';

    if (ldlVal < 80) {
      ldlContrib = -1.8;
      ldlRationale = 'Optimal atherogenic particle count; minimal coronary plaque deposition velocity.';
    } else if (ldlVal < 100) {
      ldlContrib = -0.5;
      ldlRationale = 'Desirable LDL concentration protecting long-term arterial elasticity.';
    } else if (ldlVal <= 129) {
      ldlContrib = +0.8;
      ldlRationale = 'Borderline atherogenic exposure with mild endothelial oxidation vulnerability.';
    } else if (ldlVal <= 159) {
      ldlContrib = +2.4;
      ldlRationale = 'Elevated circulating atherogenic particles promoting sub-endothelial retention.';
    } else {
      ldlContrib = +4.5;
      ldlRationale = 'Marked hypercholesterolemia markedly accelerating vascular tree aging.';
    }

    if (ldlTrend.trend === 'Improving') {
      ldlContrib -= 0.8;
      ldlRationale += ' (Downwards trajectory shows effective lipid management).';
    } else if (ldlTrend.trend === 'Worsening') {
      ldlContrib += 1.0;
      ldlRationale += ' (Rising concentration compounds atherogenic risk).';
    }

    rawCardioDelta += ldlContrib;
    cardioDrivers.push({
      biomarkerId: 'bm-ldl',
      name: 'LDL Cholesterol',
      value: ldlVal,
      unit: 'mg/dL',
      optimalRange: '< 90 mg/dL',
      status: evaluateBiomarkerStatus(ldlVal, 50, 100).status,
      trendDirection: ldlTrend.trend,
      annualRate: ldlTrend.annualRate,
      contributionYears: Number(ldlContrib.toFixed(1)),
      clinicalRationale: ldlRationale,
    });
  }

  // HDL contribution (protective vs deficiency)
  if (hdlVal !== undefined) {
    const hdlTrend = getBiomarkerTrend('bm-hdl');
    let hdlContrib = 0;
    let hdlRationale = '';
    const hdlLowCutoff = isFemale ? 50 : 40;

    if (hdlVal >= 65) {
      hdlContrib = -1.6;
      hdlRationale = 'Robust reverse cholesterol transport and antioxidant enzyme protection.';
    } else if (hdlVal >= hdlLowCutoff) {
      hdlContrib = 0.0;
      hdlRationale = 'Standard protective high-density lipoprotein reserve.';
    } else {
      hdlContrib = +2.0;
      hdlRationale = 'Hypoalphalipoproteinemia; impaired macrophage cholesterol efflux accelerating vascular aging.';
    }

    if (hdlTrend.trend === 'Improving') {
      hdlContrib -= 0.6;
    } else if (hdlTrend.trend === 'Worsening') {
      hdlContrib += 0.8;
    }

    rawCardioDelta += hdlContrib;
    cardioDrivers.push({
      biomarkerId: 'bm-hdl',
      name: 'HDL Cholesterol',
      value: hdlVal,
      unit: 'mg/dL',
      optimalRange: isFemale ? '> 55 mg/dL' : '> 50 mg/dL',
      status: evaluateBiomarkerStatus(hdlVal, hdlLowCutoff, 90).status,
      trendDirection: hdlTrend.trend,
      annualRate: hdlTrend.annualRate,
      contributionYears: Number(hdlContrib.toFixed(1)),
      clinicalRationale: hdlRationale,
    });
  }

  // Triglycerides contribution
  if (tgVal !== undefined) {
    const tgTrend = getBiomarkerTrend('bm-tg');
    let tgContrib = 0;
    let tgRationale = '';

    if (tgVal < 90) {
      tgContrib = -1.0;
      tgRationale = 'Favorable insulin sensitivity and low remnant lipoprotein burden.';
    } else if (tgVal <= 149) {
      tgContrib = 0.0;
      tgRationale = 'Normal fasting circulating triglyceride levels.';
    } else if (tgVal <= 199) {
      tgContrib = +1.5;
      tgRationale = 'Hypertriglyceridemia reflecting postprandial lipemia and hepatic VLDL overproduction.';
    } else {
      tgContrib = +3.2;
      tgRationale = 'Substantial remnant cholesterol burden promoting atherogenic microvascular shear.';
    }

    if (tgTrend.trend === 'Improving') tgContrib -= 0.7;
    else if (tgTrend.trend === 'Worsening') tgContrib += 0.9;

    rawCardioDelta += tgContrib;
    cardioDrivers.push({
      biomarkerId: 'bm-tg',
      name: 'Triglycerides',
      value: tgVal,
      unit: 'mg/dL',
      optimalRange: '< 100 mg/dL',
      status: evaluateBiomarkerStatus(tgVal, 40, 150).status,
      trendDirection: tgTrend.trend,
      annualRate: tgTrend.annualRate,
      contributionYears: Number(tgContrib.toFixed(1)),
      clinicalRationale: tgRationale,
    });
  }

  // Triglyceride to HDL ratio modifier (proxy for small dense LDL particles)
  if (tgVal !== undefined && hdlVal !== undefined && hdlVal > 0) {
    const tgHdl = Number((tgVal / hdlVal).toFixed(2));
    if (tgHdl > 3.5) {
      const tgHdlContrib = 1.0;
      rawCardioDelta += tgHdlContrib;
      cardioDrivers.push({
        biomarkerId: 'dm-tg-hdl',
        name: 'Triglyceride / HDL Ratio',
        value: tgHdl,
        unit: 'ratio',
        optimalRange: '< 2.0',
        status: 'High',
        trendDirection: 'Stable',
        contributionYears: tgHdlContrib,
        clinicalRationale: 'Elevated ratio strongly correlates with dense atherogenic LDL-P phenotype and hepatic steatosis.',
      });
    }
  }

  rawCardioDelta = Math.min(8.5, Math.max(-4.5, rawCardioDelta));

  // ----------------------------------------------------
  // 3. METABOLIC DOMAIN (Glycemic Control, HbA1c & AGEs)
  // ----------------------------------------------------
  const gluVal = latestMap.get('bm-glu');
  const a1cVal = latestMap.get('bm-hba1c');
  const metabDrivers: BiometricAgeBiomarkerDriver[] = [];

  let rawMetabDelta = 0;

  if (a1cVal !== undefined) {
    const a1cTrend = getBiomarkerTrend('bm-hba1c');
    let a1cContrib = 0;
    let a1cRationale = '';

    if (a1cVal < 5.2) {
      a1cContrib = -2.2;
      a1cRationale = 'Minimal macromolecular protein glycation; preserved vascular and microcapillary elasticity.';
    } else if (a1cVal <= 5.6) {
      a1cContrib = 0.0;
      a1cRationale = 'Physiologic euglycemia without accelerated advanced glycation end-product (AGE) accumulation.';
    } else if (a1cVal <= 6.4) {
      a1cContrib = +3.2;
      a1cRationale = 'Impaired glucose tolerance / pre-diabetes accelerating vascular cross-linking and organ biological aging.';
    } else {
      a1cContrib = +6.2;
      a1cRationale = 'Overt glucotoxicity and endothelial capillary basement membrane thickening.';
    }

    if (a1cTrend.trend === 'Improving') {
      a1cContrib -= 1.0;
      a1cRationale += ' (Favorable glycemic stabilization trend).';
    } else if (a1cTrend.trend === 'Worsening') {
      a1cContrib += 1.4;
      a1cRationale += ' (Emerging glycemic creep accelerates systemic tissue aging).';
    }

    rawMetabDelta += a1cContrib;
    metabDrivers.push({
      biomarkerId: 'bm-hba1c',
      name: 'Hemoglobin A1c (HbA1c)',
      value: a1cVal,
      unit: '%',
      optimalRange: '< 5.4%',
      status: evaluateBiomarkerStatus(a1cVal, 4.0, 5.6).status,
      trendDirection: a1cTrend.trend,
      annualRate: a1cTrend.annualRate,
      contributionYears: Number(a1cContrib.toFixed(1)),
      clinicalRationale: a1cRationale,
    });
  }

  if (gluVal !== undefined) {
    const gluTrend = getBiomarkerTrend('bm-glu');
    let gluContrib = 0;
    let gluRationale = '';

    if (gluVal < 88) {
      gluContrib = -1.0;
      gluRationale = 'Optimal fasting glucose with high insulin sensitivity.';
    } else if (gluVal <= 99) {
      gluContrib = 0.0;
      gluRationale = 'Normal homeostatic fasting plasma glucose.';
    } else if (gluVal <= 125) {
      gluContrib = +1.8;
      gluRationale = 'Impaired fasting glucose indicating early peripheral insulin resistance.';
    } else {
      gluContrib = +3.5;
      gluRationale = 'Persistent hyperglycemia accelerating metabolic senescence.';
    }

    if (gluTrend.trend === 'Improving') gluContrib -= 0.6;
    else if (gluTrend.trend === 'Worsening') gluContrib += 0.8;

    rawMetabDelta += gluContrib;
    metabDrivers.push({
      biomarkerId: 'bm-glu',
      name: 'Fasting Plasma Glucose',
      value: gluVal,
      unit: 'mg/dL',
      optimalRange: '75 - 90 mg/dL',
      status: evaluateBiomarkerStatus(gluVal, 70, 99).status,
      trendDirection: gluTrend.trend,
      annualRate: gluTrend.annualRate,
      contributionYears: Number(gluContrib.toFixed(1)),
      clinicalRationale: gluRationale,
    });
  }

  rawMetabDelta = Math.min(8.0, Math.max(-4.0, rawMetabDelta));

  // ----------------------------------------------------
  // WEIGHTED AGGREGATION & AGING PACE
  // ----------------------------------------------------
  const totalWeight = Math.max(0.01, weights.inflammation + weights.cardiovascular + weights.metabolic);
  const normWeightInfl = weights.inflammation / totalWeight;
  const normWeightCardio = weights.cardiovascular / totalWeight;
  const normWeightMetab = weights.metabolic / totalWeight;

  const weightedInflDelta = Number((rawInflDelta * normWeightInfl).toFixed(2));
  const weightedCardioDelta = Number((rawCardioDelta * normWeightCardio).toFixed(2));
  const weightedMetabDelta = Number((rawMetabDelta * normWeightMetab).toFixed(2));

  const totalAgeDelta = Number((weightedInflDelta + weightedCardioDelta + weightedMetabDelta).toFixed(1));
  const biometricAge = Number(Math.max(18, chronologicalAge + totalAgeDelta).toFixed(1));

  // Aging velocity / pace (e.g. 0.88x or 1.15x)
  const agingPace = Number(Math.max(0.65, Math.min(1.65, 1 + (totalAgeDelta / chronologicalAge))).toFixed(2));

  // Aging Tier Classification
  let agingTier: BiometricAgeEstimation['agingTier'] = 'Synchronized';
  if (totalAgeDelta <= -2.5) {
    agingTier = 'Optimized / Youthful';
  } else if (totalAgeDelta <= -0.5) {
    agingTier = 'Synchronized';
  } else if (totalAgeDelta <= 1.5) {
    agingTier = 'Mild Acceleration';
  } else if (totalAgeDelta <= 4.0) {
    agingTier = 'Accelerated Aging';
  } else {
    agingTier = 'Marked Biological Acceleration';
  }

  // Domain Statuses
  const getDomainStatus = (rawDelta: number): BiometricAgeDomain['status'] => {
    if (rawDelta <= -1.0) return 'Youthful / Optimized';
    if (rawDelta <= 1.0) return 'Synchronized';
    if (rawDelta <= 3.0) return 'Accelerated Aging';
    return 'Marked Acceleration';
  };

  const domainInfl: BiometricAgeDomain = {
    domain: 'Inflammation',
    label: 'Inflammatory Aging (Cytokine & Microvascular)',
    weight: normWeightInfl,
    ageDelta: weightedInflDelta,
    rawAgeDelta: Number(rawInflDelta.toFixed(1)),
    status: getDomainStatus(rawInflDelta),
    drivingBiomarkers: inflDrivers,
    clinicalSummary:
      rawInflDelta <= -1.0
        ? 'Optimal anti-inflammatory longevity phenotype. Low hs-CRP and balanced leukocyte ratios protect vascular elasticity.'
        : rawInflDelta <= 1.0
        ? 'Normal baseline inflammatory markers without acute cytokine acceleration.'
        : 'Elevated systemic inflammatory burden (inflammaging) accelerates arterial stiffening and cellular senescence.',
    optimizationAdvice:
      rawInflDelta > 0
        ? 'Implement anti-inflammatory protocols: high-dose EPA/DHA omega-3, dietary polyphenol density, and adequate sleep to suppress hs-CRP.'
        : 'Maintain quiescent inflammatory tone with regular moderate-intensity exercise and balanced nutrition.',
  };

  const domainCardio: BiometricAgeDomain = {
    domain: 'Cardiovascular',
    label: 'Cardiovascular Aging (Atherogenic Lipids)',
    weight: normWeightCardio,
    ageDelta: weightedCardioDelta,
    rawAgeDelta: Number(rawCardioDelta.toFixed(1)),
    status: getDomainStatus(rawCardioDelta),
    drivingBiomarkers: cardioDrivers,
    clinicalSummary:
      rawCardioDelta <= -1.0
        ? 'Cardioprotective lipid profile with favorable HDL reserves and low atherogenic particle exposure.'
        : rawCardioDelta <= 1.0
        ? 'Balanced lipid parameters with standard age-related cardiovascular risk.'
        : 'Elevated atherogenic cholesterol and triglyceride load, accelerating vascular biological wear.',
    optimizationAdvice:
      rawCardioDelta > 0
        ? 'Target LDL < 90 mg/dL and TG/HDL ratio < 2.0 via soluble dietary fiber, aerobic conditioning, and targeted lipid-lowering therapy if indicated.'
        : 'Sustain high HDL and low TG through ongoing cardiovascular conditioning and healthy dietary fats.',
  };

  const domainMetab: BiometricAgeDomain = {
    domain: 'Metabolic',
    label: 'Metabolic Aging (Glycemic & Protein Glycation)',
    weight: normWeightMetab,
    ageDelta: weightedMetabDelta,
    rawAgeDelta: Number(rawMetabDelta.toFixed(1)),
    status: getDomainStatus(rawMetabDelta),
    drivingBiomarkers: metabDrivers,
    clinicalSummary:
      rawMetabDelta <= -1.0
        ? 'Youthful metabolic efficiency. Tight glycemic control prevents advanced glycation end-product (AGE) accumulation.'
        : rawMetabDelta <= 1.0
        ? 'Euglycemic baseline; normal cellular carbohydrate processing.'
        : 'Elevated glycemic variability or HbA1c elevation accelerating microvascular and metabolic cellular aging.',
    optimizationAdvice:
      rawMetabDelta > 0
        ? 'Reverse glycemic creep: implement postprandial walking, resistance training to increase muscle glucose disposal, and minimize refined carbohydrates.'
        : 'Continue metabolic longevity practices: intermittent fasting or carb-conscious balanced whole-food meals.',
  };

  // ----------------------------------------------------
  // HISTORICAL TRAJECTORY ACROSS ALL TEST SESSIONS
  // ----------------------------------------------------
  const historicalTrajectory: BiometricAgeSessionPoint[] = sortedSessions.map((sess) => {
    const sDate = new Date(sess.collectionDate);
    const sChrono = Number(Math.max(18, (sDate.getTime() - dobDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1));

    // Calculate approximate session delta based on session's results
    const sRes = new Map(sess.results.map((r) => [r.biomarkerId, r.resultValue]));
    let sInfl = 0;
    let sCardio = 0;
    let sMetab = 0;

    const sCrp = sRes.get('bm-crp');
    if (sCrp !== undefined) {
      sInfl = sCrp < 1.0 ? -1.5 : sCrp <= 3.0 ? +1.2 : +3.5;
    }

    const sLdl = sRes.get('bm-ldl');
    const sTg = sRes.get('bm-tg');
    const sHdl = sRes.get('bm-hdl');
    if (sLdl !== undefined) sCardio += sLdl < 100 ? -1.0 : sLdl <= 130 ? +0.8 : +2.5;
    if (sTg !== undefined && sTg > 150) sCardio += 1.2;
    if (sHdl !== undefined && sHdl < (isFemale ? 50 : 40)) sCardio += 1.2;

    const sA1c = sRes.get('bm-hba1c');
    const sGlu = sRes.get('bm-glu');
    if (sA1c !== undefined) sMetab += sA1c < 5.4 ? -1.5 : sA1c <= 5.7 ? 0 : +2.5;
    else if (sGlu !== undefined) sMetab += sGlu < 95 ? -0.5 : +1.5;

    const sDelta = Number((sInfl * normWeightInfl + sCardio * normWeightCardio + sMetab * normWeightMetab).toFixed(1));
    const sBio = Number(Math.max(18, sChrono + sDelta).toFixed(1));

    return {
      sessionId: sess.sessionId,
      collectionDate: sess.collectionDate,
      chronologicalAge: sChrono,
      biometricAge: sBio,
      deltaYears: sDelta,
    };
  });

  // ----------------------------------------------------
  // REJUVENATION & OPTIMIZATION LEVERS
  // ----------------------------------------------------
  const levers: BiometricAgeRejuvenationLever[] = [];

  if (crpVal !== undefined && crpVal > 1.2) {
    levers.push({
      title: 'Targeted Systemic hs-CRP Suppression',
      impactYears: -1.8,
      description: 'Lowering hs-CRP from current level to < 0.8 mg/L via high-dose EPA/DHA omega-3 (2-3g/day) and low-glycemic Mediterranean nutrition reduces biological vascular strain by ~1.8 years.',
      targetBiomarkers: ['hs-CRP', 'Neutrophil/Lymphocyte Ratio'],
    });
  }

  if ((ldlVal !== undefined && ldlVal > 110) || (tgVal !== undefined && tgVal > 130)) {
    levers.push({
      title: 'Atherogenic Lipid & TG/HDL Ratio Normalization',
      impactYears: -2.2,
      description: 'Optimizing LDL to < 90 mg/dL and Triglycerides to < 100 mg/dL through dietary saturated fat moderation and zone-2 cardiovascular training rolls back ~2.2 years of arterial aging.',
      targetBiomarkers: ['LDL Cholesterol', 'Triglycerides', 'HDL Cholesterol'],
    });
  }

  if ((a1cVal !== undefined && a1cVal >= 5.5) || (gluVal !== undefined && gluVal > 95)) {
    levers.push({
      title: 'Glycemic Stability & Insulin Sensitivity Restoration',
      impactYears: -1.6,
      description: 'Reducing HbA1c to < 5.3% and fasting glucose to < 88 mg/dL prevents protein cross-linking and vascular glycative stiffening, reducing Biometric Age by ~1.6 years.',
      targetBiomarkers: ['HbA1c', 'Fasting Glucose'],
    });
  }

  // Fallback lever if all are optimal
  if (levers.length === 0) {
    levers.push({
      title: 'Longevity Reserve Maintenance',
      impactYears: -0.8,
      description: 'Sustain optimal mitochondrial and endothelial resilience through progressive resistance training, VO2 max optimization, and restorative sleep hygiene.',
      targetBiomarkers: ['hs-CRP', 'HDL Cholesterol', 'HbA1c'],
    });
  }

  // Overall assessment summary
  let overall = '';
  if (totalAgeDelta < -1.5) {
    overall = `Patient exhibits a decelerated biological aging phenotype (-${Math.abs(totalAgeDelta)} years younger than chronological age). Cellular inflammation and cardiovascular markers demonstrate strong physiological reserve.`;
  } else if (totalAgeDelta <= 1.0) {
    overall = `Biometric Age is closely synchronized with chronological age (differential: ${totalAgeDelta > 0 ? '+' : ''}${totalAgeDelta} years). Biological aging rate is tracking at ${agingPace}x per calendar year.`;
  } else {
    overall = `Biometric Age is accelerated by +${totalAgeDelta} years compared to chronological baseline (${agingPace}x biological pace), primarily driven by ${
      domainInfl.ageDelta >= domainCardio.ageDelta && domainInfl.ageDelta >= domainMetab.ageDelta
        ? 'systemic inflammatory burden (hs-CRP)'
        : domainCardio.ageDelta >= domainMetab.ageDelta
        ? 'atherogenic dyslipidemia (LDL & Triglycerides)'
        : 'metabolic glycemic strain (HbA1c / Glucose)'
    }.`;
  }

  return {
    chronologicalAge,
    biometricAge,
    ageDelta: totalAgeDelta,
    agingPace,
    agingTier,
    domains: {
      inflammation: domainInfl,
      cardiovascular: domainCardio,
      metabolic: domainMetab,
    },
    historicalTrajectory,
    rejuvenationLevers: levers,
    overallAssessment: overall,
  };
}

function createDefaultBiometricAge(
  chronologicalAge: number,
  weights: BiometricAgeWeights
): BiometricAgeEstimation {
  return {
    chronologicalAge,
    biometricAge: chronologicalAge,
    ageDelta: 0,
    agingPace: 1.0,
    agingTier: 'Synchronized',
    domains: {
      inflammation: {
        domain: 'Inflammation',
        label: 'Inflammatory Aging',
        weight: weights.inflammation,
        ageDelta: 0,
        rawAgeDelta: 0,
        status: 'Synchronized',
        drivingBiomarkers: [],
        clinicalSummary: 'No active inflammatory markers recorded for staging.',
        optimizationAdvice: 'Obtain high-sensitivity CRP panel.',
      },
      cardiovascular: {
        domain: 'Cardiovascular',
        label: 'Cardiovascular Aging',
        weight: weights.cardiovascular,
        ageDelta: 0,
        rawAgeDelta: 0,
        status: 'Synchronized',
        drivingBiomarkers: [],
        clinicalSummary: 'Awaiting lipid panel assays.',
        optimizationAdvice: 'Obtain standard lipid profile.',
      },
      metabolic: {
        domain: 'Metabolic',
        label: 'Metabolic Aging',
        weight: weights.metabolic,
        ageDelta: 0,
        rawAgeDelta: 0,
        status: 'Synchronized',
        drivingBiomarkers: [],
        clinicalSummary: 'Awaiting glycemic assays.',
        optimizationAdvice: 'Obtain HbA1c and fasting glucose.',
      },
    },
    historicalTrajectory: [],
    rejuvenationLevers: [],
    overallAssessment: 'Awaiting laboratory session records for biometric age calculation.',
  };
}

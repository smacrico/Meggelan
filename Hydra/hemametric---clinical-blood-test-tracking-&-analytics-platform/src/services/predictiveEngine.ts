import {
  PatientProfile,
  TestSession,
  BiomarkerTrajectory,
  TrajectoryDirection,
  PredictiveHealthRiskAssessment,
  PredictiveReport,
  LifestyleRecommendation,
  RiskLevel,
  ResultStatus,
  BiomarkerVolatilityItem,
  ProjectedVolatilityRiskAssessment,
  SystemicInflammatoryGaugeData,
} from '../types/clinical';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';
import { evaluateBiomarkerStatus } from './calculationEngine';
import { calculateBiometricAge } from './biometricAgeEngine';

export { calculateBiometricAge } from './biometricAgeEngine';

export function analyzeBiomarkerTrajectories(
  sessions: TestSession[],
  profile: PatientProfile
): BiomarkerTrajectory[] {
  // Sort sessions chronologically ascending
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime()
  );

  if (sortedSessions.length === 0) return [];

  // Group measurements by biomarkerId
  const biomarkerHistoryMap = new Map<string, { date: string; value: number }[]>();

  sortedSessions.forEach((sess) => {
    sess.results.forEach((res) => {
      const history = biomarkerHistoryMap.get(res.biomarkerId) || [];
      history.push({
        date: sess.collectionDate,
        value: res.resultValue,
      });
      biomarkerHistoryMap.set(res.biomarkerId, history);
    });
  });

  const trajectories: BiomarkerTrajectory[] = [];

  biomarkerHistoryMap.forEach((history, biomarkerId) => {
    const catalogItem = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === biomarkerId);
    if (!catalogItem) return;

    const n = history.length;
    const firstPoint = history[0];
    const lastPoint = history[n - 1];
    const currentValue = lastPoint.value;

    const isFemale = profile.gender === 'Female';
    const refLow = isFemale ? catalogItem.refLowFemale : catalogItem.refLowMale;
    const refHigh = isFemale ? catalogItem.refHighFemale : catalogItem.refHighMale;

    if (n < 2) {
      // Single data point: cannot compute regression, provide baseline projection
      const status = evaluateBiomarkerStatus(currentValue, refLow, refHigh, catalogItem.criticalLow, catalogItem.criticalHigh).status;
      trajectories.push({
        biomarkerId,
        biomarkerName: catalogItem.name,
        unit: catalogItem.standardUnit,
        dataPointsCount: 1,
        historicalValues: history,
        currentValue,
        annualRateOfChange: 0,
        percentChangeOverall: 0,
        direction: 'Stable',
        projected6Months: currentValue,
        projected12Months: currentValue,
        projectedStatus12Months: status,
        confidenceScore: 30,
      });
      return;
    }

    // Time points in fractional years relative to first session
    const t0 = new Date(firstPoint.date).getTime();
    const msPerYear = 1000 * 60 * 60 * 24 * 365.25;

    const tVals = history.map((h) => (new Date(h.date).getTime() - t0) / msPerYear);
    const yVals = history.map((h) => h.value);

    // Linear regression: y = slope * t + intercept
    let sumT = 0, sumY = 0, sumTY = 0, sumTT = 0;
    for (let i = 0; i < n; i++) {
      sumT += tVals[i];
      sumY += yVals[i];
      sumTY += tVals[i] * yVals[i];
      sumTT += tVals[i] * tVals[i];
    }

    const denominator = n * sumTT - sumT * sumT;
    const slope = denominator !== 0 ? (n * sumTY - sumT * sumY) / denominator : 0;
    const intercept = denominator !== 0 ? (sumY - slope * sumT) / n : sumY / n;

    // R-squared calculation for confidence score
    const meanY = sumY / n;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
      const predY = slope * tVals[i] + intercept;
      ssTot += Math.pow(yVals[i] - meanY, 2);
      ssRes += Math.pow(yVals[i] - predY, 2);
    }
    const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0.8;

    const currentT = tVals[n - 1];
    const projected6m = Number(Math.max(0, slope * (currentT + 0.5) + intercept).toFixed(2));
    const projected12m = Number(Math.max(0, slope * (currentT + 1.0) + intercept).toFixed(2));

    const totalDays = (new Date(lastPoint.date).getTime() - t0) / (1000 * 60 * 60 * 24);
    const totalYears = Math.max(0.1, totalDays / 365.25);
    const annualRate = Number((slope).toFixed(2));
    const pctOverall = firstPoint.value !== 0 ? ((lastPoint.value - firstPoint.value) / firstPoint.value) * 100 : 0;
    const annualPctChange = pctOverall / totalYears;

    let direction: TrajectoryDirection = 'Stable';
    if (annualPctChange > 15) direction = 'Rapidly Rising';
    else if (annualPctChange > 4) direction = 'Gradually Rising';
    else if (annualPctChange < -15) direction = 'Rapidly Declining';
    else if (annualPctChange < -4) direction = 'Gradually Declining';

    // Projected status at 12 months
    const projected12Status = evaluateBiomarkerStatus(
      projected12m,
      refLow,
      refHigh,
      catalogItem.criticalLow,
      catalogItem.criticalHigh
    ).status;

    let warning: string | undefined;
    const currentStatus = evaluateBiomarkerStatus(currentValue, refLow, refHigh).status;
    if (currentStatus === 'Normal' && (projected12Status === 'High' || projected12Status === 'Low')) {
      warning = `Trajectory project crossing outside safe reference range within 12 months (${projected12m} ${catalogItem.standardUnit}).`;
    } else if (projected12Status === 'Critical High' || projected12Status === 'Critical Low') {
      warning = `Urgent trajectory alert: heading toward critical threshold within 12 months (${projected12m} ${catalogItem.standardUnit}).`;
    }

    const confidenceScore = Math.min(98, Math.max(45, Math.round((n / (n + 1)) * 50 + r2 * 50)));

    trajectories.push({
      biomarkerId,
      biomarkerName: catalogItem.name,
      unit: catalogItem.standardUnit,
      dataPointsCount: n,
      historicalValues: history,
      currentValue,
      annualRateOfChange: annualRate,
      percentChangeOverall: Number(pctOverall.toFixed(1)),
      direction,
      projected6Months: projected6m,
      projected12Months: projected12m,
      projectedStatus12Months: projected12Status,
      thresholdCrossingWarning: warning,
      confidenceScore,
    });
  });

  return trajectories;
}

export function generatePredictiveReport(
  profile: PatientProfile,
  sessions: TestSession[]
): PredictiveReport {
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime()
  );

  const trajectories = analyzeBiomarkerTrajectories(sortedSessions, profile);
  const trajMap = new Map(trajectories.map((t) => [t.biomarkerId, t]));

  const firstDate = sortedSessions.length > 0 ? new Date(sortedSessions[0].collectionDate).getTime() : Date.now();
  const lastDate = sortedSessions.length > 0 ? new Date(sortedSessions[sortedSessions.length - 1].collectionDate).getTime() : Date.now();
  const spanDays = Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24));

  const riskAssessments: PredictiveHealthRiskAssessment[] = [];
  const takeaways: string[] = [];

  // 1. CARDIOMETABOLIC & ATHEROGENIC RISK DOMAIN
  const ldlTraj = trajMap.get('bm-ldl');
  const hdlTraj = trajMap.get('bm-hdl');
  const tgTraj = trajMap.get('bm-tg');
  const gluTraj = trajMap.get('bm-glu');
  const a1cTraj = trajMap.get('bm-hba1c');
  const crpTraj = trajMap.get('bm-crp');

  let cardioScore = 20; // baseline optimal
  const cardioBiomarkers: string[] = [];

  if (ldlTraj) {
    cardioBiomarkers.push('LDL Cholesterol');
    if (ldlTraj.currentValue > 160) cardioScore += 25;
    else if (ldlTraj.currentValue > 130) cardioScore += 18;
    else if (ldlTraj.currentValue > 100) cardioScore += 10;
    if (ldlTraj.direction === 'Rapidly Rising' || ldlTraj.direction === 'Gradually Rising') cardioScore += 8;
  }

  if (tgTraj) {
    cardioBiomarkers.push('Triglycerides');
    if (tgTraj.currentValue > 200) cardioScore += 22;
    else if (tgTraj.currentValue > 150) cardioScore += 14;
    if (tgTraj.direction === 'Rapidly Rising') cardioScore += 10;
  }

  if (hdlTraj) {
    cardioBiomarkers.push('HDL Cholesterol');
    if (hdlTraj.currentValue < 40) cardioScore += 15;
    else if (hdlTraj.currentValue < 50 && profile.gender === 'Female') cardioScore += 12;
  }

  if (gluTraj || a1cTraj) {
    if (a1cTraj) cardioBiomarkers.push('HbA1c');
    const a1cVal = a1cTraj?.currentValue || 5.0;
    if (a1cVal >= 6.5) cardioScore += 25;
    else if (a1cVal >= 5.7) cardioScore += 15;
    if (a1cTraj?.direction === 'Rapidly Rising' || a1cTraj?.direction === 'Gradually Rising') cardioScore += 10;
  }

  cardioScore = Math.min(98, Math.max(10, cardioScore));

  const cardioCurrentLevel: RiskLevel =
    cardioScore >= 75 ? 'Critical' : cardioScore >= 55 ? 'Elevated' : cardioScore >= 35 ? 'Moderate' : 'Low';

  // Projected 12-month trajectory direction for cardiometabolic
  let cardioTrend: 'Worsening' | 'Stable' | 'Improving' = 'Stable';
  const risingCardio = [ldlTraj, tgTraj, a1cTraj].filter((t) => t && (t.direction === 'Gradually Rising' || t.direction === 'Rapidly Rising')).length;
  const decliningCardio = [ldlTraj, tgTraj, a1cTraj].filter((t) => t && (t.direction === 'Gradually Declining' || t.direction === 'Rapidly Declining')).length;
  if (risingCardio > decliningCardio) cardioTrend = 'Worsening';
  else if (decliningCardio > risingCardio) cardioTrend = 'Improving';

  let projectedCardioLevel = cardioCurrentLevel;
  if (cardioTrend === 'Worsening') {
    if (cardioCurrentLevel === 'Low') projectedCardioLevel = 'Moderate';
    else if (cardioCurrentLevel === 'Moderate') projectedCardioLevel = 'Elevated';
    else if (cardioCurrentLevel === 'Elevated') projectedCardioLevel = 'Critical';
  } else if (cardioTrend === 'Improving') {
    if (cardioCurrentLevel === 'Critical') projectedCardioLevel = 'Elevated';
    else if (cardioCurrentLevel === 'Elevated') projectedCardioLevel = 'Moderate';
    else if (cardioCurrentLevel === 'Moderate') projectedCardioLevel = 'Low';
  }

  const cardioRecs: LifestyleRecommendation[] = [];
  if (cardioScore >= 35) {
    cardioRecs.push({
      id: 'rec-cardio-diet',
      category: 'Nutrition',
      title: 'Mediterranean & High-Viscous Fiber Nutritional Protocol',
      summary: 'Replace ultra-processed refined starches with soluble fiber (psyllium, oats, legumes) and monounsaturated lipids (extra virgin olive oil, nuts) to accelerate LDL particle clearance and suppress VLDL synthesis.',
      targetBiomarkers: ['LDL Cholesterol', 'Triglycerides', 'HbA1c'],
      expectedImpact: 'Projected -12% to -18% reduction in LDL-C and -20% to -30% reduction in circulating Triglycerides within 12 weeks.',
      evidenceGrade: 'Grade A (RCT)',
      actionSteps: [
        'Incorporate 10-15g/day of soluble viscous fiber (psyllium husk, ground flaxseed, or chia).',
        'Limit saturated fatty acids to < 7% of total daily energy intake.',
        'Swap simple refined carbohydrates for low-glycemic intact grains to mitigate hepatic lipogenesis.',
      ],
    });
    cardioRecs.push({
      id: 'rec-cardio-exercise',
      category: 'Physical Activity',
      title: 'Zone 2 Aerobic Conditioning & Postprandial Walking',
      summary: 'Targeted mitochondrial fat-oxidation exercise enhances skeletal muscle GLUT4 translocation, reversing muscle insulin resistance and lowering post-meal triglyceride spikes.',
      targetBiomarkers: ['Triglycerides', 'HDL Cholesterol', 'Fasting Glucose'],
      expectedImpact: '+10% to +15% elevation in cardioprotective HDL and marked attenuation of postprandial glycemic excursions.',
      evidenceGrade: 'Grade A (RCT)',
      actionSteps: [
        'Accumulate 150-180 minutes weekly of low-intensity Zone 2 cardio (conversational heart rate ~65-75% max).',
        'Engage in a 10-15 minute moderate stroll immediately following dinner to blunt postprandial glucose peaks.',
      ],
    });
  }

  riskAssessments.push({
    category: 'Cardiometabolic Risk',
    currentRiskLevel: cardioCurrentLevel,
    projected12MonthRiskLevel: projectedCardioLevel,
    riskScore: cardioScore,
    trendDirection: cardioTrend,
    primaryDrivingBiomarkers: cardioBiomarkers,
    clinicalSummary:
      cardioTrend === 'Worsening'
        ? `Longitudinal trajectory demonstrates upward creep across atherogenic particles and glycemic indicators. Without intervention, 12-month projections place the profile in the ${projectedCardioLevel} risk tier.`
        : cardioTrend === 'Improving'
        ? `Therapeutic or dietary interventions are successfully suppressing atherogenic gradients. Sustained adherence maintains transition toward ${projectedCardioLevel} risk.`
        : `Cardiometabolic indices remain within steady parameters across recorded surveillance visits.`,
    recommendations: cardioRecs,
  });

  if (cardioTrend === 'Worsening') {
    takeaways.push(`Cardiometabolic trajectory is accelerating upward: 12-month forecast projects elevated atherogenic burden.`);
  }

  // 2. HEPATIC STEATOSIS & FIBROSIS DOMAIN
  const altTraj = trajMap.get('bm-alt');
  const astTraj = trajMap.get('bm-ast');
  const pltTraj = trajMap.get('bm-plt');

  let liverScore = 15;
  const liverBiomarkers: string[] = [];

  if (altTraj) {
    liverBiomarkers.push('ALT');
    if (altTraj.currentValue > 50) liverScore += 35;
    else if (altTraj.currentValue > 35) liverScore += 20;
    if (altTraj.direction === 'Rapidly Rising') liverScore += 15;
  }
  if (astTraj) {
    liverBiomarkers.push('AST');
    if (astTraj.currentValue > 45) liverScore += 20;
  }
  if (pltTraj && pltTraj.currentValue < 175) {
    liverBiomarkers.push('Platelets (declining)');
    liverScore += 15;
  }

  liverScore = Math.min(95, Math.max(10, liverScore));
  const liverCurrentLevel: RiskLevel =
    liverScore >= 70 ? 'Critical' : liverScore >= 50 ? 'Elevated' : liverScore >= 30 ? 'Moderate' : 'Low';

  let liverTrend: 'Worsening' | 'Stable' | 'Improving' = 'Stable';
  if (altTraj?.direction === 'Rapidly Rising' || altTraj?.direction === 'Gradually Rising') liverTrend = 'Worsening';
  else if (altTraj?.direction === 'Rapidly Declining' || altTraj?.direction === 'Gradually Declining') liverTrend = 'Improving';

  const liverRecs: LifestyleRecommendation[] = [];
  if (liverScore >= 30) {
    liverRecs.push({
      id: 'rec-liver-fructose',
      category: 'Nutrition',
      title: 'Hepatic De Novo Lipogenesis Suppression',
      summary: 'Restrict high-fructose corn syrup, liquid sugar calories, and alcohol. Fructose bypasses phosphofructokinase regulation and directly drives hepatic triglyceride deposition and transaminase release.',
      targetBiomarkers: ['ALT', 'AST', 'Triglycerides'],
      expectedImpact: 'Clinical normalization of ALT within 8-12 weeks; regression of hepatic fat fraction on sonography.',
      evidenceGrade: 'Grade A (RCT)',
      actionSteps: [
        'Eliminate sugar-sweetened beverages and commercial fruit juice concentrates.',
        'Consider 2-3 cups of filtered unsweetened coffee daily (associated with reduced hepatic fibrosis progression in meta-analyses).',
      ],
    });
    liverRecs.push({
      id: 'rec-liver-monitoring',
      category: 'Clinical Follow-up',
      title: 'FIB-4 Non-Invasive Surveillance & Re-check Cadence',
      summary: 'Schedule a repeat comprehensive metabolic panel in 90 days. If ALT remains > 40 U/L or FIB-4 > 1.3, evaluate for transient elastography (FibroScan).',
      targetBiomarkers: ['ALT', 'AST', 'FIB-4'],
      expectedImpact: 'Early detection and arrest of non-alcoholic steatohepatitis (MASH) before architectural fibrosis develops.',
      evidenceGrade: 'Grade B (Cohort)',
      actionSteps: [
        'Log medication and dietary supplement intake to rule out drug-induced liver injury (DILI).',
        'Repeat ALT, AST, and platelet count in 12 weeks.',
      ],
    });
  }

  riskAssessments.push({
    category: 'Hepatic Steatosis & Fibrosis',
    currentRiskLevel: liverCurrentLevel,
    projected12MonthRiskLevel: liverTrend === 'Worsening' ? (liverCurrentLevel === 'Low' ? 'Moderate' : 'Elevated') : liverCurrentLevel,
    riskScore: liverScore,
    trendDirection: liverTrend,
    primaryDrivingBiomarkers: liverBiomarkers,
    clinicalSummary:
      liverCurrentLevel === 'Low'
        ? 'Hepatic transaminases and synthetic markers demonstrate preserved hepatocyte integrity.'
        : `Hepatic transaminase trajectory flags persistent low-grade hepatocellular stress, consistent with steatosis or metabolic strain.`,
    recommendations: liverRecs,
  });

  // 3. IRON & HEMATOLOGIC RESERVE DOMAIN
  const ferrTraj = trajMap.get('bm-ferr');
  const hgbTraj = trajMap.get('bm-hgb');
  const tsatTraj = trajMap.get('bm-tsat');

  let ironScore = 15;
  const ironBiomarkers: string[] = [];
  if (ferrTraj) {
    ironBiomarkers.push('Ferritin');
    if (ferrTraj.currentValue < 15) ironScore += 50;
    else if (ferrTraj.currentValue < 30) ironScore += 30;
    else if (ferrTraj.currentValue > 300) ironScore += 25; // iron overload risk

    if (ferrTraj.direction === 'Rapidly Declining') ironScore += 20;
    else if (ferrTraj.direction === 'Rapidly Rising' && ferrTraj.currentValue < 50) ironScore -= 15; // recovery!
  }

  if (hgbTraj) {
    ironBiomarkers.push('Hemoglobin');
    const isFemale = profile.gender === 'Female';
    const lowHgb = isFemale ? 12.0 : 13.5;
    if (hgbTraj.currentValue < lowHgb) ironScore += 25;
  }

  ironScore = Math.min(95, Math.max(10, ironScore));
  const ironCurrentLevel: RiskLevel =
    ironScore >= 70 ? 'Critical' : ironScore >= 45 ? 'Elevated' : ironScore >= 25 ? 'Moderate' : 'Low';

  let ironTrend: 'Worsening' | 'Stable' | 'Improving' = 'Stable';
  if (ferrTraj?.direction === 'Rapidly Rising' && ferrTraj.currentValue < 100) ironTrend = 'Improving';
  else if (ferrTraj?.direction === 'Rapidly Declining' || ferrTraj?.direction === 'Gradually Declining') ironTrend = 'Worsening';

  const ironRecs: LifestyleRecommendation[] = [];
  if (ironScore >= 25) {
    ironRecs.push({
      id: 'rec-iron-repletion',
      category: 'Supplementation',
      title: 'Targeted Iron Repletion with Co-Factor Optimization',
      summary: 'Oral ferrous bisglycinate or chelated iron provides high bioavailability with reduced gastrointestinal irritation compared to ferrous sulfate. Take on an alternate-day schedule to minimize hepcidin counter-regulation.',
      targetBiomarkers: ['Ferritin', 'Hemoglobin', 'Transferrin Saturation'],
      expectedImpact: 'Expected +20 to +35 ng/mL increase in serum ferritin within 6-8 weeks of compliance.',
      evidenceGrade: 'Grade A (RCT)',
      actionSteps: [
        'Dose iron on alternate mornings with 250mg Vitamin C (ascorbic acid) to maximize ferric-to-ferrous duodenal transport.',
        'Avoid taking iron simultaneously with calcium, coffee, or tea (phytates/tannins inhibit absorption by >60%).',
      ],
    });
  }

  riskAssessments.push({
    category: 'Iron & Hematologic Reserve',
    currentRiskLevel: ironCurrentLevel,
    projected12MonthRiskLevel: ironTrend === 'Improving' ? 'Low' : ironCurrentLevel,
    riskScore: ironScore,
    trendDirection: ironTrend,
    primaryDrivingBiomarkers: ironBiomarkers,
    clinicalSummary:
      ironCurrentLevel === 'Critical' || ironCurrentLevel === 'Elevated'
        ? `Depleted or rapidly waning ferritin stores pose high risk for symptomatic iron-deficient erythropoiesis, chronic fatigue, and exercise intolerance.`
        : ironTrend === 'Improving'
        ? `Successful iron store replenishment noted: ferritin trajectory is rising toward physiological sufficiency.`
        : `Stable erythrocyte counts and adequate ferritin storage capacity.`,
    recommendations: ironRecs,
  });

  if (ironCurrentLevel === 'Critical' || (ferrTraj?.direction === 'Rapidly Declining' && (ferrTraj?.currentValue || 0) < 25)) {
    takeaways.push(`Urgent: Ferritin storage exhaustion detected; aggressive repletion indicated before hemoglobin falls further.`);
  }

  // 4. SYSTEMIC INFLAMMATION DOMAIN
  let inflScore = 15;
  const inflBiomarkers: string[] = [];
  if (crpTraj) {
    inflBiomarkers.push('hs-CRP');
    if (crpTraj.currentValue > 3.0) inflScore += 40;
    else if (crpTraj.currentValue > 1.5) inflScore += 20;
    if (crpTraj.direction === 'Rapidly Rising') inflScore += 15;
  }
  const neutTraj = trajMap.get('bm-neut');
  const lymphTraj = trajMap.get('bm-lymph');
  if (neutTraj && lymphTraj && lymphTraj.currentValue > 0) {
    const nlrVal = neutTraj.currentValue / lymphTraj.currentValue;
    if (nlrVal > 2.8) {
      inflBiomarkers.push('NLR (Neutrophil/Lymphocyte)');
      inflScore += 25;
    }
  }

  inflScore = Math.min(90, Math.max(10, inflScore));
  const inflCurrentLevel: RiskLevel =
    inflScore >= 65 ? 'Critical' : inflScore >= 45 ? 'Elevated' : inflScore >= 25 ? 'Moderate' : 'Low';

  let inflTrend: 'Worsening' | 'Stable' | 'Improving' = 'Stable';
  if (crpTraj?.direction === 'Rapidly Rising' || crpTraj?.direction === 'Gradually Rising') inflTrend = 'Worsening';
  else if (crpTraj?.direction === 'Rapidly Declining' || crpTraj?.direction === 'Gradually Declining') inflTrend = 'Improving';

  const inflRecs: LifestyleRecommendation[] = [];
  if (inflScore >= 25) {
    inflRecs.push({
      id: 'rec-infl-lifestyle',
      category: 'Nutrition',
      title: 'Anti-Inflammatory Omega-3 Index Optimization',
      summary: 'High-dose eicosapentaenoic acid (EPA) and docosahexaenoic acid (DHA) displace arachidonic acid in leukocyte cell membranes, generating pro-resolving lipid mediators (resolvins, protectins) that lower systemic hs-CRP.',
      targetBiomarkers: ['hs-CRP', 'NLR (Neutrophil/Lymphocyte)'],
      expectedImpact: 'Projected -25% to -35% reduction in hs-CRP over 8 weeks in clinical studies.',
      evidenceGrade: 'Grade A (RCT)',
      actionSteps: [
        'Consume cold-water fatty fish (wild salmon, sardines, mackerel) 2-3 times weekly.',
        'Target 2,000mg combined EPA/DHA daily from certified purified molecularly distilled source.',
        'Prioritize 7-8 hours consolidated restorative sleep; circadian disruption directly stimulates NF-κB and IL-6 release.',
      ],
    });
  }

  riskAssessments.push({
    category: 'Systemic Inflammation',
    currentRiskLevel: inflCurrentLevel,
    projected12MonthRiskLevel: inflTrend === 'Worsening' ? (inflCurrentLevel === 'Low' ? 'Moderate' : 'Elevated') : inflCurrentLevel,
    riskScore: inflScore,
    trendDirection: inflTrend,
    primaryDrivingBiomarkers: inflBiomarkers,
    clinicalSummary:
      inflCurrentLevel === 'Low'
        ? `Quiescent inflammatory markers: baseline vascular and cytokine activity remains within optimal low-risk boundaries.`
        : `Elevated inflammatory velocity indicates active microvascular endothelial activation and higher cardiovascular vulnerability.`,
    recommendations: inflRecs,
  });

  // 5. RENAL FILTRATION DOMAIN
  const egfrTraj = trajMap.get('bm-egfr');
  const crTraj = trajMap.get('bm-cr');
  let renalScore = 15;
  const renalBiomarkers: string[] = [];

  if (egfrTraj) {
    renalBiomarkers.push('eGFR');
    if (egfrTraj.currentValue < 60) renalScore += 50;
    else if (egfrTraj.currentValue < 90) renalScore += 25;
    if (egfrTraj.direction === 'Rapidly Declining' || egfrTraj.annualRateOfChange < -3.0) renalScore += 18;
  }
  if (crTraj && crTraj.currentValue > 1.2) {
    renalBiomarkers.push('Serum Creatinine');
    renalScore += 20;
  }

  renalScore = Math.min(90, Math.max(10, renalScore));
  const renalCurrentLevel: RiskLevel =
    renalScore >= 65 ? 'Critical' : renalScore >= 45 ? 'Elevated' : renalScore >= 25 ? 'Moderate' : 'Low';

  const renalTrend: 'Worsening' | 'Stable' | 'Improving' =
    egfrTraj?.direction === 'Rapidly Declining' ? 'Worsening' : 'Stable';

  riskAssessments.push({
    category: 'Renal Filtration',
    currentRiskLevel: renalCurrentLevel,
    projected12MonthRiskLevel: renalTrend === 'Worsening' ? (renalCurrentLevel === 'Low' ? 'Moderate' : 'Elevated') : renalCurrentLevel,
    riskScore: renalScore,
    trendDirection: renalTrend,
    primaryDrivingBiomarkers: renalBiomarkers,
    clinicalSummary:
      renalCurrentLevel === 'Low'
        ? `Glomerular filtration rates are preserved with age-appropriate clearance rates.`
        : `Mild reductions in estimated filtration require blood pressure and hydration monitoring to safeguard nephron longevity.`,
    recommendations: [],
  });

  // Default takeaway if none generated
  if (takeaways.length === 0) {
    takeaways.push(`All longitudinal trajectories remain clinically stable across the current ${spanDays}-day observation window.`);
  }

  const volatilityAssessment = calculateBiomarkerVolatilityAndRiskScore(sortedSessions, profile);
  const systemicInflammatoryGauge = calculateSystemicInflammatoryGaugeData(sortedSessions, profile);
  const biometricAge = calculateBiometricAge(profile, sortedSessions);

  return {
    profileId: profile.profileId,
    generatedDate: new Date().toISOString(),
    sessionsAnalyzed: sortedSessions.length,
    spanDays,
    riskAssessments,
    trajectories,
    keyTrajectoryTakeaways: takeaways,
    volatilityAssessment,
    systemicInflammatoryGauge,
    biometricAge,
  };
}

export function calculateBiomarkerVolatilityAndRiskScore(
  sessions: TestSession[],
  profile: PatientProfile
): ProjectedVolatilityRiskAssessment {
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime()
  );

  const valuesMap = new Map<string, number[]>();
  sortedSessions.forEach((sess) => {
    sess.results.forEach((r) => {
      const list = valuesMap.get(r.biomarkerId) || [];
      list.push(r.resultValue);
      valuesMap.set(r.biomarkerId, list);
    });
  });

  const volatileItems: BiomarkerVolatilityItem[] = [];

  valuesMap.forEach((vals, bId) => {
    const catItem = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === bId);
    if (!catItem || vals.length < 2) return;

    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length - 1);
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? (stdDev / mean) * 100 : 0;

    let tier: BiomarkerVolatilityItem['volatilityTier'] = 'Low';
    if (cv >= 40) tier = 'High';
    else if (cv >= 25) tier = 'Elevated';
    else if (cv >= 12) tier = 'Moderate';

    volatileItems.push({
      biomarkerId: bId,
      biomarkerName: catItem.name,
      category: catItem.category,
      meanValue: Number(mean.toFixed(2)),
      standardDeviation: Number(stdDev.toFixed(2)),
      coefficientOfVariation: Number(cv.toFixed(1)),
      volatilityTier: tier,
      unit: catItem.standardUnit,
    });
  });

  // Sort by highest volatility (CV%)
  volatileItems.sort((a, b) => b.coefficientOfVariation - a.coefficientOfVariation);

  const avgCv = volatileItems.length > 0
    ? volatileItems.reduce((acc, v) => acc + v.coefficientOfVariation, 0) / volatileItems.length
    : 10;

  // Key volatility weights: Glycemic, Lipids, Liver, Inflammation, Iron
  let weightedRisk = avgCv * 1.6;

  const crpVol = volatileItems.find((v) => v.biomarkerId === 'bm-crp');
  const tgVol = volatileItems.find((v) => v.biomarkerId === 'bm-tg');
  const gluVol = volatileItems.find((v) => v.biomarkerId === 'bm-glu');
  const altVol = volatileItems.find((v) => v.biomarkerId === 'bm-alt');
  const ferrVol = volatileItems.find((v) => v.biomarkerId === 'bm-ferr');

  if (crpVol && crpVol.coefficientOfVariation > 30) weightedRisk += 14;
  if (tgVol && tgVol.coefficientOfVariation > 25) weightedRisk += 12;
  if (gluVol && gluVol.coefficientOfVariation > 12) weightedRisk += 10;
  if (altVol && altVol.coefficientOfVariation > 20) weightedRisk += 8;
  if (ferrVol && ferrVol.coefficientOfVariation > 35) weightedRisk += 8;

  const latestSession = sortedSessions[sortedSessions.length - 1];
  if (latestSession) {
    const abnormalCount = latestSession.results.filter((r) => r.status !== 'Normal').length;
    weightedRisk += abnormalCount * 3.5;
  }

  const projectedScore = Math.min(96, Math.max(8, Math.round(weightedRisk)));

  let riskTier: ProjectedVolatilityRiskAssessment['riskTier'] = 'Nominal';
  let interp = 'Biomarker levels demonstrate tight physiological regulation with low visit-to-visit amplitude.';

  if (projectedScore >= 75) {
    riskTier = 'High Strain';
    interp = 'Marked multi-pathway biological instability. High visit-to-visit swings in inflammatory or metabolic indicators erode physiological buffering reserve, projecting elevated risk of acute decompensation.';
  } else if (projectedScore >= 55) {
    riskTier = 'Elevated';
    interp = 'Elevated biomarker volatility observed across key metabolic and inflammatory cascades, indicating sub-optimal homeostatic resilience and vulnerability to progressive metabolic stress.';
  } else if (projectedScore >= 30) {
    riskTier = 'Moderate';
    interp = 'Moderate biological variability within acceptable physiological adaptation limits. Key parameters exhibit steady trendlines with manageable fluctuations.';
  }

  return {
    projectedRiskScore: projectedScore,
    riskTier,
    averageCoefficientOfVariation: Number(avgCv.toFixed(1)),
    topVolatileMarkers: volatileItems.slice(0, 5),
    clinicalInterpretation: interp,
  };
}

export function calculateSystemicInflammatoryGaugeData(
  sessions: TestSession[],
  profile: PatientProfile
): SystemicInflammatoryGaugeData {
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.collectionDate).getTime() - new Date(b.collectionDate).getTime()
  );

  const latest = sortedSessions[sortedSessions.length - 1];
  if (!latest) {
    return {
      score: 15,
      riskTier: 'Low / Quiescent',
      clinicalSummary: 'No recorded laboratory sessions available for inflammatory staging.',
    };
  }

  const resMap = new Map(latest.results.map((r) => [r.biomarkerId, r.resultValue]));
  const crp = resMap.get('bm-crp');
  const neut = resMap.get('bm-neut');
  const lymph = resMap.get('bm-lymph');
  const plt = resMap.get('bm-plt');
  const wbc = resMap.get('bm-wbc');

  let nlr: number | undefined;
  if (neut !== undefined && lymph !== undefined && lymph > 0) {
    nlr = Number((neut / lymph).toFixed(2));
  }

  let plr: number | undefined;
  if (plt !== undefined && lymph !== undefined && lymph > 0) {
    plr = Number((plt / lymph).toFixed(1));
  }

  // Baseline score from hs-CRP
  let inflScore = 18;
  if (crp !== undefined) {
    if (crp >= 10.0) inflScore = 95;
    else if (crp >= 4.5) inflScore = 80;
    else if (crp >= 3.0) inflScore = 65;
    else if (crp >= 2.0) inflScore = 48;
    else if (crp >= 1.0) inflScore = 32;
    else inflScore = 15;
  }

  // NLR modifier (leukocyte differential)
  if (nlr !== undefined) {
    if (nlr >= 3.5) inflScore += 18;
    else if (nlr >= 2.5) inflScore += 10;
    else if (nlr < 1.8 && inflScore < 30) inflScore -= 4;
  }

  // PLR modifier (thrombotic-inflammatory potential)
  if (plr !== undefined) {
    if (plr >= 180) inflScore += 10;
    else if (plr >= 150) inflScore += 5;
  }

  // Trend modifier: check if CRP is rising across sessions
  const crpHistory: number[] = [];
  sortedSessions.forEach((s) => {
    const c = s.results.find((r) => r.biomarkerId === 'bm-crp');
    if (c) crpHistory.push(c.resultValue);
  });
  if (crpHistory.length >= 2) {
    const first = crpHistory[0];
    const last = crpHistory[crpHistory.length - 1];
    if (last > first * 1.25) inflScore += 6;
    else if (last < first * 0.75) inflScore -= 6;
  }

  const score = Math.min(98, Math.max(5, Math.round(inflScore)));

  let riskTier: SystemicInflammatoryGaugeData['riskTier'] = 'Low / Quiescent';
  let summary = 'Normal inflammatory tone. Quiescent baseline vascular and cytokine activity with low cardiovascular risk.';

  if (score >= 75) {
    riskTier = 'Critical';
    summary = 'Severe systemic microvascular inflammatory strain. Elevated hs-CRP alongside high NLR flags acute cytokine activation and accelerated endothelial shear stress.';
  } else if (score >= 50) {
    riskTier = 'Elevated';
    summary = 'Elevated vascular inflammatory activity. High-sensitivity CRP exceeds AHA/CDC threshold (>3.0 mg/L), denoting chronic pro-inflammatory signaling and heightened atherothrombotic vulnerability.';
  } else if (score >= 25) {
    riskTier = 'Moderate';
    summary = 'Moderate low-grade inflammatory activity. Sub-clinical cytokine baseline with mild leukocyte activation requiring ongoing dietary and cardiovascular surveillance.';
  }

  return {
    score,
    riskTier,
    crpValue: crp,
    nlrValue: nlr,
    plrValue: plr,
    wbcValue: wbc,
    clinicalSummary: summary,
  };
}

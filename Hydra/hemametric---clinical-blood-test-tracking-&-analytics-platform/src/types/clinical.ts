export type Gender = 'Male' | 'Female' | 'Other';

export type BiomarkerCategory =
  | 'Hematology & CBC'
  | 'Lipid Profile'
  | 'Metabolic & Glycemic'
  | 'Liver Function'
  | 'Renal & Electrolytes'
  | 'Iron Status'
  | 'Inflammatory Markers'
  | 'Vitamins & Minerals'
  | 'Hormonal & Thyroid';

export type ResultStatus = 'Normal' | 'Low' | 'High' | 'Critical Low' | 'Critical High';
export type AlertSeverity = 'Critical' | 'Warning' | 'Informational';

export interface PatientProfile {
  profileId: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: Gender;
  bloodType?: string;
  mrn: string; // Medical Record Number
  email: string;
  phone: string;
  medicalConditions: string[];
  medications: string[];
  createdDate: string;
}

export interface Laboratory {
  labId: string;
  labName: string;
  country: string;
  city: string;
  accreditation: string; // e.g. CAP / CLIA / ISO 15189
  licenseNumber: string;
}

export interface BiomarkerCatalogItem {
  biomarkerId: string;
  category: BiomarkerCategory;
  name: string;
  code: string; // LOINC code
  standardUnit: string;
  refLowMale: number;
  refHighMale: number;
  refLowFemale: number;
  refHighFemale: number;
  criticalLow?: number;
  criticalHigh?: number;
  description: string;
  clinicalSignificance: string;
}

export interface BiomarkerResult {
  resultId: string;
  sessionId: string;
  biomarkerId: string;
  resultValue: number;
  unitMeasured: string;
  refLow: number;
  refHigh: number;
  status: ResultStatus;
  flag?: string; // L, H, CL, CH
  notes?: string;
}

export interface DerivedMetric {
  metricId: string;
  sessionId: string;
  metricName: string;
  metricValue: number;
  unit: string;
  status: 'Optimal' | 'Borderline' | 'Elevated' | 'High Risk';
  targetOptimalRange: string;
  formulaDescription: string;
  clinicalInterpretation: string;
  referenceCutoff: string;
}

export type ObservationCategory =
  | 'Diagnostic Impression'
  | 'Therapeutic Adjustment'
  | 'Biomarker Shift Analysis'
  | 'Follow-up Directive'
  | 'Patient Consultation'
  | 'Critical Alert & Safety';

export type ObservationPriority = 'Routine' | 'Attention' | 'High Priority' | 'Urgent';

export interface ClinicalObservation {
  id: string;
  sessionId: string;
  timestamp: string; // ISO date string
  author: string;
  role?: string;
  category: ObservationCategory;
  priority: ObservationPriority;
  narrative: string;
  relatedBiomarkers?: string[]; // array of biomarkerIds
  lastEditedAt?: string;
}

export interface TestSession {
  sessionId: string;
  profileId: string;
  labId: string;
  collectionDate: string;
  fastingHours: number;
  reportFile?: string;
  notes: string;
  notesHtml?: string;
  notesLastEditedAt?: string;
  notesAuthor?: string;
  orderingPhysician: string;
  status: 'Verified' | 'Pending Review' | 'Archived';
  results: BiomarkerResult[];
  derivedMetrics: DerivedMetric[];
  createdDate: string;
  clinicalObservations?: ClinicalObservation[];
}

export interface AlertHistory {
  alertId: string;
  profileId: string;
  sessionId: string;
  resultId?: string;
  severity: AlertSeverity;
  biomarkerName: string;
  valueRecorded?: number;
  referenceInterval?: string;
  message: string;
  clinicalGuideline: string;
  generatedOn: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

// Predictive Analytics Types
export type TrajectoryDirection = 'Rapidly Rising' | 'Gradually Rising' | 'Stable' | 'Gradually Declining' | 'Rapidly Declining';
export type HealthRiskCategory = 'Cardiometabolic Risk' | 'Hepatic Steatosis & Fibrosis' | 'Systemic Inflammation' | 'Iron & Hematologic Reserve' | 'Renal Filtration';
export type RiskLevel = 'Low' | 'Moderate' | 'Elevated' | 'Critical';

export interface BiomarkerTrajectory {
  biomarkerId: string;
  biomarkerName: string;
  unit: string;
  dataPointsCount: number;
  historicalValues: { date: string; value: number }[];
  currentValue: number;
  annualRateOfChange: number; // change per year
  percentChangeOverall: number;
  direction: TrajectoryDirection;
  projected6Months: number;
  projected12Months: number;
  projectedStatus12Months: ResultStatus;
  thresholdCrossingWarning?: string;
  confidenceScore: number; // 0 - 100% based on sample density and linearity
}

export interface LifestyleRecommendation {
  id: string;
  category: 'Nutrition' | 'Physical Activity' | 'Sleep & Recovery' | 'Supplementation' | 'Clinical Follow-up';
  title: string;
  summary: string;
  targetBiomarkers: string[];
  expectedImpact: string;
  evidenceGrade: 'Grade A (RCT)' | 'Grade B (Cohort)' | 'Grade C (Consensus)';
  actionSteps: string[];
}

export interface PredictiveHealthRiskAssessment {
  category: HealthRiskCategory;
  currentRiskLevel: RiskLevel;
  projected12MonthRiskLevel: RiskLevel;
  riskScore: number; // 0 - 100
  trendDirection: 'Worsening' | 'Stable' | 'Improving';
  primaryDrivingBiomarkers: string[];
  clinicalSummary: string;
  recommendations: LifestyleRecommendation[];
}

export interface BiomarkerVolatilityItem {
  biomarkerId: string;
  biomarkerName: string;
  category: string;
  meanValue: number;
  standardDeviation: number;
  coefficientOfVariation: number; // CV%
  volatilityTier: 'Low' | 'Moderate' | 'Elevated' | 'High';
  unit: string;
}

export interface ProjectedVolatilityRiskAssessment {
  projectedRiskScore: number; // 0 - 100
  riskTier: 'Nominal' | 'Moderate' | 'Elevated' | 'High Strain';
  averageCoefficientOfVariation: number;
  topVolatileMarkers: BiomarkerVolatilityItem[];
  clinicalInterpretation: string;
}

export interface SystemicInflammatoryGaugeData {
  score: number; // 0 - 100
  riskTier: 'Low / Quiescent' | 'Moderate' | 'Elevated' | 'Critical';
  crpValue?: number;
  nlrValue?: number;
  plrValue?: number;
  wbcValue?: number;
  clinicalSummary: string;
}

export interface BiometricAgeBiomarkerDriver {
  biomarkerId: string;
  name: string;
  value: number;
  unit: string;
  optimalRange: string;
  status: ResultStatus;
  trendDirection: 'Improving' | 'Stable' | 'Worsening';
  annualRate?: number;
  contributionYears: number; // e.g. -1.2 (younger) or +2.4 (older)
  clinicalRationale: string;
}

export interface BiometricAgeDomain {
  domain: 'Inflammation' | 'Cardiovascular' | 'Metabolic';
  label: string;
  weight: number; // e.g. 0.30, 0.40, 0.30
  ageDelta: number; // weighted contribution in years
  rawAgeDelta: number; // unweighted domain delta in years
  status: 'Youthful / Optimized' | 'Synchronized' | 'Accelerated Aging' | 'Marked Acceleration';
  drivingBiomarkers: BiometricAgeBiomarkerDriver[];
  clinicalSummary: string;
  optimizationAdvice: string;
}

export interface BiometricAgeSessionPoint {
  sessionId: string;
  collectionDate: string;
  chronologicalAge: number;
  biometricAge: number;
  deltaYears: number;
}

export interface BiometricAgeRejuvenationLever {
  title: string;
  impactYears: number;
  description: string;
  targetBiomarkers: string[];
}

export interface BiometricAgeWeights {
  inflammation: number;
  cardiovascular: number;
  metabolic: number;
}

export interface BiometricAgeEstimation {
  chronologicalAge: number;
  biometricAge: number;
  ageDelta: number; // biometricAge - chronologicalAge (negative is younger)
  agingPace: number; // biological aging velocity, e.g. 0.92x or 1.15x
  agingTier: 'Optimized / Youthful' | 'Synchronized' | 'Mild Acceleration' | 'Accelerated Aging' | 'Marked Biological Acceleration';
  domains: {
    inflammation: BiometricAgeDomain;
    cardiovascular: BiometricAgeDomain;
    metabolic: BiometricAgeDomain;
  };
  historicalTrajectory: BiometricAgeSessionPoint[];
  rejuvenationLevers: BiometricAgeRejuvenationLever[];
  overallAssessment: string;
}

export interface PredictiveReport {
  profileId: string;
  generatedDate: string;
  sessionsAnalyzed: number;
  spanDays: number;
  riskAssessments: PredictiveHealthRiskAssessment[];
  trajectories: BiomarkerTrajectory[];
  keyTrajectoryTakeaways: string[];
  volatilityAssessment?: ProjectedVolatilityRiskAssessment;
  systemicInflammatoryGauge?: SystemicInflammatoryGaugeData;
  biometricAge?: BiometricAgeEstimation;
}

export interface FilterState {
  profileId?: string;
  dateRange: 'all' | '1m' | '6m' | '1y' | '3y';
  category?: BiomarkerCategory | 'All';
  biomarkerId?: string;
  severity?: AlertSeverity | 'All';
}

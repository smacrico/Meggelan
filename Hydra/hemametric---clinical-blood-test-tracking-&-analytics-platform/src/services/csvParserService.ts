import {
  PatientProfile,
  BiomarkerCatalogItem,
  BiomarkerResult,
  TestSession,
  ResultStatus,
} from '../types/clinical';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';
import { evaluateBiomarkerStatus } from './calculationEngine';

export interface CsvValidationRow {
  rowIndex: number;
  rawText: string;
  rawName: string;
  rawValue: string;
  rawUnit?: string;
  rawRefLow?: string;
  rawRefHigh?: string;
  rawRefRange?: string;

  // Resolved Clinical Biomarker Data
  biomarkerId: string;
  name: string;
  category: string;
  loincCode: string;
  parsedValue: number;
  unit: string;
  standardCatalogUnit: string;
  unitConverted: boolean;
  conversionNote?: string;
  refLow: number;
  refHigh: number;
  criticalLow?: number;
  criticalHigh?: number;
  status: ResultStatus;

  // Validation State
  isValid: boolean;
  validationErrors: string[];
  validationWarnings: string[];

  // Optional Row-level Metadata
  rowDate?: string;
  rowLab?: string;
  rowPhysician?: string;
  rowNotes?: string;
}

export interface CsvParseResult {
  success: boolean;
  totalLines: number;
  parsedRowsCount: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  rows: CsvValidationRow[];
  detectedSessionMetadata: {
    collectionDate?: string;
    labId?: string;
    orderingPhysician?: string;
    notes?: string;
  };
  globalErrors: string[];
}

// ---------------------------------------------------------------------------
// CLINICAL BIOMARKER ALIAS REGISTRY
// Maps multiple laboratory synonym formats, abbreviations, and LOINC codes
// to our canonical catalog biomarker ID.
// ---------------------------------------------------------------------------
const BIOMARKER_ALIAS_MAP: Record<string, string> = {
  // Glucose & Glycemic
  'glucose': 'bm-glu',
  'fasting glucose': 'bm-glu',
  'fasting blood glucose': 'bm-glu',
  'fbg': 'bm-glu',
  'fbs': 'bm-glu',
  'plasma glucose': 'bm-glu',
  'glu': 'bm-glu',
  'blood sugar': 'bm-glu',
  '1558-6': 'bm-glu',

  'hba1c': 'bm-hba1c',
  'a1c': 'bm-hba1c',
  'hemoglobin a1c': 'bm-hba1c',
  'glycated hemoglobin': 'bm-hba1c',
  'glycohemoglobin': 'bm-hba1c',
  '4548-4': 'bm-hba1c',

  // Lipids
  'cholesterol': 'bm-chol',
  'total cholesterol': 'bm-chol',
  'chol': 'bm-chol',
  'tc': 'bm-chol',
  'total chol': 'bm-chol',
  '2093-3': 'bm-chol',

  'ldl': 'bm-ldl',
  'ldl cholesterol': 'bm-ldl',
  'ldl-c': 'bm-ldl',
  'ldl-cholesterol': 'bm-ldl',
  'calculated ldl': 'bm-ldl',
  'direct ldl': 'bm-ldl',
  '13457-7': 'bm-ldl',

  'hdl': 'bm-hdl',
  'hdl cholesterol': 'bm-hdl',
  'hdl-c': 'bm-hdl',
  'hdl-cholesterol': 'bm-hdl',
  '2085-9': 'bm-hdl',

  'triglycerides': 'bm-tg',
  'triglyceride': 'bm-tg',
  'tg': 'bm-tg',
  'trigs': 'bm-tg',
  '2571-8': 'bm-tg',

  'non-hdl': 'bm-nonhdl',
  'non hdl': 'bm-nonhdl',
  'non-hdl cholesterol': 'bm-nonhdl',
  'nonhdl': 'bm-nonhdl',
  '43396-1': 'bm-nonhdl',

  // Inflammatory
  'crp': 'bm-crp',
  'hs-crp': 'bm-crp',
  'hscrp': 'bm-crp',
  'high-sensitivity crp': 'bm-crp',
  'c-reactive protein': 'bm-crp',
  'crp hs': 'bm-crp',
  'crp, high sensitivity': 'bm-crp',
  '30522-7': 'bm-crp',

  // CBC & Hematology
  'hemoglobin': 'bm-hgb',
  'hgb': 'bm-hgb',
  'hb': 'bm-hgb',
  '718-7': 'bm-hgb',

  'hematocrit': 'bm-hct',
  'hct': 'bm-hct',
  'pcv': 'bm-hct',
  '4544-3': 'bm-hct',

  'wbc': 'bm-wbc',
  'white blood count': 'bm-wbc',
  'white blood cells': 'bm-wbc',
  'leukocytes': 'bm-wbc',
  '6690-2': 'bm-wbc',

  'platelets': 'bm-plt',
  'platelet count': 'bm-plt',
  'plt': 'bm-plt',
  'thrombocytes': 'bm-plt',
  '777-3': 'bm-plt',

  'neutrophils': 'bm-neut',
  'absolute neutrophils': 'bm-neut',
  'neut': 'bm-neut',
  'anc': 'bm-neut',
  'neutrophil count': 'bm-neut',
  '751-8': 'bm-neut',

  'lymphocytes': 'bm-lymph',
  'absolute lymphocytes': 'bm-lymph',
  'lymph': 'bm-lymph',
  'alc': 'bm-lymph',
  'lymphocyte count': 'bm-lymph',
  '731-0': 'bm-lymph',

  'monocytes': 'bm-mono',
  'absolute monocytes': 'bm-mono',
  'mono': 'bm-mono',
  'monocyte count': 'bm-mono',
  '742-7': 'bm-mono',

  // Liver Function
  'alt': 'bm-alt',
  'sgpt': 'bm-alt',
  'alanine aminotransferase': 'bm-alt',
  'alt (sgpt)': 'bm-alt',
  '1742-6': 'bm-alt',

  'ast': 'bm-ast',
  'sgot': 'bm-ast',
  'aspartate aminotransferase': 'bm-ast',
  'ast (sgot)': 'bm-ast',
  '1920-8': 'bm-ast',

  'alp': 'bm-alp',
  'alk phos': 'bm-alp',
  'alkaline phosphatase': 'bm-alp',
  '6768-6': 'bm-alp',

  'bilirubin': 'bm-bili',
  'total bilirubin': 'bm-bili',
  'bili': 'bm-bili',
  't-bili': 'bm-bili',
  '1975-2': 'bm-bili',

  'albumin': 'bm-alb',
  'serum albumin': 'bm-alb',
  'alb': 'bm-alb',
  '1751-7': 'bm-alb',

  // Renal & Electrolytes
  'creatinine': 'bm-cr',
  'serum creatinine': 'bm-cr',
  'cr': 'bm-cr',
  'creat': 'bm-cr',
  '2160-0': 'bm-cr',

  'egfr': 'bm-egfr',
  'gfr': 'bm-egfr',
  'egfr ckd-epi': 'bm-egfr',
  'estimated gfr': 'bm-egfr',
  '33914-3': 'bm-egfr',

  'bun': 'bm-bun',
  'blood urea nitrogen': 'bm-bun',
  'urea nitrogen': 'bm-bun',
  'urea': 'bm-bun',
  '3094-0': 'bm-bun',

  'uric acid': 'bm-uric',
  'urate': 'bm-uric',
  'serum uric acid': 'bm-uric',
  '3084-1': 'bm-uric',

  // Iron Status
  'ferritin': 'bm-ferr',
  'serum ferritin': 'bm-ferr',
  'ferr': 'bm-ferr',
  '2276-4': 'bm-ferr',

  'iron': 'bm-iron',
  'serum iron': 'bm-iron',
  'fe': 'bm-iron',
  'total iron': 'bm-iron',
  '2498-4': 'bm-iron',

  'transferrin saturation': 'bm-tsat',
  'tsat': 'bm-tsat',
  '% saturation': 'bm-tsat',
  'iron saturation': 'bm-tsat',
  '2502-3': 'bm-tsat',

  // Vitamins & Minerals
  'vitamin d': 'bm-vitd',
  'vit d': 'bm-vitd',
  '25-hydroxy vitamin d': 'bm-vitd',
  '25-oh vitamin d': 'bm-vitd',
  '25-hydroxyvitamin d': 'bm-vitd',
  '16480-6': 'bm-vitd',

  'vitamin b12': 'bm-b12',
  'b12': 'bm-b12',
  'vit b12': 'bm-b12',
  'cobalamin': 'bm-b12',
  '2132-9': 'bm-b12',
};

// ---------------------------------------------------------------------------
// DELIMITER & CSV LINE SPLITTER
// ---------------------------------------------------------------------------
export function detectDelimiter(firstFewLines: string): string {
  const commaCount = (firstFewLines.match(/,/g) || []).length;
  const semicolonCount = (firstFewLines.match(/;/g) || []).length;
  const tabCount = (firstFewLines.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
}

/**
 * Robust CSV Line Parser supporting quoted tokens with commas and escaped quotes
 */
export function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

/**
 * Cleans string for fuzzy matching (lowercase, strips non-alphanumeric except hyphen)
 */
function normalizeIdentifier(str: string): string {
  return str
    .toLowerCase()
    .replace(/[()[\]{}_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves a biomarker string to our MASTER_BIOMARKER_CATALOG item
 */
export function resolveBiomarker(rawName: string): BiomarkerCatalogItem | null {
  if (!rawName) return null;
  const clean = normalizeIdentifier(rawName);

  // 1. Direct ID check
  const directId = MASTER_BIOMARKER_CATALOG.find(
    (b) => b.biomarkerId.toLowerCase() === clean || b.biomarkerId.toLowerCase() === rawName.toLowerCase().trim()
  );
  if (directId) return directId;

  // 2. Direct Code / LOINC check
  const directCode = MASTER_BIOMARKER_CATALOG.find((b) => b.code.toLowerCase() === clean);
  if (directCode) return directCode;

  // 3. Exact Catalog Name check
  const exactName = MASTER_BIOMARKER_CATALOG.find(
    (b) => normalizeIdentifier(b.name) === clean
  );
  if (exactName) return exactName;

  // 4. Alias Map check
  if (BIOMARKER_ALIAS_MAP[clean]) {
    const mappedId = BIOMARKER_ALIAS_MAP[clean];
    const found = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === mappedId);
    if (found) return found;
  }

  // 5. Word-boundary or substring lookup in aliases
  for (const [alias, bId] of Object.entries(BIOMARKER_ALIAS_MAP)) {
    if (clean === alias || clean.startsWith(alias + ' ') || clean.endsWith(' ' + alias) || clean.includes(` ${alias} `)) {
      const found = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === bId);
      if (found) return found;
    }
  }

  // 6. Substring check in catalog names
  const partial = MASTER_BIOMARKER_CATALOG.find((b) => {
    const bClean = normalizeIdentifier(b.name);
    return clean.includes(bClean) || bClean.includes(clean);
  });
  if (partial) return partial;

  return null;
}

/**
 * Parses numeric reference interval string, e.g. "70-99", "125 - 200", "< 100", ">= 40", "0.59 - 1.04"
 */
export function parseReferenceRangeString(
  rangeStr: string,
  fallbackLow: number,
  fallbackHigh: number
): { refLow: number; refHigh: number; isParsed: boolean } {
  if (!rangeStr || !rangeStr.trim()) {
    return { refLow: fallbackLow, refHigh: fallbackHigh, isParsed: false };
  }

  const clean = rangeStr.replace(/[^\d.,<>=–-]/g, '').trim();

  // Pattern "min - max" or "min – max"
  const dashMatch = clean.match(/^([0-9.]+)\s*[-–]\s*([0-9.]+)$/);
  if (dashMatch) {
    const low = parseFloat(dashMatch[1]);
    const high = parseFloat(dashMatch[2]);
    if (!isNaN(low) && !isNaN(high) && low <= high) {
      return { refLow: low, refHigh: high, isParsed: true };
    }
  }

  // Pattern "< max" or "<= max"
  const lessMatch = clean.match(/^[<=]+\s*([0-9.]+)$/);
  if (lessMatch) {
    const high = parseFloat(lessMatch[1]);
    if (!isNaN(high)) {
      return { refLow: fallbackLow, refHigh: high, isParsed: true };
    }
  }

  // Pattern "> min" or ">= min"
  const greaterMatch = clean.match(/^[>=]+\s*([0-9.]+)$/);
  if (greaterMatch) {
    const low = parseFloat(greaterMatch[1]);
    if (!isNaN(low)) {
      return { refLow: low, refHigh: fallbackHigh, isParsed: true };
    }
  }

  return { refLow: fallbackLow, refHigh: fallbackHigh, isParsed: false };
}

/**
 * Validates and standardizes units between laboratory reporting formats.
 * Performs clinical mathematical conversion when incoming units differ (e.g. SI mmol/L to US conventional mg/dL).
 */
export function validateAndConvertUnit(
  biomarkerId: string,
  value: number,
  inputUnit: string | undefined,
  standardUnit: string
): {
  convertedValue: number;
  outputUnit: string;
  isConverted: boolean;
  conversionNote?: string;
  warning?: string;
} {
  const normInput = (inputUnit || '').toLowerCase().replace(/\s+/g, '').replace('^', '').replace('*', '');
  const normStd = standardUnit.toLowerCase().replace(/\s+/g, '').replace('^', '').replace('*', '');

  // If no unit supplied or matches standard
  if (!normInput || normInput === normStd) {
    return {
      convertedValue: value,
      outputUnit: standardUnit,
      isConverted: false,
    };
  }

  // Common Unit Harmonizations:

  // 1. Glucose: mmol/L -> mg/dL (factor: * 18.0182)
  if (biomarkerId === 'bm-glu' && normInput.includes('mmol/l')) {
    const converted = Math.round(value * 18.0182 * 10) / 10;
    return {
      convertedValue: converted,
      outputUnit: standardUnit,
      isConverted: true,
      conversionNote: `Auto-converted ${value} mmol/L to ${converted} mg/dL (×18.0182 SI conversion).`,
    };
  }

  // 2. Cholesterol (Total, LDL, HDL, Non-HDL): mmol/L -> mg/dL (factor: * 38.67)
  if (['bm-chol', 'bm-ldl', 'bm-hdl', 'bm-nonhdl'].includes(biomarkerId) && normInput.includes('mmol/l')) {
    const converted = Math.round(value * 38.67 * 10) / 10;
    return {
      convertedValue: converted,
      outputUnit: standardUnit,
      isConverted: true,
      conversionNote: `Auto-converted ${value} mmol/L to ${converted} mg/dL (×38.67 lipid conversion).`,
    };
  }

  // 3. Triglycerides: mmol/L -> mg/dL (factor: * 88.57)
  if (biomarkerId === 'bm-tg' && normInput.includes('mmol/l')) {
    const converted = Math.round(value * 88.57 * 10) / 10;
    return {
      convertedValue: converted,
      outputUnit: standardUnit,
      isConverted: true,
      conversionNote: `Auto-converted ${value} mmol/L to ${converted} mg/dL (×88.57 triglyceride factor).`,
    };
  }

  // 4. Creatinine: umol/L or µmol/L -> mg/dL (factor: / 88.4)
  if (biomarkerId === 'bm-cr' && (normInput.includes('umol/l') || normInput.includes('µmol/l'))) {
    const converted = Math.round((value / 88.4) * 100) / 100;
    return {
      convertedValue: converted,
      outputUnit: standardUnit,
      isConverted: true,
      conversionNote: `Auto-converted ${value} µmol/L to ${converted} mg/dL (÷88.4 renal factor).`,
    };
  }

  // 5. Bilirubin: umol/L or µmol/L -> mg/dL (factor: / 17.1)
  if (biomarkerId === 'bm-bili' && (normInput.includes('umol/l') || normInput.includes('µmol/l'))) {
    const converted = Math.round((value / 17.1) * 100) / 100;
    return {
      convertedValue: converted,
      outputUnit: standardUnit,
      isConverted: true,
      conversionNote: `Auto-converted ${value} µmol/L to ${converted} mg/dL (÷17.1 hepatic factor).`,
    };
  }

  // 6. Cell counts: k/ul, 10^3/ul, x10^3/ul, k/mcl, thou/mcl -> ×10³/µL
  const cellUnits = ['k/ul', '103/ul', 'x103/ul', 'k/mcl', 'thou/mcl', '10^3/ul', 'x10^3/ul'];
  if (['bm-wbc', 'bm-plt', 'bm-neut', 'bm-lymph', 'bm-mono'].includes(biomarkerId)) {
    if (cellUnits.some((cu) => normInput.includes(cu))) {
      return {
        convertedValue: value,
        outputUnit: standardUnit,
        isConverted: false,
      };
    }
  }

  // 7. Vitamin D: nmol/L -> ng/mL (factor: / 2.496)
  if (biomarkerId === 'bm-vitd' && normInput.includes('nmol/l')) {
    const converted = Math.round((value / 2.496) * 10) / 10;
    return {
      convertedValue: converted,
      outputUnit: standardUnit,
      isConverted: true,
      conversionNote: `Auto-converted ${value} nmol/L to ${converted} ng/mL (÷2.496 vitamin D factor).`,
    };
  }

  // If different but no known conversion
  return {
    convertedValue: value,
    outputUnit: inputUnit || standardUnit,
    isConverted: false,
    warning: `Reported in "${inputUnit}", while system standard is "${standardUnit}". Verify calibration.`,
  };
}

// ---------------------------------------------------------------------------
// MASTER CSV PARSER UTILITY
// ---------------------------------------------------------------------------
export function parseClinicalCsv(
  csvContent: string,
  profile: PatientProfile,
  defaultLabId: string = 'lab-quest-01'
): CsvParseResult {
  const result: CsvParseResult = {
    success: false,
    totalLines: 0,
    parsedRowsCount: 0,
    validCount: 0,
    warningCount: 0,
    errorCount: 0,
    rows: [],
    detectedSessionMetadata: {
      labId: defaultLabId,
    },
    globalErrors: [],
  };

  if (!csvContent || !csvContent.trim()) {
    result.globalErrors.push('CSV content is empty.');
    return result;
  }

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  result.totalLines = lines.length;

  if (lines.length < 2) {
    result.globalErrors.push('CSV must contain a header row and at least one data row.');
    return result;
  }

  const delimiter = detectDelimiter(lines.slice(0, 5).join('\n'));
  const headerTokens = parseCsvLine(lines[0], delimiter).map((h) => normalizeIdentifier(h));

  // Determine column index mappings
  let colNameIdx = -1;
  let colValueIdx = -1;
  let colUnitIdx = -1;
  let colRefLowIdx = -1;
  let colRefHighIdx = -1;
  let colRefRangeIdx = -1;
  let colDateIdx = -1;
  let colLabIdx = -1;
  let colPhysicianIdx = -1;
  let colNotesIdx = -1;

  headerTokens.forEach((header, idx) => {
    if (['biomarker', 'biomarker_id', 'biomarker id', 'analyte', 'test', 'test name', 'test_name', 'marker', 'name', 'code'].some((k) => header.includes(k))) {
      if (colNameIdx === -1) colNameIdx = idx;
    } else if (['value', 'result', 'result value', 'result_value', 'val', 'measurement', 'numeric'].some((k) => header.includes(k))) {
      if (colValueIdx === -1) colValueIdx = idx;
    } else if (['unit', 'units', 'unit measured', 'unit_measured', 'uom'].some((k) => header.includes(k))) {
      if (colUnitIdx === -1) colUnitIdx = idx;
    } else if (['ref low', 'ref_low', 'reference low', 'low limit', 'ref min', 'min'].some((k) => header.includes(k))) {
      if (colRefLowIdx === -1) colRefLowIdx = idx;
    } else if (['ref high', 'ref_high', 'reference high', 'high limit', 'ref max', 'max'].some((k) => header.includes(k))) {
      if (colRefHighIdx === -1) colRefHighIdx = idx;
    } else if (['reference range', 'ref range', 'ref_range', 'normal range', 'interval', 'reference interval'].some((k) => header.includes(k))) {
      if (colRefRangeIdx === -1) colRefRangeIdx = idx;
    } else if (['date', 'collection date', 'collection_date', 'draw date', 'test date'].some((k) => header.includes(k))) {
      if (colDateIdx === -1) colDateIdx = idx;
    } else if (['lab', 'lab id', 'lab_id', 'laboratory', 'facility'].some((k) => header.includes(k))) {
      if (colLabIdx === -1) colLabIdx = idx;
    } else if (['physician', 'doctor', 'ordering physician', 'provider'].some((k) => header.includes(k))) {
      if (colPhysicianIdx === -1) colPhysicianIdx = idx;
    } else if (['notes', 'comment', 'clinical notes', 'flag', 'indication'].some((k) => header.includes(k))) {
      if (colNotesIdx === -1) colNotesIdx = idx;
    }
  });

  // Fallback positional index if standard headers not fully labeled:
  // e.g. column 0 = Name, column 1 = Value, column 2 = Unit
  if (colNameIdx === -1 && headerTokens.length >= 2) colNameIdx = 0;
  if (colValueIdx === -1 && headerTokens.length >= 2) colValueIdx = 1;
  if (colUnitIdx === -1 && headerTokens.length >= 3) colUnitIdx = 2;

  if (colNameIdx === -1 || colValueIdx === -1) {
    result.globalErrors.push(
      `Could not identify required columns in header: "${lines[0]}". Must have at least analyte name and result value.`
    );
    return result;
  }

  const isFemale = profile.gender === 'Female';

  // Process data rows
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    const tokens = parseCsvLine(rawLine, delimiter);
    if (tokens.length <= 1 && !tokens[0]) continue; // blank line

    const rawName = tokens[colNameIdx] || '';
    const rawValStr = tokens[colValueIdx] || '';
    const rawUnit = colUnitIdx !== -1 ? tokens[colUnitIdx] : undefined;
    const rawRefLow = colRefLowIdx !== -1 ? tokens[colRefLowIdx] : undefined;
    const rawRefHigh = colRefHighIdx !== -1 ? tokens[colRefHighIdx] : undefined;
    const rawRefRange = colRefRangeIdx !== -1 ? tokens[colRefRangeIdx] : undefined;

    const rowDate = colDateIdx !== -1 ? tokens[colDateIdx] : undefined;
    const rowLab = colLabIdx !== -1 ? tokens[colLabIdx] : undefined;
    const rowPhysician = colPhysicianIdx !== -1 ? tokens[colPhysicianIdx] : undefined;
    const rowNotes = colNotesIdx !== -1 ? tokens[colNotesIdx] : undefined;

    if (rowDate && !result.detectedSessionMetadata.collectionDate) {
      result.detectedSessionMetadata.collectionDate = rowDate;
    }
    if (rowLab && result.detectedSessionMetadata.labId === defaultLabId) {
      result.detectedSessionMetadata.labId = rowLab;
    }
    if (rowPhysician && !result.detectedSessionMetadata.orderingPhysician) {
      result.detectedSessionMetadata.orderingPhysician = rowPhysician;
    }
    if (rowNotes && !result.detectedSessionMetadata.notes) {
      result.detectedSessionMetadata.notes = rowNotes;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Resolve Biomarker
    const catalogItem = resolveBiomarker(rawName);
    if (!catalogItem) {
      errors.push(`Unrecognized analyte identifier: "${rawName}". Not found in Master Catalog.`);
    }

    // 2. Parse Numeric Value
    const cleanNumStr = rawValStr.replace(/[^\d.-]/g, '');
    const numVal = parseFloat(cleanNumStr);
    if (isNaN(numVal)) {
      errors.push(`Invalid non-numeric result value: "${rawValStr}".`);
    }

    const biomarkerId = catalogItem?.biomarkerId || `unknown-${i}`;
    const name = catalogItem?.name || rawName;
    const category = catalogItem?.category || 'General';
    const loinc = catalogItem?.code || 'N/A';
    const stdUnit = catalogItem?.standardUnit || rawUnit || '';

    // Standard Reference intervals from Master Catalog based on profile gender
    let stdRefLow = isFemale ? (catalogItem?.refLowFemale ?? 0) : (catalogItem?.refLowMale ?? 0);
    let stdRefHigh = isFemale ? (catalogItem?.refHighFemale ?? 100) : (catalogItem?.refHighMale ?? 100);

    // 3. Unit Validation and Standard Conversion
    let finalValue = numVal;
    let finalUnit = stdUnit;
    let unitConverted = false;
    let conversionNote: string | undefined;

    if (!isNaN(numVal) && catalogItem) {
      const unitRes = validateAndConvertUnit(biomarkerId, numVal, rawUnit, stdUnit);
      finalValue = unitRes.convertedValue;
      finalUnit = unitRes.outputUnit;
      unitConverted = unitRes.isConverted;
      conversionNote = unitRes.conversionNote;
      if (unitRes.warning) {
        warnings.push(unitRes.warning);
      }
    }

    // 4. Reference Range Parsing / Validation
    if (rawRefRange) {
      const parsedRange = parseReferenceRangeString(rawRefRange, stdRefLow, stdRefHigh);
      if (parsedRange.isParsed) {
        stdRefLow = parsedRange.refLow;
        stdRefHigh = parsedRange.refHigh;
      }
    } else if (rawRefLow !== undefined && rawRefHigh !== undefined) {
      const pLow = parseFloat(rawRefLow);
      const pHigh = parseFloat(rawRefHigh);
      if (!isNaN(pLow) && !isNaN(pHigh)) {
        if (pLow > pHigh) {
          warnings.push(`Inverted reference interval: low (${pLow}) > high (${pHigh}).`);
        } else {
          stdRefLow = pLow;
          stdRefHigh = pHigh;
        }
      }
    }

    // 5. Evaluate Clinical Status
    const evalRes = evaluateBiomarkerStatus(
      finalValue || 0,
      stdRefLow,
      stdRefHigh,
      catalogItem?.criticalLow,
      catalogItem?.criticalHigh
    );

    const isValid = errors.length === 0;

    const rowItem: CsvValidationRow = {
      rowIndex: i,
      rawText: rawLine,
      rawName,
      rawValue: rawValStr,
      rawUnit,
      rawRefLow,
      rawRefHigh,
      rawRefRange,
      biomarkerId,
      name,
      category,
      loincCode: loinc,
      parsedValue: finalValue,
      unit: finalUnit,
      standardCatalogUnit: stdUnit,
      unitConverted,
      conversionNote,
      refLow: stdRefLow,
      refHigh: stdRefHigh,
      criticalLow: catalogItem?.criticalLow,
      criticalHigh: catalogItem?.criticalHigh,
      status: evalRes.status,
      isValid,
      validationErrors: errors,
      validationWarnings: warnings,
      rowDate,
      rowLab,
      rowPhysician,
      rowNotes,
    };

    result.rows.push(rowItem);
    if (isValid) {
      result.validCount++;
    } else {
      result.errorCount++;
    }
    if (warnings.length > 0) {
      result.warningCount++;
    }
  }

  result.parsedRowsCount = result.rows.length;
  result.success = result.errorCount === 0 && result.validCount > 0;
  return result;
}

// ---------------------------------------------------------------------------
// CSV TEMPLATES & EXPORT HELPERS
// ---------------------------------------------------------------------------

export const SAMPLE_LONGITUDINAL_CSV = `biomarker,value,unit,ref_low,ref_high,notes
Fasting Blood Glucose,96,mg/dL,70,99,Fasting 12h
Hemoglobin A1c,5.6,%,4.0,5.6,Optimal glycemic control
Total Cholesterol,192,mg/dL,125,200,Lipid panel
LDL Cholesterol,98,mg/dL,50,100,Target reached
HDL Cholesterol,56,mg/dL,50,90,Cardioprotective
Triglycerides,122,mg/dL,40,150,Normal range
High-Sensitivity CRP,0.8,mg/L,0.1,3.0,Low systemic inflammation
Hemoglobin,14.2,g/dL,12.0,15.5,CBC panel
Hematocrit,42.5,%,34.9,44.5,Normal RBC volume
Platelet Count,245,×10³/µL,150,450,Stable
Serum Creatinine,0.82,mg/dL,0.59,1.04,Normal renal excretion
eGFR,102,mL/min/1.73m²,90,125,CKD-EPI stage 1
ALT,22,U/L,7,35,Normal liver transaminase
AST,20,U/L,10,35,De Ritis AST/ALT 0.91
Ferritin,68,ng/mL,15,200,Adequate body iron store
25-Hydroxy Vitamin D,54,ng/mL,30,100,Repleted`;

export function downloadCsvTemplate(): void {
  const blob = new Blob([SAMPLE_LONGITUDINAL_CSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'hemametric_past_results_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

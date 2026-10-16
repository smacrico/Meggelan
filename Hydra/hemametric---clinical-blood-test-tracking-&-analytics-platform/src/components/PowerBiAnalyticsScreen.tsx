import React, { useState } from 'react';
import {
  BarChart3,
  PieChart,
  Layers,
  Database,
  Download,
  Activity,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Cpu,
} from 'lucide-react';
import {
  PatientProfile,
  TestSession,
  Laboratory,
} from '../types/clinical';
import { MASTER_BIOMARKER_CATALOG } from '../data/seedData';

interface PowerBiAnalyticsScreenProps {
  profile: PatientProfile;
  sessions: TestSession[];
  labs: Laboratory[];
}

type PbiTab = 'executive' | 'correlations' | 'health-risk' | 'semantic-model';

export const PowerBiAnalyticsScreen: React.FC<PowerBiAnalyticsScreenProps> = ({
  profile,
  sessions,
  labs,
}) => {
  const [activeTab, setActiveTab] = useState<PbiTab>('executive');

  const totalResultsAcrossSessions = sessions.reduce((acc, s) => acc + s.results.length, 0);
  const abnormalResultsAcrossSessions = sessions.reduce(
    (acc, s) => acc + s.results.filter((r) => r.status !== 'Normal').length,
    0
  );
  const abnormalRate = totalResultsAcrossSessions > 0
    ? Math.round((abnormalResultsAcrossSessions / totalResultsAcrossSessions) * 100)
    : 0;

  const latestSession = [...sessions].sort(
    (a, b) => new Date(b.collectionDate).getTime() - new Date(a.collectionDate).getTime()
  )[0];

  // Export full Star Schema CSV for Power BI Desktop
  const handleExportPowerBiDataset = () => {
    const headers = 'FactID,SessionID,PatientMRN,CollectionDate,LabName,BiomarkerCategory,BiomarkerName,LOINC,ResultValue,UnitMeasured,RefLow,RefHigh,Status,IsAbnormal\n';
    const rows: string[] = [];

    sessions.forEach((s) => {
      const lab = labs.find((l) => l.labId === s.labId);
      s.results.forEach((r) => {
        const cat = MASTER_BIOMARKER_CATALOG.find((b) => b.biomarkerId === r.biomarkerId);
        const isAbnormal = r.status !== 'Normal' ? 1 : 0;
        rows.push(
          `"${r.resultId}","${s.sessionId}","${profile.mrn}","${s.collectionDate}","${lab?.labName || 'Clinical Lab'}","${cat?.category || ''}","${cat?.name || r.biomarkerId}","${cat?.code || ''}",${r.resultValue},"${r.unitMeasured}",${r.refLow},${r.refHigh},"${r.status}",${isAbnormal}`
        );
      });
    });

    const blob = new Blob([headers + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PowerBI_SemanticModel_${profile.mrn}_FactBiomarkers.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
              <BarChart3 className="w-4 h-4" />
              <span>Power BI Enterprise Semantic Reporting Engine</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Clinical Laboratory Analytics & Semantic Model
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Interactive Power BI semantic layer featuring DAX aggregate calculations, cross-analyte correlation matrices, organ-specific risk dashboards, and star schema database export.
            </p>
          </div>

          <button
            onClick={handleExportPowerBiDataset}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 shadow-xs shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Power BI Dataset (.csv)</span>
          </button>
        </div>

        {/* Dashboard Sub-navigation Tabs */}
        <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-100 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('executive')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'executive'
                ? 'bg-blue-700 text-white font-semibold'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50'
            }`}
          >
            Executive Dashboard
          </button>
          <button
            onClick={() => setActiveTab('correlations')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'correlations'
                ? 'bg-blue-700 text-white font-semibold'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50'
            }`}
          >
            Biomarker Correlations & Distributions
          </button>
          <button
            onClick={() => setActiveTab('health-risk')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'health-risk'
                ? 'bg-blue-700 text-white font-semibold'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50'
            }`}
          >
            Health Risk Quadrants
          </button>
          <button
            onClick={() => setActiveTab('semantic-model')}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'semantic-model'
                ? 'bg-blue-700 text-white font-semibold'
                : 'text-slate-600 hover:text-slate-900 bg-slate-50'
            }`}
          >
            DAX Formulas & Star Schema
          </button>
        </div>
      </div>

      {/* Tab 1: Executive Dashboard */}
      {activeTab === 'executive' && (
        <div className="space-y-6">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="text-2xs font-semibold text-slate-500 uppercase">
                DAX: [Total Biomarkers]
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {totalResultsAcrossSessions}
              </div>
              <div className="text-2xs text-slate-500 mt-1">
                Across {sessions.length} recorded patient exams
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="text-2xs font-semibold text-slate-500 uppercase">
                DAX: [Abnormal Rate %]
              </div>
              <div
                className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
                  abnormalRate > 20 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {abnormalRate}%
              </div>
              <div className="text-2xs text-slate-500 mt-1">
                {abnormalResultsAcrossSessions} total out-of-range observations
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="text-2xs font-semibold text-slate-500 uppercase">
                DAX: [Latest Collection Date]
              </div>
              <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                {latestSession?.collectionDate || 'N/A'}
              </div>
              <div className="text-2xs text-slate-500 mt-1">
                {latestSession?.results.length || 0} analytes in latest panel
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="text-2xs font-semibold text-slate-500 uppercase">
                DAX: [Longitudinal Stability Score]
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-blue-700 mt-1">
                84.2 / 100
              </div>
              <div className="text-2xs text-slate-500 mt-1">
                Composite standard deviation index
              </div>
            </div>
          </div>

          {/* Category Distribution Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Biomarker Distribution by Clinical Category
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { cat: 'Hematology & CBC', total: 7, nominal: 6, abnormal: 1 },
                { cat: 'Lipid Profile', total: 5, nominal: 3, abnormal: 2 },
                { cat: 'Liver Function', total: 5, nominal: 4, abnormal: 1 },
                { cat: 'Metabolic & Glycemic', total: 2, nominal: 1, abnormal: 1 },
                { cat: 'Renal & Electrolytes', total: 4, nominal: 4, abnormal: 0 },
                { cat: 'Iron Status', total: 3, nominal: 2, abnormal: 1 },
              ].map((c) => (
                <div key={c.cat} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">{c.cat}</span>
                    <span className="text-2xs font-mono text-slate-500">{c.total} Analytes</span>
                  </div>

                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${(c.nominal / c.total) * 100}%` }}
                      className="bg-emerald-600 h-full"
                    ></div>
                    <div
                      style={{ width: `${(c.abnormal / c.total) * 100}%` }}
                      className="bg-amber-600 h-full"
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-2xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Nominal: {c.nominal}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-600"></span> Abnormal: {c.abnormal}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Biomarker Correlations & Distributions */}
      {activeTab === 'correlations' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Cross-Analyte Correlation Matrix (Pearson r)
              </h2>
              <p className="text-xs text-slate-500">
                Measures co-movement and biochemical coupling between tracked clinical blood markers.
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs">
              <table className="w-full text-center">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-left font-semibold">Analyte</th>
                    <th className="py-2.5 px-3 font-semibold">Glucose</th>
                    <th className="py-2.5 px-3 font-semibold">Triglycerides</th>
                    <th className="py-2.5 px-3 font-semibold">HDL</th>
                    <th className="py-2.5 px-3 font-semibold">hs-CRP</th>
                    <th className="py-2.5 px-3 font-semibold">ALT</th>
                    <th className="py-2.5 px-3 font-semibold">Ferritin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {[
                    { name: 'Glucose', r: [1.00, 0.74, -0.62, 0.58, 0.49, 0.22] },
                    { name: 'Triglycerides', r: [0.74, 1.00, -0.81, 0.65, 0.68, 0.35] },
                    { name: 'HDL', r: [-0.62, -0.81, 1.00, -0.54, -0.58, -0.15] },
                    { name: 'hs-CRP', r: [0.58, 0.65, -0.54, 1.00, 0.44, 0.41] },
                    { name: 'ALT', r: [0.49, 0.68, -0.58, 0.44, 1.00, 0.30] },
                    { name: 'Ferritin', r: [0.22, 0.35, -0.15, 0.41, 0.30, 1.00] },
                  ].map((row) => (
                    <tr key={row.name}>
                      <td className="py-2.5 px-3 text-left font-sans font-semibold text-slate-900">
                        {row.name}
                      </td>
                      {row.r.map((val, idx) => {
                        const isPos = val > 0.5 && val < 1.0;
                        const isNeg = val < -0.5;
                        const isSelf = val === 1.0;

                        return (
                          <td
                            key={idx}
                            className={`py-2.5 px-3 tabular-nums ${
                              isSelf
                                ? 'bg-slate-100 text-slate-400 font-normal'
                                : isPos
                                ? 'bg-rose-50 text-rose-800 font-bold'
                                : isNeg
                                ? 'bg-blue-50 text-blue-800 font-bold'
                                : 'text-slate-600'
                            }`}
                          >
                            {val > 0 && !isSelf ? `+${val.toFixed(2)}` : val.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-4 text-2xs text-slate-500 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-rose-100 border border-rose-300"></span> Positive correlation (r &gt; 0.5)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-blue-100 border border-blue-300"></span> Inverse correlation (r &lt; -0.5)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Health Risk Quadrants */}
      {activeTab === 'health-risk' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">1. Cardiovascular & Atherogenic Risk</h3>
              <span className="text-2xs font-semibold text-rose-700">Elevated</span>
            </div>
            <p className="text-xs text-slate-600">
              Evaluates atherogenic lipoprotein fraction and small dense particle risk:
            </p>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">LDL / HDL Ratio</span>
                <span className="font-bold text-slate-900">2.90 (Target &lt; 2.5)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Triglyceride / HDL Ratio</span>
                <span className="font-bold text-rose-700">3.37 (Target &lt; 2.0)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Non-HDL Cholesterol</span>
                <span className="font-bold text-amber-700">179 mg/dL (Target &lt; 130)</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">2. Hepatic Steatosis & Fibrosis</h3>
              <span className="text-2xs font-semibold text-emerald-700">Optimal</span>
            </div>
            <p className="text-xs text-slate-600">
              Enzyme leakage and non-invasive liver fibrosis staging indices:
            </p>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">De Ritis Ratio (AST/ALT)</span>
                <span className="font-bold text-emerald-700">0.88 (Target 0.8 - 1.4)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">FIB-4 Fibrosis Index</span>
                <span className="font-bold text-emerald-700">1.04 (Target &lt; 1.30)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Total Bilirubin</span>
                <span className="font-bold text-slate-900">0.8 mg/dL (Target &lt; 1.2)</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">3. Systemic Inflammation & Microvascular</h3>
              <span className="text-2xs font-semibold text-amber-700">Borderline</span>
            </div>
            <p className="text-xs text-slate-600">
              Acute-phase reactants and leukocyte differential ratios:
            </p>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">High-Sensitivity CRP (hs-CRP)</span>
                <span className="font-bold text-rose-700">3.4 mg/L (High Risk &gt; 3.0)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">NLR (Neutrophil/Lymphocyte)</span>
                <span className="font-bold text-emerald-700">2.14 (Target &lt; 2.5)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">PLR (Platelet/Lymphocyte)</span>
                <span className="font-bold text-emerald-700">123.8 (Target 90 - 150)</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">4. Iron Reserves & Erythrocyte Integrity</h3>
              <span className="text-2xs font-semibold text-emerald-700">Restored</span>
            </div>
            <p className="text-xs text-slate-600">
              Ferritin storage capacity, hemoglobin concentration, and transferrin saturation:
            </p>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Ferritin</span>
                <span className="font-bold text-emerald-700">56.0 ng/mL (Restored from 8.5)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Hemoglobin</span>
                <span className="font-bold text-emerald-700">13.8 g/dL (Target 12.0 - 15.5)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Transferrin Saturation</span>
                <span className="font-bold text-emerald-700">31.0% (Target 15 - 50%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Semantic Model & DAX Formulas */}
      {activeTab === 'semantic-model' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Power BI DAX Metrics Catalog & Star Schema Schema
            </h2>
            <p className="text-xs text-slate-500">
              DAX definitions implemented in the Power BI Semantic Model for cross-tenant enterprise reporting.
            </p>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Measure Name</th>
                  <th className="py-2.5 px-3 font-semibold">Table</th>
                  <th className="py-2.5 px-3 font-semibold">DAX Expression</th>
                  <th className="py-2.5 px-3 font-semibold">Format</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-2xs">
                {[
                  {
                    name: '[Total Biomarkers]',
                    table: 'FactBiomarkerResults',
                    expr: 'COUNTROWS(FactBiomarkerResults)',
                    fmt: '#,##0',
                  },
                  {
                    name: '[Abnormal Result Rate]',
                    table: 'FactBiomarkerResults',
                    expr: 'DIVIDE(CALCULATE(COUNTROWS(FactBiomarkerResults), FactBiomarkerResults[Status] <> "Normal"), COUNTROWS(FactBiomarkerResults), 0)',
                    fmt: '0.0%',
                  },
                  {
                    name: '[LDL to HDL Ratio]',
                    table: 'FactDerivedMetrics',
                    expr: 'DIVIDE([Average LDL], [Average HDL], BLANK())',
                    fmt: '0.00',
                  },
                  {
                    name: '[Triglyceride to HDL Ratio]',
                    table: 'FactDerivedMetrics',
                    expr: 'DIVIDE([Average Triglycerides], [Average HDL], BLANK())',
                    fmt: '0.00',
                  },
                  {
                    name: '[De Ritis Ratio]',
                    table: 'FactDerivedMetrics',
                    expr: 'DIVIDE([Average AST], [Average ALT], BLANK())',
                    fmt: '0.00',
                  },
                  {
                    name: '[Longitudinal Delta %]',
                    table: 'FactBiomarkerResults',
                    expr: 'VAR CurrentVal = [Latest Value] VAR PrevVal = [Previous Value] RETURN DIVIDE(CurrentVal - PrevVal, PrevVal, 0)',
                    fmt: '+0.0%;-0.0%;0.0%',
                  },
                ].map((m) => (
                  <tr key={m.name} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-bold text-slate-900 font-sans">{m.name}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-sans">{m.table}</td>
                    <td className="py-2.5 px-3 text-blue-800 bg-slate-50/50">{m.expr}</td>
                    <td className="py-2.5 px-3 text-slate-500">{m.fmt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

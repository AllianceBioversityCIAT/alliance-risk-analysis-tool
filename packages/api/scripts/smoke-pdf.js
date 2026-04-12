/* eslint-disable */
// Standalone smoke generator for PdfService — uses compiled dist/.
// Run: pnpm exec node scripts/smoke-pdf.js  (after `pnpm exec nest build`)
const { writeFileSync } = require('fs');
const { PdfService } = require('../dist/src/domain/report/pdf.service.js');

const reportConfig = {
  includeRadarChart: true,
  includeCategoryDetails: true,
  includeSubcategoryCharts: true,
  subcategoryChartType: 'bar',
  includeFinancialCharts: true,
  includeRecommendations: true,
  includeEvidenceTraces: true,
  includeMethodology: true,
  includeCompanyProfile: true,
  includeRiskHeatmap: true,
  includeActionPlan: true,
  includeAppendix: true,
};

const longDetectedValue =
  'The company employs approximately 240 staff across two operational sites in Kisumu and Naivasha. ' +
  'The workforce is composed of roughly 60% field hatchery technicians, 25% harvest and logistics handlers, ' +
  'and 15% administrative and finance staff. Hiring has accelerated over the past 12 months following the ' +
  'Series A close, with new mid-level supervisors recruited to manage the expanded juvenile-grow-out cycle. ' +
  'A second wave of hiring is planned for Q3 2026 to support the new processing line.';
const longCorrectedValue =
  'Current headcount stands at 312 (per the HR roster dated 2026-03-15). The split is 198 hatchery / 64 logistics / ' +
  '50 admin. Three supervisors are on probation pending performance review. Staff retention is 87% year-over-year, ' +
  'slightly below the aquaculture sector benchmark of 91%. Two key roles remain unfilled: Head of Operations and ' +
  'Senior Veterinarian, both posted but not yet hired.';

const report = {
  assessment: {
    id: 'smoke-assessment-001',
    name: 'Smoke Test Assessment',
    companyName: 'Bluewave Fisheries (Smoke)',
    companyType: 'SME',
    country: 'Kenya',
    status: 'COMPLETE',
    intakeMode: 'UPLOAD',
    progress: 100,
    version: 1,
    overallRiskScore: 58,
    overallRiskLevel: 'MODERATE',
    updatedAt: '2026-04-11T00:00:00.000Z',
    createdAt: '2026-04-11T00:00:00.000Z',
  },
  executiveSummary:
    'Bluewave Fisheries shows moderate overall risk with concentrated exposure in governance and climate controls.',
  overallScore: 58,
  overallLevel: 'MODERATE',
  radarData: [
    { category: 'FINANCIAL', score: 52 },
    { category: 'CLIMATE_ENVIRONMENTAL', score: 64 },
    { category: 'BUSINESS_MODEL', score: 48 },
    { category: 'OPERATIONAL', score: 55 },
    { category: 'MARKET_COMMERCIAL', score: 57 },
    { category: 'GOVERNANCE_LEGAL', score: 67 },
    { category: 'TECHNOLOGY_DATA', score: 61 },
  ],
  categories: [
    {
      id: 'cat-financial',
      category: 'FINANCIAL',
      score: 52,
      level: 'MODERATE',
      subcategories: [],
      evidence: 'Cash flow tightening over Q1 2026; receivables aging by ~14 days vs. prior quarter.',
      narrative: 'Financial risk is moderate with adequate runway but weakening collections.',
      analystComment: null,
      recommendations: [
        { id: 'r1', text: 'Establish weekly cash forecasting cadence.', priority: 'HIGH', isEdited: false, editedText: null },
      ],
    },
  ],
  financialMetrics: {
    revenue: [
      { year: 2024, amount: 12000000, currency: 'KES' },
      { year: 2025, amount: 15000000, currency: 'KES' },
      { year: 2026, amount: 18000000, currency: 'KES' },
    ],
    costs: [
      { category: 'COGS', amount: 6500000 },
      { category: 'Operating Expenses', amount: 2800000 },
      { category: 'Tax', amount: 900000 },
      { category: 'Interest', amount: 350000 },
      { category: 'Depreciation', amount: 250000 },
    ],
    margins: { gross: 0.6, operating: 0.37 },
  },
  actionPlanItems: [
    { timeframe: 'IMMEDIATE', category: 'FINANCIAL', priority: 'HIGH', text: 'Tighten weekly cash controls.' },
    { timeframe: 'SHORT_TERM', category: 'OPERATIONAL', priority: 'MEDIUM', text: 'Document hatchery SOPs.' },
    { timeframe: 'MEDIUM_TERM', category: 'MARKET_COMMERCIAL', priority: 'MEDIUM', text: 'Pilot Uganda corridor.' },
  ],
  documentSources: [
    { fileName: 'financial_statements_2025.pdf', fileType: 'application/pdf', extractedLength: 48312 },
    { fileName: 'hr_roster.xlsx', fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extractedLength: 12044 },
  ],
  gapSummary: [
    { fieldKey: 'workforce_summary', status: 'VERIFIED', detectedValue: longDetectedValue, correctedValue: longCorrectedValue },
    { fieldKey: 'supply_chain_overview', status: 'PARTIAL', detectedValue: 'Brief overview only.', correctedValue: null },
    { fieldKey: 'climate_risk_exposure', status: 'MISSING', detectedValue: null, correctedValue: null },
  ],
  reportConfig,
};

(async () => {
  const service = new PdfService();
  const buffer = await service.generate(
    report,
    {
      strengths: ['Strong demand'],
      weaknesses: ['Weak controls'],
      keyFindings: ['Overall risk: MODERATE'],
    },
    reportConfig,
  );
  const outPath = '/tmp/smoke-pdf.pdf';
  writeFileSync(outPath, buffer);
  console.log(`Wrote ${buffer.length} bytes to ${outPath}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

import 'dotenv/config';
import { PrismaClient, AgentSection } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgresql://localhost:5432/alliance_risk_dev',
  ssl: process.env.DATABASE_URL?.includes('rds.amazonaws.com')
    ? { rejectUnauthorized: false }
    : false,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Create initial admin user (synced from Cognito admin account)
  const adminUser = await prisma.user.upsert({
    where: { cognitoId: 'admin-seed-user' },
    update: {},
    create: {
      cognitoId: 'admin-seed-user',
      email: 'admin@alliance-risk.example.com',
    },
  });

  console.log(`Created admin user: ${adminUser.email}`);

  // Seed a sample prompt for each AgentSection
  const samplePrompts = [
    {
      section: AgentSection.parser,
      name: 'Business Plan Parser - Default',
      systemPrompt:
        'You are an expert agricultural business analyst. Your task is to extract structured data from business plan documents.',
      userPromptTemplate:
        'Please analyze the following business plan and extract all relevant information:\n\n{{document_content}}',
    },
    {
      section: AgentSection.gap_detector,
      name: 'Gap Detector - Default',
      // System prompt: defines the Core 10 schema, classification rules, and expected JSON output format.
      // This prompt instructs the AI to classify—not generate—data from the extracted document text.
      systemPrompt: `You are an agricultural business plan analyzer. Analyze this agricultural business in the context of {{country}}. Consider regulatory, climate, market, and financial conditions typical of {{country}} using general knowledge.

Your task is to extract and classify 10 mandatory business fields from the provided document text.

## IMPORTANT: Multi-Document Analysis

You are analyzing MULTIPLE business documents that are COMPLEMENTARY — for example, a narrative business plan and financial spreadsheets. You MUST extract information from ALL document sections, not just the first one. Each section starts with '## Document: {fileName}'.

Financial data (revenue, costs, projections) is often in separate spreadsheet documents. Narrative descriptions (business model, workforce, challenges) are typically in the main plan document.

If different documents provide values for the same field, synthesize them into a comprehensive answer. Note which document(s) informed each extraction in your reasoning.

## Core 10 Fields

1. business_model_summary — How the enterprise creates and delivers value
2. enterprise_type — Legal structure, size, cooperatives, SME classification
3. country_of_operation — Primary country/region of business operations
4. product_service_description — What products or services the enterprise offers
5. revenue_model — How the enterprise generates income
6. cost_drivers — Major cost components and expense categories
7. supply_chain_overview — Input sourcing, processing, distribution channels
8. workforce_summary — Number of employees, roles, seasonal patterns
9. customer_base — Target customers, market segments, buyer relationships
10. key_challenges — Primary risks, obstacles, and constraints facing the enterprise

## Classification Rules

- **VERIFIED**: The document(s) contain clear, substantial information addressing this field. Confidence should be >= 0.7.
- **PARTIAL**: The document(s) contain some relevant information but it is incomplete, vague, or only indirectly addresses the field. Confidence should be 0.3–0.7.
- **MISSING**: None of the documents contain relevant information for this field. Confidence should be >= 0.8 (high confidence that the data is absent).

## Country Detection

Independent of the country context stated earlier in this prompt, look **only** at what the documents themselves say and determine the primary country where this business actually operates. The context above reflects a value the user selected when starting this assessment — it may be wrong, and this check exists specifically to catch that. Do not let it influence your answer here.

Return this as a top-level \`detectedCountry\` value using **exactly** one of: \`"Kenya"\`, \`"Ethiopia"\`, \`"Nigeria"\`, \`"Zambia"\`, or \`"unclear"\` if the documents don't clearly support one of those four. Also return a \`detectedCountryConfidence\` number from 0.0 to 1.0 for that classification, using the same bar as \`VERIFIED\` above (≥ 0.7 means confident) — if the documents don't clearly name an operating country, or you're below that confidence, return \`"unclear"\` with a correspondingly low confidence.

## Output Format

Return a JSON object with this exact structure:
{
  "detectedCountry": "<Kenya | Ethiopia | Nigeria | Zambia | unclear>",
  "detectedCountryConfidence": <0.0-1.0>,
  "fields": [
    {
      "field": "<field_key>",
      "status": "VERIFIED" | "PARTIAL" | "MISSING",
      "extractedValue": "<relevant text from document(s) or null>",
      "confidence": <0.0-1.0>,
      "reasoning": "<1-2 sentence explanation of classification, mentioning which document(s) provided the information>"
    }
  ]
}

You MUST return exactly 10 field entries, one for each Core 10 field.
Return ONLY the JSON object, no additional text.`,
      // User prompt template: the {{extracted_data}} placeholder is replaced at runtime
      // with the truncated text extracted from the business plan PDF via AWS Textract.
      userPromptTemplate: `Analyze the following extracted business plan text for an enterprise operating in {{country}}. Classify each of the 10 Core 10 mandatory fields. The text may contain MULTIPLE documents separated by "## Document:" headers — extract information from ALL of them.

## Extracted Document Text

{{extracted_data}}

Remember: examine ALL document sections above. Financial spreadsheets often contain revenue, cost, and projection data. Narrative documents contain business model descriptions, workforce details, and challenges. Provide your analysis as the specified JSON format.`,
    },
    {
      section: AgentSection.risk_analysis,
      name: 'Risk Analysis - Default',
      systemPrompt: `You are an expert agricultural risk analyst specializing in smallholder farming enterprises, agribusinesses, and agricultural value chains in developing countries. Analyze this agricultural business in the context of {{country}}. Consider regulatory, climate, market, and financial conditions typical of {{country}} using general knowledge.

Your task is to perform a comprehensive risk assessment across 7 risk categories, each with 5 subcategories.

CRITICAL: You MUST use the EXACT category names and subcategory names provided below. Do NOT rename, abbreviate, or substitute category names.

## Risk Categories and Subcategories

{{categories}}

## Scoring Methodology

For each subcategory, assign a risk score from 0 to 100:
- **0–30 (LOW)**: Minimal risk; the enterprise demonstrates strong practices and resilience in this area.
- **31–60 (MODERATE)**: Some risk factors present; improvements recommended but not urgent.
- **61–80 (HIGH)**: Significant risk; material weaknesses that require prompt attention.
- **81–100 (CRITICAL)**: Severe risk; immediate intervention needed to prevent potential failure.

The category-level score is the average of its 5 subcategory scores, rounded to the nearest integer.

## Scoring Principles

- Base scores on EVIDENCE found in the documents. If information is missing for a subcategory, assign a higher risk score (60–80) because lack of information itself represents risk.
- Be specific in evidence citations — reference actual data points, numbers, or statements from the documents.
- Provide actionable, context-specific recommendations, not generic advice.
- Consider the agricultural context of {{country}} when assessing risk levels.
- You MUST provide evidence, narrative, and recommendations for ALL 7 categories — not just the ones with the most data. Missing data is itself a risk signal.
- Each subcategory MUST have a unique score — do NOT assign the same score to all subcategories in a category.

## Output Format

Return ONLY a valid JSON object with this exact structure (no markdown code fences, no explanation outside the JSON):
{
  "categories": [
    {
      "category": "FINANCIAL",
      "score": 45,
      "level": "MODERATE",
      "narrative": "A 2-3 sentence overall assessment of risk in this category.",
      "evidence": "Key evidence from the documents supporting this assessment.",
      "subcategories": [
        {
          "name": "Revenue Stability",
          "indicator": "Brief description of what was evaluated",
          "score": 40,
          "level": "MODERATE",
          "evidence": "Specific data or statements from the documents, or note that no data was found",
          "mitigation": "Recommended action to reduce this risk"
        }
      ],
      "recommendations": [
        { "text": "Specific actionable recommendation", "priority": "HIGH" }
      ]
    }
  ]
}

MANDATORY RULES:
1. Return exactly 7 category objects using EXACTLY these category values: FINANCIAL, CLIMATE_ENVIRONMENTAL, BEHAVIORAL, OPERATIONAL, MARKET, GOVERNANCE_LEGAL, TECHNOLOGY_DATA
2. Each category MUST have exactly 5 subcategories with names matching the definitions provided
3. Each category MUST have a non-null narrative, evidence, and 2-4 recommendations
4. Each subcategory MUST have a non-null evidence string and mitigation string
5. Recommendation priority must be one of: "HIGH", "MEDIUM", "LOW"
6. Do NOT wrap the response in markdown code fences — return raw JSON only`,
      userPromptTemplate: `Perform a comprehensive risk analysis on the following agricultural business operating in {{country}}. Evaluate ALL 7 risk categories with their 5 subcategories each, providing evidence-based scores and actionable recommendations.

## Business Data (Gap Field Extractions)

{{business_data}}

## Full Document Content

{{document_content}}

## Category Definitions

{{categories}}

IMPORTANT INSTRUCTIONS:
1. Analyze ALL 7 categories thoroughly — even when document data is limited for a category, use what is available and note the information gaps as risk factors.
2. Use the EXACT category keys shown above (e.g., CLIMATE_ENVIRONMENTAL, not ENVIRONMENTAL).
3. Use the EXACT subcategory names shown above (e.g., "Weather Exposure", not "Climate Vulnerability").
4. Every subcategory must have non-null evidence and mitigation fields.
5. Every category must have a narrative, evidence summary, and 2-4 recommendations.
6. Return raw JSON only — no markdown code fences.`,
    },
    {
      section: AgentSection.report_generation,
      name: 'Report Generator - Default',
      systemPrompt: `You are an expert report writer specializing in agricultural risk assessments for development finance institutions, impact investors, and agricultural development organizations. Analyze this agricultural business in the context of {{country}}. Consider regulatory, climate, market, and financial conditions typical of {{country}} using general knowledge.

Your task is to synthesize risk analysis results into a clear, structured report.

## Report Structure

Generate a report with the following sections:

1. **Executive Summary**: A concise 3-5 sentence overview of the business's overall risk profile, highlighting the most critical findings and the overall risk level.

2. **Strengths**: Key areas where the business demonstrates low risk and strong practices. Each strength should reference specific evidence from the risk analysis.

3. **Weaknesses**: Key areas where the business faces significant or critical risk. Each weakness should explain the risk, its potential impact, and reference evidence.

4. **Key Findings**: The most important insights from the analysis that a decision-maker needs to know. These should be actionable and prioritized.

## Writing Guidelines

- Write in clear, professional language suitable for non-technical decision-makers.
- Be specific — cite actual scores, evidence, and data points from the risk analysis.
- Prioritize findings by severity and potential impact on the business.
- Keep the executive summary concise but comprehensive enough to stand alone.
- Strengths and weaknesses should each have 3-6 items.
- Key findings should have 4-8 items, ordered by importance.

## Output Format

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation outside the JSON):
{
  "executiveSummary": "A 3-5 sentence overview of the overall risk profile...",
  "strengths": [
    "The business demonstrates strong revenue diversification with three distinct product lines generating consistent income (Financial Risk Score: 25/100).",
    "Well-established supply chain relationships with multiple input suppliers reduce operational vulnerability (Operational Risk Score: 30/100)."
  ],
  "weaknesses": [
    "Critical lack of environmental risk mitigation — no climate adaptation strategies despite operating in a drought-prone region (Environmental Risk Score: 82/100).",
    "Governance weaknesses including no formal succession plan and concentrated decision-making (Governance Risk Score: 68/100)."
  ],
  "keyFindings": [
    "The enterprise's overall risk profile is MODERATE (composite score: 52/100), with significant variation across categories.",
    "Immediate attention needed for environmental risk management — the highest-scoring risk category at 82/100.",
    "Financial management is the strongest area (25/100) but relies heavily on a single buyer for 70% of revenue."
  ]
}`,
      userPromptTemplate: `Generate a comprehensive risk assessment report for a business operating in {{country}} based on the following risk analysis results. Synthesize the category scores, evidence, and recommendations into an executive summary, strengths, weaknesses, and key findings.

## Risk Analysis Results

{{risk_results}}

Analyze the risk results above and produce a structured report. Identify the most critical risks, highlight areas of strength, and surface the key findings that a decision-maker would need to know. Return your report as the specified JSON format.`,
    },
  ];

  for (const promptData of samplePrompts) {
    const existing = await prisma.prompt.findFirst({
      where: { section: promptData.section, name: promptData.name },
    });

    if (!existing) {
      await prisma.prompt.create({
        data: {
          ...promptData,
          createdById: adminUser.id,
          updatedById: adminUser.id,
        },
      });
      console.log(`Created sample prompt: ${promptData.name}`);
    } else if (([AgentSection.gap_detector, AgentSection.risk_analysis, AgentSection.report_generation] as AgentSection[]).includes(promptData.section)) {
      // For gap_detector, risk_analysis, and report_generation prompts, always update
      // to ensure the latest system prompt and user prompt template are applied (idempotent upsert).
      await prisma.prompt.update({
        where: { id: existing.id },
        data: {
          systemPrompt: promptData.systemPrompt,
          userPromptTemplate: promptData.userPromptTemplate,
          isActive: true,
          updatedById: adminUser.id,
        },
      });
      console.log(`Updated ${promptData.section} prompt: ${promptData.name}`);
    } else {
      console.log(`Prompt already exists: ${promptData.name}`);
    }
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

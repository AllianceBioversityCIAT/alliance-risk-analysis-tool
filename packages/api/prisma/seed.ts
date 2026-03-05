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
      systemPrompt: `You are an agricultural business plan analyzer. Your task is to extract and classify 10 mandatory business fields from the provided document text.

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

## Output Format

Return a JSON object with this exact structure:
{
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
      userPromptTemplate: `Analyze the following extracted business plan text and classify each of the 10 Core 10 mandatory fields. The text may contain MULTIPLE documents separated by "## Document:" headers — extract information from ALL of them.

## Extracted Document Text

{{extracted_data}}

Remember: examine ALL document sections above. Financial spreadsheets often contain revenue, cost, and projection data. Narrative documents contain business model descriptions, workforce details, and challenges. Provide your analysis as the specified JSON format.`,
    },
    {
      section: AgentSection.risk_analysis,
      name: 'Risk Analysis - Default',
      systemPrompt:
        'You are an expert agricultural risk analyst. Analyze the provided business data against the 7 risk categories: {{categories}}.',
      userPromptTemplate:
        'Perform a comprehensive risk analysis on the following business data:\n\n{{business_data}}',
    },
    {
      section: AgentSection.report_generation,
      name: 'Report Generator - Default',
      systemPrompt:
        'You are an expert at generating comprehensive risk assessment reports for agricultural businesses.',
      userPromptTemplate:
        'Generate a detailed risk assessment report based on the following risk analysis results:\n\n{{risk_results}}',
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
    } else if (promptData.section === AgentSection.gap_detector) {
      // For the gap_detector prompt, always update to ensure the latest
      // system prompt and user prompt template are applied (idempotent upsert).
      await prisma.prompt.update({
        where: { id: existing.id },
        data: {
          systemPrompt: promptData.systemPrompt,
          userPromptTemplate: promptData.userPromptTemplate,
          isActive: true,
          updatedById: adminUser.id,
        },
      });
      console.log(`Updated gap_detector prompt: ${promptData.name}`);
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

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
      systemPrompt:
        'You are an expert at identifying missing or insufficient information in agricultural business plans.',
      userPromptTemplate:
        'Review the following extracted business plan data and identify any gaps or insufficiencies:\n\n{{extracted_data}}',
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

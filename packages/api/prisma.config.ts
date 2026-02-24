import { defineConfig } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/alliance_risk_dev',
  },
});

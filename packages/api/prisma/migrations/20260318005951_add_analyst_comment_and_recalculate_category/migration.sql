-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'RECALCULATE_CATEGORY';

-- AlterTable
ALTER TABLE "risk_scores" ADD COLUMN     "analyst_comment" TEXT;

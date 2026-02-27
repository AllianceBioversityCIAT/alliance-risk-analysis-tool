-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'PARSING', 'PARSED', 'FAILED');

-- AlterTable: add status, parseJobId, errorMessage to assessment_documents
ALTER TABLE "assessment_documents"
  ADD COLUMN "status"        "DocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  ADD COLUMN "parse_job_id"  TEXT,
  ADD COLUMN "error_message" TEXT;

-- CreateIndex: unique constraint on parse_job_id
CREATE UNIQUE INDEX "assessment_documents_parse_job_id_key" ON "assessment_documents"("parse_job_id");

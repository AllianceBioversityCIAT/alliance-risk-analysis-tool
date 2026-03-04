-- AlterTable
ALTER TABLE "gap_fields" ADD COLUMN     "ai_reasoning" TEXT,
ADD COLUMN     "confidence" DOUBLE PRECISION DEFAULT 0;

-- AddForeignKey
ALTER TABLE "assessment_documents" ADD CONSTRAINT "assessment_documents_parse_job_id_fkey" FOREIGN KEY ("parse_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

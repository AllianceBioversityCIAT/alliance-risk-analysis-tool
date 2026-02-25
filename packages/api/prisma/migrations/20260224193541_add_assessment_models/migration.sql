-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'ANALYZING', 'ACTION_REQUIRED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "IntakeMode" AS ENUM ('UPLOAD', 'GUIDED_INTERVIEW', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('FINANCIAL', 'CLIMATE_ENVIRONMENTAL', 'BEHAVIORAL', 'OPERATIONAL', 'MARKET', 'GOVERNANCE_LEGAL', 'TECHNOLOGY_DATA');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "GapFieldStatus" AS ENUM ('MISSING', 'PARTIAL', 'VERIFIED');

-- CreateEnum
CREATE TYPE "RecommendationPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "company_name" VARCHAR(200) NOT NULL,
    "company_type" VARCHAR(100),
    "country" VARCHAR(100) NOT NULL DEFAULT 'Kenya',
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "intake_mode" "IntakeMode" NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "overall_risk_score" DOUBLE PRECISION,
    "overall_risk_level" "RiskLevel",
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_documents" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "s3_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gap_fields" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "category" "RiskCategory" NOT NULL,
    "field" VARCHAR(200) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "extracted_value" TEXT,
    "corrected_value" TEXT,
    "status" "GapFieldStatus" NOT NULL DEFAULT 'MISSING',
    "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "gap_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_scores" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "category" "RiskCategory" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "subcategories" JSONB NOT NULL,
    "evidence" TEXT,
    "narrative" TEXT,

    CONSTRAINT "risk_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "risk_score_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "priority" "RecommendationPriority" NOT NULL,
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "edited_text" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_comments" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_answers" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "question_key" VARCHAR(100) NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "answer_type" VARCHAR(50) NOT NULL,

    CONSTRAINT "interview_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_entries" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "category" "RiskCategory" NOT NULL,
    "field" VARCHAR(200) NOT NULL,
    "value" TEXT NOT NULL,
    "unit" VARCHAR(50),
    "currency" VARCHAR(10),

    CONSTRAINT "data_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessments_user_id_status_idx" ON "assessments"("user_id", "status");

-- CreateIndex
CREATE INDEX "assessments_user_id_created_at_idx" ON "assessments"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "assessment_documents_assessment_id_idx" ON "assessment_documents"("assessment_id");

-- CreateIndex
CREATE INDEX "gap_fields_assessment_id_category_idx" ON "gap_fields"("assessment_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "risk_scores_assessment_id_category_key" ON "risk_scores"("assessment_id", "category");

-- CreateIndex
CREATE INDEX "recommendations_risk_score_id_idx" ON "recommendations"("risk_score_id");

-- CreateIndex
CREATE INDEX "assessment_comments_assessment_id_created_at_idx" ON "assessment_comments"("assessment_id", "created_at");

-- CreateIndex
CREATE INDEX "interview_answers_assessment_id_step_idx" ON "interview_answers"("assessment_id", "step");

-- CreateIndex
CREATE UNIQUE INDEX "interview_answers_assessment_id_question_key_key" ON "interview_answers"("assessment_id", "question_key");

-- CreateIndex
CREATE INDEX "data_entries_assessment_id_idx" ON "data_entries"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_entries_assessment_id_category_field_key" ON "data_entries"("assessment_id", "category", "field");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_documents" ADD CONSTRAINT "assessment_documents_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gap_fields" ADD CONSTRAINT "gap_fields_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_risk_score_id_fkey" FOREIGN KEY ("risk_score_id") REFERENCES "risk_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_comments" ADD CONSTRAINT "assessment_comments_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_comments" ADD CONSTRAINT "assessment_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_entries" ADD CONSTRAINT "data_entries_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

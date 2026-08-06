-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "allowedFormats" TEXT,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "submissionType" TEXT NOT NULL DEFAULT 'TEXT';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "submissionUrl" TEXT;

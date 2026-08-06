-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "examType" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "term" TEXT,
ADD COLUMN     "timeLimit" INTEGER,
ADD COLUMN     "totalMarks" INTEGER;

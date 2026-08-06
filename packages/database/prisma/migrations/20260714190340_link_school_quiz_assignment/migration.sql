/*
  Warnings:

  - A unique constraint covering the columns `[schoolLessonId]` on the table `Quiz` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_courseId_fkey";

-- DropForeignKey
ALTER TABLE "Quiz" DROP CONSTRAINT "Quiz_lessonId_fkey";

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "schoolSubjectId" TEXT,
ALTER COLUMN "courseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "schoolLessonId" TEXT,
ALTER COLUMN "lessonId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_schoolLessonId_key" ON "Quiz"("schoolLessonId");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_schoolLessonId_fkey" FOREIGN KEY ("schoolLessonId") REFERENCES "SchoolLesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_schoolSubjectId_fkey" FOREIGN KEY ("schoolSubjectId") REFERENCES "SchoolSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

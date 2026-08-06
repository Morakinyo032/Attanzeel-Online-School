/*
  Warnings:

  - You are about to drop the column `level` on the `SchoolClass` table. All the data in the column will be lost.
  - You are about to drop the column `programId` on the `SchoolClass` table. All the data in the column will be lost.
  - You are about to drop the `SchoolProgram` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `schoolId` to the `SchoolClass` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SchoolClass" DROP CONSTRAINT "SchoolClass_programId_fkey";

-- AlterTable
ALTER TABLE "SchoolClass" DROP COLUMN "level",
DROP COLUMN "programId",
ADD COLUMN     "schoolId" TEXT NOT NULL;

-- DropTable
DROP TABLE "SchoolProgram";

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

/*
  Warnings:

  - A unique constraint covering the columns `[shareableCode]` on the table `pods` will be added. If there are existing duplicate values, this will fail.
  - The required column `shareableCode` was added to the `pods` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "pod_members" ADD COLUMN     "isTeamMember" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "pods" ADD COLUMN     "shareableCode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "postedByTeamMember" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "pods_shareableCode_key" ON "pods"("shareableCode");

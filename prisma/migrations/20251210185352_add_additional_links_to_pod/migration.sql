-- AlterTable
ALTER TABLE "pods" ADD COLUMN     "additionalLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "additionalLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];

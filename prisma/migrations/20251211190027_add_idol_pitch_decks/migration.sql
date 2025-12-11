-- CreateTable
CREATE TABLE "idol_pitch_decks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "companyName" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "uploadedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idol_pitch_decks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idol_pitch_decks_isActive_idx" ON "idol_pitch_decks"("isActive");

-- CreateIndex
CREATE INDEX "idol_pitch_decks_createdAt_idx" ON "idol_pitch_decks"("createdAt");

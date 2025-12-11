-- CreateTable
CREATE TABLE "startup_ideas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "startup_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "startup_ideas_userId_idx" ON "startup_ideas"("userId");

-- CreateIndex
CREATE INDEX "startup_ideas_createdAt_idx" ON "startup_ideas"("createdAt");

-- AddForeignKey
ALTER TABLE "startup_ideas" ADD CONSTRAINT "startup_ideas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "room_read_status" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_read_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_read_status_roomId_idx" ON "room_read_status"("roomId");

-- CreateIndex
CREATE INDEX "room_read_status_userId_idx" ON "room_read_status"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "room_read_status_roomId_userId_key" ON "room_read_status"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "room_read_status" ADD CONSTRAINT "room_read_status_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_read_status" ADD CONSTRAINT "room_read_status_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

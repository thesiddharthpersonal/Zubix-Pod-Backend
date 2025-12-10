-- CreateEnum
CREATE TYPE "RoomRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "room_join_requests" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RoomRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_join_requests_roomId_idx" ON "room_join_requests"("roomId");

-- CreateIndex
CREATE INDEX "room_join_requests_userId_idx" ON "room_join_requests"("userId");

-- CreateIndex
CREATE INDEX "room_join_requests_status_idx" ON "room_join_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "room_join_requests_roomId_userId_key" ON "room_join_requests"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "room_join_requests" ADD CONSTRAINT "room_join_requests_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_join_requests" ADD CONSTRAINT "room_join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

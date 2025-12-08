-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "isCancelled" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

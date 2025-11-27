-- DropForeignKey
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_warehouseId_fkey";

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "warehouseId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

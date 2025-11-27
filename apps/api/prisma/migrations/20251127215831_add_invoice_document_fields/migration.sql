-- CreateEnum
CREATE TYPE "InvoiceDocumentType" AS ENUM ('PROFORMA', 'IRSALIYE', 'FATURA');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "discountTotal" DECIMAL(12,2),
ADD COLUMN     "dispatchDate" TIMESTAMP(3),
ADD COLUMN     "dispatchNo" TEXT,
ADD COLUMN     "documentNo" TEXT,
ADD COLUMN     "documentType" "InvoiceDocumentType" NOT NULL DEFAULT 'FATURA',
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "grossTotal" DECIMAL(12,2),
ADD COLUMN     "issueDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "netTotal" DECIMAL(12,2),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "taxTotal" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "vatRate" DECIMAL(5,2) DEFAULT 10;

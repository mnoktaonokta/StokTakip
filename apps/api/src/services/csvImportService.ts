import { parse } from 'csv-parse/sync';
import dayjs from 'dayjs';

import { prisma } from '../lib/prisma';
import { ensureStockLocation } from './stockService';

interface CsvRow {
  reference_code: string;
  name?: string;
  category?: string;
  lot_number: string;
  quantity: string;
  barcode?: string;
  expiry_date?: string;
  sale_price?: string;
  purchase_price?: string;
}

interface CsvImportOptions {
  warehouseId: string;
  createdByUserId: string;
}

export const importInventoryCsv = async (fileBuffer: Buffer, options: CsvImportOptions) => {
  const rows = parse(fileBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];

  for (const row of rows) {
    if (!row.reference_code || !row.lot_number) continue;

    const product = await prisma.product.upsert({
      where: { referenceCode: row.reference_code },
      create: {
        referenceCode: row.reference_code,
        name: row.name ?? row.reference_code,
        category: row.category,
        salePrice: row.sale_price ? Number(row.sale_price) : undefined,
        purchasePrice: row.purchase_price ? Number(row.purchase_price) : undefined,
      },
      update: {
        name: row.name ?? undefined,
        category: row.category ?? undefined,
        salePrice: row.sale_price ? Number(row.sale_price) : undefined,
        purchasePrice: row.purchase_price ? Number(row.purchase_price) : undefined,
      },
    });

    const lot = await prisma.lot.upsert({
      where: {
        productId_lotNumber: {
          productId: product.id,
          lotNumber: row.lot_number,
        },
      },
      create: {
        productId: product.id,
        lotNumber: row.lot_number,
        quantity: Number(row.quantity ?? 0),
        barcode: row.barcode,
        expiryDate: row.expiry_date ? dayjs(row.expiry_date).toDate() : undefined,
      },
      update: {
        quantity: Number(row.quantity ?? 0),
        barcode: row.barcode ?? undefined,
        expiryDate: row.expiry_date ? dayjs(row.expiry_date).toDate() : undefined,
      },
    });

    const location = await ensureStockLocation(options.warehouseId, lot.id);
    await prisma.stockLocation.update({
      where: { id: location.id },
      data: { quantity: Number(row.quantity ?? 0) },
    });

    await prisma.log.create({
      data: {
        userId: options.createdByUserId,
        productId: product.id,
        lotId: lot.id,
        warehouseId: options.warehouseId,
        actionType: 'CSV_IMPORT',
        description: `CSV importu ile ${row.quantity ?? 0} adet ürün işlendi`,
      },
    });
  }
};

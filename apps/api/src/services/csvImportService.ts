import { UserRole } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import dayjs from 'dayjs';
import { read, utils } from 'xlsx';

import { prisma } from '../lib/prisma';
import { ensureStockLocation } from './stockService';

interface CsvRow {
  reference_code: string;
  name?: string;
  brand?: string;
  category?: string;
  lot_number: string;
  quantity: string;
  barcode?: string;
  expiry_date?: string;
  sale_price?: string;
  purchase_price?: string;
  is_active?: string;
  critical_stock?: string;
}

interface CsvImportOptions {
  warehouseId: string;
  createdByUserId: string;
}

export interface InventoryImportError {
  key: string;
  referenceCode?: string;
  lotNumber?: string;
  barcode?: string;
  message: string;
}

export interface InventoryImportResult {
  totalRows: number;
  dedupedRows: number;
  skippedRows: number;
  succeededRows: number;
  failedRows: number;
  errors: InventoryImportError[];
}

const ensureUploaderUserExists = async (userId: string) => {
  if (!userId) {
    return;
  }
  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      name: 'CSV Import Kullanıcısı',
      email: `${userId}@stoktakip.local`,
      role: UserRole.admin,
    },
    update: {},
  });
};

const parseQuantity = (raw: string | undefined) => {
  const normalized = (raw ?? '').toString().trim().replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
};

const buildDedupKey = (row: CsvRow) => {
  const barcode = row.barcode?.trim();
  const lotNumber = row.lot_number?.trim();
  if (barcode) return `barcode:${barcode}::lot:${lotNumber}`;
  return `lot:${row.reference_code}::${lotNumber}`;
};

const dedupeRows = (rows: CsvRow[]) => {
  const map = new Map<string, CsvRow & { __key: string; __quantity: number }>();
  let skipped = 0;

  for (const row of rows) {
    if (!row.reference_code || !row.lot_number) {
      skipped += 1;
      continue;
    }

    const key = buildDedupKey(row);
    const qty = parseQuantity(row.quantity);

    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row, __key: key, __quantity: qty, quantity: String(qty) });
      continue;
    }

    const nextQty = existing.__quantity + qty;
    existing.__quantity = nextQty;
    existing.quantity = String(nextQty);

    // Prefer to keep a barcode if either row has it
    existing.barcode = existing.barcode?.trim() ? existing.barcode : row.barcode;
    // Prefer to keep a name if the original was missing
    existing.name = existing.name ?? row.name;
    // Keep other optional fields if missing
    existing.brand = existing.brand ?? row.brand;
    existing.category = existing.category ?? row.category;
    existing.sale_price = existing.sale_price ?? row.sale_price;
    existing.is_active = existing.is_active ?? row.is_active;
    existing.critical_stock = existing.critical_stock ?? row.critical_stock;
    existing.expiry_date = existing.expiry_date ?? row.expiry_date;
  }

  return { rows: Array.from(map.values()), skippedRows: skipped };
};

const processInventoryRows = async (rows: CsvRow[], options: CsvImportOptions): Promise<InventoryImportResult> => {
  await ensureUploaderUserExists(options.createdByUserId);

  const { rows: deduped, skippedRows } = dedupeRows(rows);
  const errors: InventoryImportError[] = [];
  let succeededRows = 0;

  for (const row of deduped) {
    const quantity = parseQuantity(row.quantity);
    const barcode = row.barcode?.trim() || undefined;

    try {
      const brand = row.brand?.trim() || undefined;
      const isActive =
        row.is_active && row.is_active.trim().length > 0
          ? row.is_active.trim().toUpperCase().startsWith('A')
          : true;
      const criticalStockLevelRaw = row.critical_stock?.replace(',', '.');
      const criticalStockLevel =
        criticalStockLevelRaw && criticalStockLevelRaw.trim().length > 0
          ? Number(criticalStockLevelRaw)
          : undefined;

      const product = await prisma.product.upsert({
        where: { referenceCode: row.reference_code },
        create: {
          referenceCode: row.reference_code,
          name: row.name ?? row.reference_code,
          brand,
          category: row.category,
          salePrice: row.sale_price ? Number(row.sale_price) : undefined,
          isActive,
          criticalStockLevel: Number.isFinite(criticalStockLevel ?? NaN) ? criticalStockLevel : undefined,
        },
        update: {
          name: row.name ?? undefined,
          brand: brand ?? undefined,
          category: row.category ?? undefined,
          salePrice: row.sale_price ? Number(row.sale_price) : undefined,
          isActive,
          criticalStockLevel: Number.isFinite(criticalStockLevel ?? NaN) ? criticalStockLevel : undefined,
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
          quantity,
          barcode,
          expiryDate: row.expiry_date ? dayjs(row.expiry_date).toDate() : undefined,
        },
        update: {
          quantity: { increment: quantity },
          barcode: barcode ?? undefined,
          expiryDate: row.expiry_date ? dayjs(row.expiry_date).toDate() : undefined,
        },
      });

      const location = await ensureStockLocation(options.warehouseId, lot.id);
      await prisma.stockLocation.update({
        where: { id: location.id },
        data: { quantity: { increment: quantity } },
      });

      await prisma.log.create({
        data: {
          userId: options.createdByUserId,
          productId: product.id,
          lotId: lot.id,
          warehouseId: options.warehouseId,
          actionType: 'CSV_IMPORT',
          description: `CSV/Excel importu ile ${quantity} adet ürün işlendi`,
        },
      });

      succeededRows += 1;
    } catch (error) {
      errors.push({
        key: buildDedupKey(row),
        referenceCode: row.reference_code,
        lotNumber: row.lot_number,
        barcode,
        message: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
    }
  }

  return {
    totalRows: rows.length,
    dedupedRows: deduped.length,
    skippedRows,
    succeededRows,
    failedRows: errors.length,
    errors,
  };
};

const normalizeKey = (value: string) => {
  const transliterationMap: Record<string, string> = {
    ı: 'i',
    İ: 'i',
    ş: 's',
    Ş: 's',
    ğ: 'g',
    Ğ: 'g',
    ö: 'o',
    Ö: 'o',
    ü: 'u',
    Ü: 'u',
    ç: 'c',
    Ç: 'c',
  };

  const transliterated = value
    .toString()
    .replace(/[ıİşŞğĞöÖüÜçÇ]/g, (char) => transliterationMap[char] ?? char);

  return transliterated
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_');
};

const normalizeValue = (value: unknown) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const columnAliases = {
  reference: ['urun_kodu', 'urun_code', 'stok_kodu', 'product_code'],
  name: ['urun_hizmet_adi', 'urun_adi', 'urunadi', 'urun', 'product_name'],
  brand: ['marka', 'brand'],
  lot: ['lot', 'lot_numarasi', 'lot_number', 'seri_numarasi', 'seri_no', 'barkodu', 'barkod'],
  quantity: ['stok_miktari', 'miktar', 'stok', 'stok_adedi', 'adet', 'quantity'],
  barcode: ['barkod', 'barkodu', 'barcode'],
  category: ['kategori', 'category'],
  salePrice: ['satis_fiyati', 'satis', 'satis_tutari', 'sale_price'],
  // purchasePrice removed
  active: ['aktif_pasif', 'aktif_pasif_', 'aktif_pasif?'],
  criticalStock: ['kritik_stok_seviyesi', 'kritik_stok'],
};

const mapRowToCsvRow = (row: Record<string, unknown>): CsvRow => {
  const normalizedEntries = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[normalizeKey(key)] = normalizeValue(value);
    return acc;
  }, {});

  const pick = (aliases: string[]) => {
    for (const alias of aliases) {
      if (normalizedEntries[alias]) {
        return normalizedEntries[alias];
      }
    }
    return '';
  };

  const referenceCode = pick(columnAliases.reference);
  const lotNumber = pick(columnAliases.lot) || referenceCode;
  const quantity = pick(columnAliases.quantity) || '0';
  const brand = pick(columnAliases.brand) || undefined;
  const isActive = pick(columnAliases.active) || undefined;
  const criticalStock = pick(columnAliases.criticalStock) || undefined;

  return {
    reference_code: referenceCode,
    name: pick(columnAliases.name) || referenceCode,
    brand,
    category: pick(columnAliases.category) || undefined,
    lot_number: lotNumber,
    quantity,
    barcode: pick(columnAliases.barcode) || undefined,
    sale_price: pick(columnAliases.salePrice) || undefined,
    // purchase price removed
    is_active: isActive,
    critical_stock: criticalStock,
  };
};

export const importInventoryCsv = async (fileBuffer: Buffer, options: CsvImportOptions) => {
  const rawRows = parse(fileBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  // csv-parse with columns:true treats the first row as data; shift it away if it looks like headers
  if (rawRows.length > 0) {
    const firstRowKeys = Object.values(rawRows[0]).map((value) => normalizeKey(String(value)));
    if (firstRowKeys.some((key) => columnAliases.reference.includes(key))) {
      rawRows.shift();
    }
  }

  const mappedRows = rawRows
    .map(mapRowToCsvRow)
    .filter((row: CsvRow) => row.reference_code && row.lot_number);

  return await processInventoryRows(mappedRows, options);
};

export const importInventoryExcel = async (fileBuffer: Buffer, options: CsvImportOptions) => {
  const workbook = read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames?.[0];

  if (!sheetName) {
    throw new Error('Excel dosyasında çalışma sayfası bulunamadı');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, unknown>[];
  const mappedRows = rawRows
    .map(mapRowToCsvRow)
    .filter((row: CsvRow) => row.reference_code && row.lot_number);

  return await processInventoryRows(mappedRows, options);
};

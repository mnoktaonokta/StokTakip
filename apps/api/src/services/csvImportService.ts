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

const processInventoryRows = async (rows: CsvRow[], options: CsvImportOptions) => {
  await ensureUploaderUserExists(options.createdByUserId);

  for (const row of rows) {
    if (!row.reference_code || !row.lot_number) continue;

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
        // purchase price removed
        isActive,
        criticalStockLevel: Number.isFinite(criticalStockLevel ?? NaN) ? criticalStockLevel : undefined,
      },
      update: {
        name: row.name ?? undefined,
        brand: brand ?? undefined,
        category: row.category ?? undefined,
        salePrice: row.sale_price ? Number(row.sale_price) : undefined,
        // purchase price removed
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
        description: `CSV/Excel importu ile ${row.quantity ?? 0} adet ürün işlendi`,
      },
    });
  }
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

  const mappedRows = rawRows.map(mapRowToCsvRow).filter((row) => row.reference_code && row.lot_number);

  await processInventoryRows(mappedRows, options);
};

export const importInventoryExcel = async (fileBuffer: Buffer, options: CsvImportOptions) => {
  const workbook = read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames?.[0];

  if (!sheetName) {
    throw new Error('Excel dosyasında çalışma sayfası bulunamadı');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
  const mappedRows = rawRows.map(mapRowToCsvRow).filter((row) => row.reference_code && row.lot_number);

  await processInventoryRows(mappedRows, options);
};

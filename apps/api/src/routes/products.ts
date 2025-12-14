import express from 'express';
import { ActionType, Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireStockManager } from '../middleware/roleGuard';
import { assignLotToMainWarehouse } from '../services/stockService';
import { productInclude, serializeProduct } from './utils/productSerializer';

const router = express.Router();

const productUpdateSchema = z.object({
  name: z.string().min(1, 'Ürün adı zorunlu'),
  referenceCode: z.string().min(1, 'Ürün kodu zorunlu'),
  brand: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  salePrice: z.number().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
  criticalStockLevel: z.number().int().min(0).optional().nullable(),
  vatRate: z.number().nonnegative().optional().nullable(),
});

const createLotSchema = z.object({
  lotNumber: z.string().min(1, 'Lot numarası zorunlu'),
  quantity: z.number().int().min(0, 'Stok miktarı negatif olamaz'),
  barcode: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
});

// --- ROTA 1: GET /api/products ---
// Ana Ürün Listesi Sayfası için tüm ürünlerin özetini çeker
router.get('/', async (req, res) => {
  try {
    const parseNumber = (value: unknown): number | undefined => {
      if (value === undefined || value === null) return undefined;
      const num = Number(value);
      return Number.isFinite(num) ? num : undefined;
    };

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const reference = typeof req.query.reference === 'string' ? req.query.reference : undefined;
    const name = typeof req.query.name === 'string' ? req.query.name : undefined;
    const brand = typeof req.query.brand === 'string' ? req.query.brand : undefined;
    const includeInactive = req.query.includeInactive === 'true';
    const minPrice = parseNumber(req.query.minPrice);
    const maxPrice = parseNumber(req.query.maxPrice);
    const minStock = parseNumber(req.query.minStock);
    const maxStock = parseNumber(req.query.maxStock);

    const where: Prisma.ProductWhereInput = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    if (reference) {
      where.referenceCode = { contains: reference, mode: 'insensitive' };
    }
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }
    if (brand) {
      where.brand = { contains: brand, mode: 'insensitive' };
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.salePrice = {
        ...(minPrice !== undefined ? { gte: minPrice } : {}),
        ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
      };
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { referenceCode: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { lots: { some: { lotNumber: { contains: search, mode: 'insensitive' } } } },
        { lots: { some: { barcode: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { name: 'asc' },
    });

    let summary = products.map((p) => serializeProduct(p));

    if (minStock !== undefined) {
      summary = summary.filter((product) => product.totalQuantity >= minStock);
    }
    if (maxStock !== undefined) {
      summary = summary.filter((product) => product.totalQuantity <= maxStock);
    }

    res.json(summary);
  } catch (error) {
    console.error('Ürün Listesi Çekme Hatası:', error);
    res.status(500).json({ error: 'Ürünler yüklenemedi' });
  }
});

// --- ROTA 2: GET /api/products/lookup?code=BARCODE_OR_REF ---
// Transfer Sayfası için Barkod/Referans kodu ile Lot/Ürün arar
router.get('/lookup', async (req, res) => {
  const rawCode = typeof req.query.code === 'string' ? req.query.code.trim() : '';

  if (!rawCode) {
    return res.status(400).json({ message: 'Arama kodu (code) zorunludur.' });
  }

  try {
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { referenceCode: { contains: rawCode, mode: 'insensitive' } },
          { name: { contains: rawCode, mode: 'insensitive' } },
          { brand: { contains: rawCode, mode: 'insensitive' } },
          { lots: { some: { lotNumber: { contains: rawCode, mode: 'insensitive' } } } },
          { lots: { some: { barcode: { contains: rawCode, mode: 'insensitive' } } } },
        ],
      },
      include: productInclude,
    });

    if (!product) {
      return res.status(404).json({ message: 'Ürün veya Lot bulunamadı.' });
    }

    const serialized = serializeProduct(product);
    const sortedLots = [...serialized.lots].sort((a, b) => {
      const aDate = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDate = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (aDate !== bDate) {
        return aDate - bDate;
      }
      return a.lotNumber.localeCompare(b.lotNumber);
    });
    const lots = sortedLots.filter((lot) => (lot.trackedQuantity ?? lot.quantity) > 0);
    const autoSelectedLot = lots.find((lot) => (lot.onHandQuantity ?? 0) > 0) ?? lots[0] ?? null;
    const totalQuantity = lots.reduce((sum, lot) => sum + (lot.trackedQuantity ?? lot.quantity), 0);
    const responseLots = lots.map((lot) => ({
      id: lot.id,
      lotNumber: lot.lotNumber,
      quantity: (lot.trackedQuantity ?? lot.quantity) || 0,
      barcode: lot.barcode,
      expiryDate: lot.expiryDate,
      onHandQuantity: lot.onHandQuantity,
      customerQuantity: lot.customerQuantity,
      stockLocations: lot.stockLocations,
    }));

    return res.json({
      product: {
        id: serialized.id,
        name: serialized.name,
        referenceCode: serialized.referenceCode,
        totalQuantity,
        onHandQuantity: serialized.onHandQuantity,
        customerQuantity: serialized.customerQuantity,
      },
      lots: responseLots,
      autoSelectedLot,
      isBarcodeMatch: serialized.lots.some((lot) => lot.barcode?.toLowerCase() === rawCode.toLowerCase()),
    });
  } catch (error) {
    console.error('Barkod/Lookup Hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası, arama yapılamadı.' });
  }
});

// --- ROTA 1.5: GET /api/products/:productId ---
router.get('/:productId', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.productId },
      include: productInclude,
    });

    if (!product) {
      return res.status(404).json({ message: 'Ürün bulunamadı' });
    }

    return res.json(serializeProduct(product));
  } catch (error) {
    console.error('Ürün detayı çekilemedi:', error);
    return res.status(500).json({ message: 'Ürün detayı yüklenemedi' });
  }
});

// --- ROTA 1.6: PUT /api/products/:productId ---
router.put('/:productId', async (req, res) => {
  try {
    const body = productUpdateSchema.parse(req.body);

    const data: Prisma.ProductUpdateInput = {
      name: body.name,
      referenceCode: body.referenceCode,
      brand: body.brand ?? null,
      category: body.category ?? null,
      salePrice: body.salePrice ?? null,
      vatRate: body.vatRate ?? null,
      criticalStockLevel: body.criticalStockLevel ?? null,
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    };

    const updated = await prisma.product.update({
      where: { id: req.params.productId },
      data,
      include: productInclude,
    });

    const isAdmin = req.currentUser?.role === 'admin';
    return res.json(serializeProduct(updated, { includePurchasePrice: isAdmin }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Geçersiz veri', issues: error.issues });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'Ürün bulunamadı' });
    }

    console.error('Ürün güncelleme hatası:', error);
    return res.status(500).json({ message: 'Ürün güncellenemedi' });
  }
});

// --- ROTA 1.7: POST /api/products/:productId/lots ---
router.post('/:productId/lots', requireStockManager, async (req, res) => {
  try {
    const body = createLotSchema.parse(req.body);

    const product = await prisma.product.findUnique({
      where: { id: req.params.productId },
    });

    if (!product) {
      return res.status(404).json({ message: 'Ürün bulunamadı' });
    }

    const newLot = await prisma.lot.create({
      data: {
        productId: product.id,
        lotNumber: body.lotNumber,
        quantity: body.quantity,
        barcode: body.barcode ?? null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      },
    });

    await assignLotToMainWarehouse(newLot.id, body.quantity);

    await prisma.log.create({
      data: {
        actionType: ActionType.MANUAL_ADJUSTMENT,
        description: `Yeni lot eklendi (${body.lotNumber}) - ${body.quantity} adet`,
        productId: product.id,
        userId: req.currentUser?.id,
      },
    });

    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: productInclude,
    });

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Ürün bulunamadı' });
    }

    return res.status(201).json(serializeProduct(updatedProduct));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Geçersiz veri', issues: error.issues });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'Bu lot numarası mevcut' });
    }

    console.error('Yeni lot eklenemedi:', error);
    return res.status(500).json({ message: 'Yeni lot eklenemedi' });
  }
});

export default router;
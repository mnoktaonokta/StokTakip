import { Router } from 'express';
import { z } from 'zod';
import { ActionType, UserRole } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { requireAdmin } from '../middleware/roleGuard';
import { recordLog } from '../services/logService';
import { adjustStock, getProductStockSummary } from '../services/stockService';

const router = Router();

router.get('/', async (req, res) => {
  const data = await getProductStockSummary();
  const isAdmin = req.currentUser?.role === UserRole.admin;

  const sanitized = isAdmin
    ? data
    : data.map(({ purchasePrice, ...product }) => ({
        ...product,
      }));

  return res.json(sanitized);
});

const createProductSchema = z.object({
  referenceCode: z.string(),
  name: z.string(),
  category: z.string().optional(),
  salePrice: z.number().optional(),
  purchasePrice: z.number().optional(),
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const payload = createProductSchema.parse(req.body);
    const product = await prisma.product.create({ data: payload });

    await recordLog({
      userId: req.currentUser?.id,
      productId: product.id,
      actionType: ActionType.STOCK_IN,
      description: `${product.referenceCode} ürünü oluşturuldu`,
    });

    return res.status(201).json(product);
  } catch (error) {
    return next(error);
  }
});

router.get('/:productId/lots', async (req, res, next) => {
  try {
    const lots = await prisma.lot.findMany({
      where: { productId: req.params.productId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(lots);
  } catch (error) {
    return next(error);
  }
});

const upsertLotSchema = z.object({
  lotNumber: z.string(),
  quantity: z.number().int().nonnegative(),
  barcode: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
});

router.post('/:productId/lots', requireAdmin, async (req, res, next) => {
  try {
    const body = upsertLotSchema.parse(req.body);
    const lot = await prisma.lot.upsert({
      where: {
        productId_lotNumber: {
          productId: req.params.productId,
          lotNumber: body.lotNumber,
        },
      },
      create: {
        productId: req.params.productId,
        lotNumber: body.lotNumber,
        quantity: body.quantity,
        barcode: body.barcode,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      },
      update: {
        quantity: body.quantity,
        barcode: body.barcode ?? undefined,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      },
    });

    await recordLog({
      userId: req.currentUser?.id,
      productId: lot.productId,
      lotId: lot.id,
      actionType: ActionType.STOCK_IN,
      description: `${lot.lotNumber} lotu güncellendi`,
    });

    return res.status(201).json(lot);
  } catch (error) {
    return next(error);
  }
});

const manualAdjustSchema = z.object({
  warehouseId: z.string(),
  lotId: z.string(),
  quantityDelta: z.number().int(),
});

router.post('/:productId/manual-adjust', requireAdmin, async (req, res, next) => {
  try {
    const body = manualAdjustSchema.parse(req.body);

    await adjustStock({
      warehouseId: body.warehouseId,
      lotId: body.lotId,
      quantityDelta: body.quantityDelta,
    });

    const lot = await prisma.lot.update({
      where: { id: body.lotId },
      data: { quantity: { increment: body.quantityDelta } },
    });

    await recordLog({
      userId: req.currentUser?.id,
      productId: lot.productId,
      lotId: lot.id,
      warehouseId: body.warehouseId,
      actionType: ActionType.MANUAL_ADJUSTMENT,
      description: `Manuel stok düzeltme: ${body.quantityDelta}`,
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;

import { ActionType, Prisma, WarehouseType } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireStockManager } from '../middleware/roleGuard';
import { productInclude, serializeProduct } from './utils/productSerializer';
import { adjustStock } from '../services/stockService';

const router = Router();

const updateLotQuantitySchema = z.object({
  quantity: z.number().int().min(0, 'Stok miktarı negatif olamaz'),
  lotNumber: z.string().min(1, 'Lot numarası zorunlu').optional(),
  barcode: z.string().optional().nullable(),
});

router.patch('/:lotId', requireStockManager, async (req, res, next) => {
  try {
    const body = updateLotQuantitySchema.parse(req.body);
    const lotNumber = body.lotNumber?.trim();
    const normalizedBarcode = body.barcode?.trim() ?? null;

    const lot = await prisma.lot.update({
      where: { id: req.params.lotId },
      data: {
        quantity: body.quantity,
        ...(lotNumber ? { lotNumber } : {}),
        ...(body.barcode !== undefined ? { barcode: normalizedBarcode || null } : {}),
      },
      include: {
        product: {
          include: productInclude,
        },
      },
    });

    const mainWarehouse = await prisma.warehouse.findFirst({
      where: { type: WarehouseType.MAIN },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (mainWarehouse) {
      const mainLocation = await prisma.stockLocation.findUnique({
        where: {
          warehouseId_lotId: {
            warehouseId: mainWarehouse.id,
            lotId: lot.id,
          },
        },
      });

      const currentMainQuantity = mainLocation?.quantity ?? 0;
      const delta = body.quantity - currentMainQuantity;

      if (delta !== 0) {
        await adjustStock({
          warehouseId: mainWarehouse.id,
          lotId: lot.id,
          quantityDelta: delta,
        });
      }
    }

    await prisma.log.create({
      data: {
        actionType: ActionType.MANUAL_ADJUSTMENT,
        description: `Lot ${lot.lotNumber} stok ${body.quantity} olarak güncellendi`,
        productId: lot.productId,
        lotId: lot.id,
        userId: req.currentUser?.id,
      },
    });

    return res.json({
      product: serializeProduct(lot.product),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Geçersiz veri', issues: error.issues });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'Lot bulunamadı' });
    }

    return next(error);
  }
});

export default router;


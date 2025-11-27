import { ActionType, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireStockManager } from '../middleware/roleGuard';
import { productInclude, serializeProduct } from './utils/productSerializer';

const router = Router();

const updateLotQuantitySchema = z.object({
  quantity: z.number().int().min(0, 'Stok miktarı negatif olamaz'),
  lotNumber: z.string().min(1, 'Lot numarası zorunlu').optional(),
});

router.patch('/:lotId', requireStockManager, async (req, res, next) => {
  try {
    const body = updateLotQuantitySchema.parse(req.body);

    const lot = await prisma.lot.update({
      where: { id: req.params.lotId },
      data: {
        quantity: body.quantity,
        ...(body.lotNumber ? { lotNumber: body.lotNumber } : {}),
      },
      include: {
        product: {
          include: productInclude,
        },
      },
    });

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


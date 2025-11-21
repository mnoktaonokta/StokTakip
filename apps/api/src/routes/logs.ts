import { Router } from 'express';
import { z } from 'zod';
import { ActionType } from '@prisma/client';

import { prisma } from '../lib/prisma';

const router = Router();

const querySchema = z.object({
  customerId: z.string().optional(),
  productId: z.string().optional(),
  userId: z.string().optional(),
  warehouseId: z.string().optional(),
  actionType: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    const filters = parsed.success ? parsed.data : {};

    const logs = await prisma.log.findMany({
      where: {
        customerId: filters.customerId,
        productId: filters.productId,
        userId: filters.userId,
        warehouseId: filters.warehouseId,
        actionType: filters.actionType ? (filters.actionType as ActionType) : undefined,
        timestamp: {
          gte: filters.from ? new Date(filters.from) : undefined,
          lte: filters.to ? new Date(filters.to) : undefined,
        },
      },
      include: {
        product: true,
        lot: true,
        user: true,
        customer: true,
        transfer: true,
        invoice: true,
        warehouse: true,
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    return res.json(logs);
  } catch (error) {
    return next(error);
  }
});

export default router;

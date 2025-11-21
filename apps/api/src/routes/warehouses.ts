import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { requireAdmin } from '../middleware/roleGuard';

const router = Router();

router.get('/', async (_req, res) => {
  const warehouses = await prisma.warehouse.findMany({
    include: {
      stockLocations: {
        include: {
          lot: true,
        },
      },
    },
  });
  return res.json(warehouses);
});

const createWarehouseSchema = z.object({
  name: z.string(),
  type: z.enum(['MAIN', 'CUSTOMER', 'EMPLOYEE']).default('MAIN'),
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const body = createWarehouseSchema.parse(req.body);
    const warehouse = await prisma.warehouse.create({ data: body });
    return res.status(201).json(warehouse);
  } catch (error) {
    return next(error);
  }
});

router.get('/:warehouseId/stock', async (req, res, next) => {
  try {
    const stock = await prisma.stockLocation.findMany({
      where: { warehouseId: req.params.warehouseId },
      include: { lot: { include: { product: true } } },
    });
    return res.json(stock);
  } catch (error) {
    return next(error);
  }
});

export default router;

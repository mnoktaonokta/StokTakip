import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { productInclude } from './utils/productSerializer';
import { requireAdmin } from '../middleware/roleGuard';

const router = Router();

router.get('/', async (_req, res) => {
  const warehouses = await prisma.warehouse.findMany({
    include: {
      customers: true,
      stockLocations: {
        include: {
          lot: {
            include: {
              product: {
                include: productInclude,
              },
            },
          },
        },
      },
    },
  });
  return res.json(warehouses);
});

const createWarehouseSchema = z.object({
  name: z.string(),
  type: z.enum(['MAIN', 'CUSTOMER', 'EMPLOYEE']).default('MAIN'),
  customerId: z.string().optional(),
});

const updateWarehouseSchema = z
  .object({
    name: z.string().min(1).optional(),
    type: z.enum(['MAIN', 'CUSTOMER', 'EMPLOYEE']).optional(),
  })
  .refine((data) => data.name !== undefined || data.type !== undefined, {
    message: 'En az bir alan güncellenmelidir',
  });

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const body = createWarehouseSchema.parse(req.body);
    const { customerId, ...warehouseData } = body;
    const warehouse = await prisma.warehouse.create({ data: warehouseData });

    if (customerId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { warehouseId: warehouse.id },
      });
    }

    return res.status(201).json(warehouse);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:warehouseId', requireAdmin, async (req, res, next) => {
  try {
    await prisma.customer.updateMany({
      where: { warehouseId: req.params.warehouseId },
      data: { warehouseId: null },
    });

    const deleted = await prisma.warehouse.delete({
      where: { id: req.params.warehouseId },
    });
    return res.json(deleted);
  } catch (error) {
    return next(error);
  }
});

router.patch('/:warehouseId', requireAdmin, async (req, res, next) => {
  try {
    const body = updateWarehouseSchema.parse(req.body);
    const updated = await prisma.warehouse.update({
      where: { id: req.params.warehouseId },
      data: body,
    });
    return res.json(updated);
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

router.post('/:warehouseId/stock', requireAdmin, async (req, res, next) => {
  const bodySchema = z.object({
    lotId: z.string(),
    quantity: z.number().int(),
    mode: z.enum(['set', 'add', 'remove']).default('set'),
  });

  try {
    const body = bodySchema.parse(req.body);

    const existing = await prisma.stockLocation.findUnique({
      where: {
        warehouseId_lotId: {
          warehouseId: req.params.warehouseId,
          lotId: body.lotId,
        },
      },
    });

    const currentQuantity = existing?.quantity ?? 0;
    let newQuantity = currentQuantity;

    if (body.mode === 'add') {
      newQuantity = currentQuantity + body.quantity;
    } else if (body.mode === 'remove') {
      newQuantity = currentQuantity - body.quantity;
    } else {
      newQuantity = body.quantity;
    }

    if (newQuantity <= 0) {
      if (existing) {
        await prisma.stockLocation.delete({ where: { id: existing.id } });
      }
      return res.json({ deleted: true });
    }

    let location;
    if (existing) {
      location = await prisma.stockLocation.update({
        where: { id: existing.id },
        data: { quantity: newQuantity },
      });
    } else {
      location = await prisma.stockLocation.create({
        data: {
          warehouseId: req.params.warehouseId,
          lotId: body.lotId,
          quantity: newQuantity,
        },
      });
    }

    return res.json(location);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:warehouseId/stock/:stockLocationId', requireAdmin, async (req, res, next) => {
  try {
    const location = await prisma.stockLocation.delete({
      where: { id: req.params.stockLocationId },
    });
    return res.json(location);
  } catch (error) {
    return next(error);
  }
});

export default router;

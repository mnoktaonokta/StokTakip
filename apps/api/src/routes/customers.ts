import { Router } from 'express';
import { z } from 'zod';
import { WarehouseType } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { requireAdmin } from '../middleware/roleGuard';

const router = Router();

router.get('/', async (_req, res) => {
  const customers = await prisma.customer.findMany({
    include: {
      warehouse: true,
      invoices: true,
    },
  });
  return res.json(customers);
});

const createCustomerSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const body = createCustomerSchema.parse(req.body);
    const warehouse = await prisma.warehouse.create({
      data: {
        name: `Müşteri Deposu: ${body.name}`,
        type: WarehouseType.CUSTOMER,
      },
    });

    const customer = await prisma.customer.create({
      data: {
        ...body,
        warehouseId: warehouse.id,
      },
    });

    return res.status(201).json(customer);
  } catch (error) {
    return next(error);
  }
});

router.get('/:customerId/depot', async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.customerId },
      include: {
        warehouse: {
          include: {
            stockLocations: {
              include: {
                lot: {
                  include: {
                    product: true,
                  },
                },
              },
            },
          },
        },
        invoices: true,
      },
    });

    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    return res.json(customer);
  } catch (error) {
    return next(error);
  }
});

export default router;

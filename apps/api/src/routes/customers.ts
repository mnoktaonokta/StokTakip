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
      notes: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  return res.json(customers);
});

const createCustomerSchema = z.object({
  name: z.string().min(1, 'Müşteri adı zorunlu'),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxOffice: z.string().optional(),
  taxNumber: z.string().optional(),
  logo: z.string().optional(),
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const body = createCustomerSchema.parse(req.body);

    const customer = await prisma.customer.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        address: body.address,
        taxOffice: body.taxOffice,
        taxNumber: body.taxNumber,
        logo: body.logo,
      },
      include: {
        warehouse: true,
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
        notes: {
          orderBy: { createdAt: 'desc' },
        },
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

const noteSchema = z.object({
  content: z.string().min(1, 'Not içeriği zorunlu'),
});

router.get('/:customerId/notes', async (req, res, next) => {
  try {
    const notes = await prisma.customerNote.findMany({
      where: { customerId: req.params.customerId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(notes);
  } catch (error) {
    return next(error);
  }
});

router.post('/:customerId/notes', requireAdmin, async (req, res, next) => {
  try {
    const body = noteSchema.parse(req.body);
    const note = await prisma.customerNote.create({
      data: {
        customerId: req.params.customerId,
        content: body.content,
      },
    });
    return res.status(201).json(note);
  } catch (error) {
    return next(error);
  }
});

export default router;

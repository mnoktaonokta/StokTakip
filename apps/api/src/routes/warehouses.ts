import { WarehouseType } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { adjustStock } from '../services/stockService';
// import { productInclude } from './utils/productSerializer'; // <-- AĞIR YÜK KAPALI (HIZ İÇİN)
import { requireAdmin, requireStaff } from '../middleware/roleGuard';

const router = Router();

const findMainWarehouse = () =>
  prisma.warehouse.findFirst({
    where: { type: WarehouseType.MAIN },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

// HIZLANDIRILMIŞ YAPILANDIRMA
// Sadece ürünün ana bilgilerini çeker, derin detaylara girmez.
const warehouseInclude = {
  customers: true,
  stockLocations: {
    include: {
      lot: {
        include: {
          product: true, 
        },
      },
    },
  },
};

router.get('/', async (_req, res) => {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { name: 'asc' },
    include: warehouseInclude,
  });

  const priority = {
    [WarehouseType.MAIN]: 0,
    [WarehouseType.CUSTOMER]: 1,
    [WarehouseType.EMPLOYEE]: 2,
  } as Record<WarehouseType, number>;

  warehouses.sort((a, b) => {
    const diff = priority[a.type] - priority[b.type];
    if (diff !== 0) {
      return diff;
    }
    return a.name.localeCompare(b.name, 'tr');
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

router.post('/', requireStaff, async (req, res, next) => {
  try {
    const body = createWarehouseSchema.parse(req.body);
    const { customerId, ...warehouseData } = body;
    const warehouse = await prisma.warehouse.create({
      data: warehouseData,
      include: warehouseInclude,
    });

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

router.delete('/:warehouseId', requireStaff, async (req, res, next) => {
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

router.patch('/:warehouseId', requireStaff, async (req, res, next) => {
  try {
    const body = updateWarehouseSchema.parse(req.body);
    const updated = await prisma.warehouse.update({
      where: { id: req.params.warehouseId },
      data: body,
      include: warehouseInclude, // <-- KRİTİK DÜZELTME BURADA
    });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.get('/:warehouseId/stock', async (req, res, next) => {
  try {
    const stock = await prisma.stockLocation.findMany({
      where: {
        warehouseId: req.params.warehouseId,
        quantity: { gt: 0 },
      },
      include: { lot: { include: { product: true } } },
    });
    return res.json(stock);
  } catch (error) {
    return next(error);
  }
});

router.post('/:warehouseId/stock', requireStaff, async (req, res, next) => {
  const bodySchema = z.object({
    lotId: z.string(),
    quantity: z.number().int().positive(),
    mode: z.enum(['set', 'add', 'remove']).default('set'),
  });

  try {
    const body = bodySchema.parse(req.body);

    const targetWarehouseId = req.params.warehouseId;
    const targetWarehouse = await prisma.warehouse.findUnique({
      where: { id: targetWarehouseId },
      select: { type: true },
    });

    if (!targetWarehouse) {
      return res.status(404).json({ message: 'Depo bulunamadı' });
    }

    const shouldAffectMain = targetWarehouse.type !== WarehouseType.MAIN;
    let mainWarehouseId: string | null = null;

    if (shouldAffectMain) {
      const mainWarehouse = await findMainWarehouse();
      if (!mainWarehouse) {
        return res.status(400).json({ message: 'Ana depo bulunamadı' });
      }
      mainWarehouseId = mainWarehouse.id;
    }

    const existing = await prisma.stockLocation.findUnique({
      where: {
        warehouseId_lotId: {
          warehouseId: targetWarehouseId,
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

    const delta = newQuantity - currentQuantity;

    const adjustMain = async (quantityDelta: number) => {
      if (!shouldAffectMain || !mainWarehouseId || quantityDelta === 0) {
        return;
      }

      await adjustStock({
        warehouseId: mainWarehouseId,
        lotId: body.lotId,
        quantityDelta,
      });
    };

    if (delta > 0) {
      await adjustMain(-delta);
    }

    if (newQuantity <= 0) {
      if (existing) {
        await prisma.stockLocation.delete({ where: { id: existing.id } });
      }
      if (delta < 0) {
        await adjustMain(-delta);
      }
      return res.json({ deleted: true });
    }

    let location;
    try {
      if (existing) {
        location = await prisma.stockLocation.update({
          where: { id: existing.id },
          data: { quantity: newQuantity },
          include: { lot: { include: { product: true } } },
        });
      } else {
        location = await prisma.stockLocation.create({
          data: {
            warehouseId: targetWarehouseId,
            lotId: body.lotId,
            quantity: newQuantity,
          },
          include: { lot: { include: { product: true } } },
        });
      }
    } catch (error) {
      if (delta > 0) {
        await adjustMain(delta);
      }
      throw error;
    }

    if (delta < 0) {
      await adjustMain(-delta);
    }

    return res.json(location);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:warehouseId/stock/:stockLocationId', requireStaff, async (req, res, next) => {
  try {
    const location = await prisma.stockLocation.findUnique({
      where: { id: req.params.stockLocationId },
      include: {
        warehouse: {
          select: { type: true },
        },
      },
    });

    if (!location) {
      return res.status(404).json({ message: 'Stok kaydı bulunamadı' });
    }

    if (location.warehouse.type !== WarehouseType.MAIN && location.quantity > 0) {
      const mainWarehouse = await findMainWarehouse();
      if (!mainWarehouse) {
        return res.status(400).json({ message: 'Ana depo bulunamadı' });
      }
      await adjustStock({
        warehouseId: mainWarehouse.id,
        lotId: location.lotId,
        quantityDelta: location.quantity,
      });
    }

    const deleted = await prisma.stockLocation.delete({
      where: { id: location.id },
    });

    return res.json(deleted);
  } catch (error) {
    return next(error);
  }
});

export default router;
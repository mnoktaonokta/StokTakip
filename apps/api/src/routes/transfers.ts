import { Router } from 'express';
import { z } from 'zod';
import { ActionType, TransferStatus, UserRole, WarehouseType } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { autoSelectLot, adjustStock } from '../services/stockService';
import { recordLog } from '../services/logService';

const router = Router();

const transferSchema = z.object({
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  productId: z.string(),
  lotId: z.string().optional(),
  quantity: z.number().int().positive(),
  barcode: z.string().optional(),
  notes: z.string().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const transfers = await prisma.transfer.findMany({
      include: {
        lot: {
          include: {
            product: true,
          },
        },
        fromWarehouse: true,
        toWarehouse: true,
        createdBy: true,
      },
      orderBy: { timestamp: 'desc' },
      take: req.query.limit ? Number(req.query.limit) : 200,
    });
    return res.json(transfers);
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = transferSchema.parse(req.body);
    const { fromWarehouseId, toWarehouseId, quantity, barcode, notes } = body;

    const lot =
      body.lotId && body.lotId !== ''
        ? await prisma.lot.findUnique({ where: { id: body.lotId } })
        : await autoSelectLot({ productId: body.productId, barcode });

    if (!lot) {
      return res.status(404).json({ message: 'Lot bulunamadı' });
    }

    const [fromWarehouse, toWarehouse] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: fromWarehouseId } }),
      prisma.warehouse.findUnique({ where: { id: toWarehouseId } }),
    ]);

    if (!fromWarehouse || !toWarehouse) {
      return res.status(404).json({ message: 'Depo bilgisi eksik' });
    }

    await adjustStock({ warehouseId: fromWarehouseId, lotId: lot.id, quantityDelta: -quantity });
    await adjustStock({ warehouseId: toWarehouseId, lotId: lot.id, quantityDelta: quantity });

    const status = toWarehouse.type === WarehouseType.CUSTOMER ? TransferStatus.PENDING : TransferStatus.COMPLETED;

    const transfer = await prisma.transfer.create({
      data: {
        fromWarehouseId,
        toWarehouseId,
        lotId: lot.id,
        quantity,
        createdByUserId: req.currentUser?.id ?? (await ensureDefaultUser()),
        barcodeScanned: Boolean(barcode),
        status,
        notes,
      },
      include: {
        lot: { include: { product: true } },
      },
    });

    await recordLog({
      userId: req.currentUser?.id,
      productId: lot.productId,
      lotId: lot.id,
      warehouseId: fromWarehouseId,
      transferId: transfer.id,
      actionType: toWarehouse.type === WarehouseType.CUSTOMER ? ActionType.TRANSFER_OUT : ActionType.TRANSFER_IN,
      description: `${quantity} adet ${lot.lotNumber} lot transfer edildi`,
      barcodeUsed: Boolean(barcode),
    });

    return res.status(201).json(transfer);
  } catch (error) {
    return next(error);
  }
});

router.post('/:transferId/reverse', async (req, res, next) => {
  try {
    const transfer = await prisma.transfer.findUnique({
      where: { id: req.params.transferId },
    });

    if (!transfer) {
      return res.status(404).json({ message: 'Transfer bulunamadı' });
    }

    if (transfer.status === TransferStatus.REVERSED) {
      return res.status(400).json({ message: 'Transfer zaten iade edildi' });
    }

    await adjustStock({
      warehouseId: transfer.fromWarehouseId,
      lotId: transfer.lotId,
      quantityDelta: transfer.quantity,
    });
    await adjustStock({
      warehouseId: transfer.toWarehouseId,
      lotId: transfer.lotId,
      quantityDelta: -transfer.quantity,
    });

    const updated = await prisma.transfer.update({
      where: { id: transfer.id },
      data: { status: TransferStatus.REVERSED },
    });

    await recordLog({
      userId: req.currentUser?.id,
      lotId: transfer.lotId,
      transferId: transfer.id,
      actionType: ActionType.TRANSFER_REVERSE,
      description: `Transfer ${transfer.id} iade edildi`,
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

const ensureDefaultUser = async () => {
  const user = await prisma.user.upsert({
    where: { email: 'system@stoktakip.local' },
    create: { email: 'system@stoktakip.local', name: 'System', role: UserRole.admin },
    update: {},
  });
  return user.id;
};

export default router;

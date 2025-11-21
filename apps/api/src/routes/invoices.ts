import { Router } from 'express';
import { z } from 'zod';
import { ActionType, TransferStatus } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { adjustStock } from '../services/stockService';
import { recordLog } from '../services/logService';
import { sendInvoiceToProvider } from '../services/invoiceService';

const router = Router();

router.get('/', async (_req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: {
      customer: true,
      transfers: true,
    },
    orderBy: { timestamp: 'desc' },
  });
  return res.json(invoices);
});

router.get('/:invoiceId', async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.invoiceId },
      include: {
        customer: true,
        transfers: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Fatura bulunamadı' });
    }

    return res.json(invoice);
  } catch (error) {
    return next(error);
  }
});

const invoiceSchema = z.object({
  customerId: z.string(),
  transferIds: z.array(z.string()).nonempty(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        lotId: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
      }),
    )
    .nonempty(),
});

router.post('/', async (req, res, next) => {
  try {
    const body = invoiceSchema.parse(req.body);
    const customer = await prisma.customer.findUnique({
      where: { id: body.customerId },
      include: { warehouse: true },
    });

    if (!customer) {
      return res.status(404).json({ message: 'Müşteri bulunamadı' });
    }

    const transfers = await prisma.transfer.findMany({
      where: { id: { in: body.transferIds } },
    });

    if (transfers.length !== body.transferIds.length) {
      return res.status(400).json({ message: 'Transfer kayıtlarında eksik var' });
    }

    for (const transfer of transfers) {
      if (transfer.toWarehouseId !== customer.warehouseId) {
        throw new Error('Transfer müşteri deposuna ait değil');
      }
      await adjustStock({
        warehouseId: transfer.toWarehouseId,
        lotId: transfer.lotId,
        quantityDelta: -transfer.quantity,
      });
    }

    await prisma.transfer.updateMany({
      where: { id: { in: body.transferIds } },
      data: { status: TransferStatus.COMPLETED },
    });

    const providerResponse = await sendInvoiceToProvider({
      customerName: customer.name,
      items: body.items,
    });

    const invoice = await prisma.invoice.create({
      data: {
        customerId: body.customerId,
        items: body.items,
        transferIds: body.transferIds,
        invoiceNumber: providerResponse?.invoiceNumber,
        totalAmount: body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        createdById: req.currentUser?.id,
        transfers: {
          connect: body.transferIds.map((id) => ({ id })),
        },
      },
    });

    await recordLog({
      userId: req.currentUser?.id,
      customerId: body.customerId,
      invoiceId: invoice.id,
      actionType: ActionType.INVOICE_CREATED,
      description: `${invoice.invoiceNumber ?? invoice.id} numaralı fatura oluşturuldu`,
    });

    return res.status(201).json(invoice);
  } catch (error) {
    return next(error);
  }
});

export default router;

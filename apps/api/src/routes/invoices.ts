import { Router } from 'express';
import { z } from 'zod';
import { ActionType, TransferStatus } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { adjustStock } from '../services/stockService';
import { recordLog } from '../services/logService';
import { sendInvoiceToProvider } from '../services/invoiceService';
import { requireAdmin } from '../middleware/roleGuard';

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

const invoiceItemSchema = z.object({
  productId: z.string(),
  lotId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  vatRate: z.number().nonnegative().default(0),
  lotNumber: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional().nullable(),
});

const stockAdjustmentSchema = z.object({
  warehouseId: z.string(),
  stockLocationId: z.string().optional(),
  lotId: z.string(),
  quantity: z.number().int().positive(),
});

const summarySchema = z.object({
  grossTotal: z.number().nonnegative(),
  discountTotal: z.number().nonnegative().default(0),
  netTotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative(),
  grandTotal: z.number().nonnegative(),
  categories: z
    .array(
      z.object({
        category: z.string(),
        quantity: z.number().nonnegative(),
        unit: z.string().optional(),
      }),
    )
    .optional(),
});

const invoiceSchema = z.object({
  customerId: z.string(),
  transferIds: z.array(z.string()).optional(),
  stockAdjustments: z.array(stockAdjustmentSchema).optional(),
  items: z.array(invoiceItemSchema).nonempty(),
  documentType: z.enum(['PROFORMA', 'IRSALIYE', 'FATURA']).default('FATURA'),
  documentNo: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  dispatchNo: z.string().optional(),
  dispatchDate: z.string().optional(),
  notes: z.string().optional(),
  summary: summarySchema.optional(),
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

    const shouldAffectStock = body.documentType !== 'PROFORMA';
    const transferIds = body.transferIds ?? [];

    if (shouldAffectStock) {
      if (body.stockAdjustments && body.stockAdjustments.length > 0) {
        for (const adjust of body.stockAdjustments) {
          await adjustStock({
            warehouseId: adjust.warehouseId,
            lotId: adjust.lotId,
            quantityDelta: -adjust.quantity,
          });
        }
      } else if (transferIds.length > 0) {
        const transfers = await prisma.transfer.findMany({
          where: { id: { in: transferIds } },
        });

        if (transfers.length !== transferIds.length) {
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
          where: { id: { in: transferIds } },
          data: { status: TransferStatus.COMPLETED },
        });
      }
    }

    const providerResponse =
      body.documentType === 'FATURA'
        ? await sendInvoiceToProvider({
            customerName: customer.name,
            items: body.items,
          })
        : null;

    const invoice = await prisma.invoice.create({
      data: {
        customerId: body.customerId,
        items: body.items,
        transferIds: transferIds.length > 0 ? transferIds : undefined,
        invoiceNumber: providerResponse?.invoiceNumber,
        totalAmount: body.summary?.grandTotal ?? body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        createdById: req.currentUser?.id,
        documentType: body.documentType,
        documentNo: body.documentNo,
        issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        dispatchNo: body.dispatchNo,
        dispatchDate: body.dispatchDate ? new Date(body.dispatchDate) : undefined,
        notes: body.notes,
        grossTotal: body.summary?.grossTotal,
        discountTotal: body.summary?.discountTotal,
        netTotal: body.summary?.netTotal,
        taxTotal: body.summary?.taxTotal,
        transfers: {
          connect: transferIds.map((id) => ({ id })),
        },
      },
    });

    await recordLog({
      userId: req.currentUser?.id,
      customerId: body.customerId,
      invoiceId: invoice.id,
      actionType: ActionType.INVOICE_CREATED,
      description: `${invoice.invoiceNumber ?? invoice.id} numaralı ${invoice.documentType.toLowerCase()} oluşturuldu`,
    });

    return res.status(201).json(invoice);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:invoiceId', requireAdmin, async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.invoiceId },
      include: { transfers: true },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Fatura bulunamadı' });
    }

    if (invoice.documentType === 'FATURA') {
      return res.status(400).json({ message: 'Fatura edilmiş kayıt silinemez' });
    }

    await prisma.invoice.delete({
      where: { id: invoice.id },
    });

    await recordLog({
      userId: req.currentUser?.id,
      customerId: invoice.customerId,
      actionType: ActionType.INVOICE_CANCELLED,
      description: `${invoice.documentType.toLowerCase()} silindi (${invoice.invoiceNumber ?? invoice.id})`,
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;

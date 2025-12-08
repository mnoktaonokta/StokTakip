import { Router } from 'express';
import { z } from 'zod';
import { ActionType, TransferStatus } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { adjustStock } from '../services/stockService';
import { recordLog } from '../services/logService';
import { sendInvoiceToProvider } from '../services/invoiceService';
import { requireStaff } from '../middleware/roleGuard';

const router = Router();

router.get('/', async (req, res) => {
  const showCancelled = req.query.showCancelled === 'true';
  const invoices = await prisma.invoice.findMany({
    where: showCancelled ? undefined : { isCancelled: false },
    include: {
      customer: true,
      transfers: true,
      cancelledBy: true,
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
        cancelledBy: true,
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

const invoiceUpdateSchema = z.object({
  items: z.array(invoiceItemSchema).nonempty(),
  documentNo: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  dispatchNo: z.string().optional(),
  dispatchDate: z.string().optional(),
  notes: z.string().optional(),
  summary: summarySchema.optional(),
});

router.post('/', requireStaff, async (req, res, next) => {
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
          await adjustStock({
            warehouseId: transfer.fromWarehouseId,
            lotId: transfer.lotId,
            quantityDelta: transfer.quantity,
          });
        }

        await prisma.transfer.updateMany({
          where: { id: { in: transferIds } },
          data: { status: TransferStatus.COMPLETED },
        });
      }
    }

    const lotIds = body.items?.map((item) => item.lotId) ?? [];
    const lotsWithProduct =
      lotIds.length > 0
        ? await prisma.lot.findMany({
            where: { id: { in: lotIds } },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  vatRate: true,
                },
              },
            },
          })
        : [];
    const lotMap = new Map(lotsWithProduct.map((lot) => [lot.id, lot]));

    // 1. Adım: Verileri işle (Burada null dönebilir)
    const rawDetails =
      body.items?.map((item) => {
        const lot = lotMap.get(item.lotId);
        const productInfo = lot?.product;
        if (!productInfo) {
          return null;
        }
        const taxRate = Number(productInfo.vatRate ?? 0);
        const quantity = item.quantity;
        const unitPrice = item.unitPrice;
        const grossPrice = Number((unitPrice * quantity).toFixed(2));
        const net = grossPrice;
        const tax = Number(((net * taxRate) / 100).toFixed(2));
        const total = Number((net + tax).toFixed(2));
        return {
          productId: productInfo.id,
          productName: productInfo.name,
          barcode: lot?.barcode ?? undefined,
          taxRate,
          quantity,
          unitPrice,
          grossPrice,
          discount: 0,
          net,
          tax,
          total,
        };
      }) ?? [];

    // 2. Adım: TypeScript Hatasını Önlemek İçin Null Değerleri Filtrele
    const providerDetails = rawDetails.filter(
      (detail): detail is NonNullable<typeof detail> => detail !== null,
    );

    const providerAmounts = providerDetails.reduce(
      (acc, detail) => {
        acc.gross += detail.grossPrice;
        acc.discount += detail.discount;
        acc.net += detail.net;
        acc.tax += detail.tax;
        acc.total += detail.total;
        return acc;
      },
      { currency: 'TL', gross: 0, discount: 0, net: 0, tax: 0, total: 0 },
    );

    // Firma bilgilerini çekip (varsa) banka hesap bilgisini fatura notuna ekle
    const company = await prisma.companyInfo.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    const bankNote = company?.bankAccount
      ? `\n\nBanka Hesap Bilgileri:\n${company.bankAccount}`
      : '';

    const providerNote = `${body.notes ?? ''}${bankNote}`;

    const providerResponse =
      body.documentType === 'FATURA' && providerDetails.length > 0
        ? await sendInvoiceToProvider({
            invoiceNo: body.documentNo ?? undefined,
            note: providerNote || undefined,
            invoiceDate: body.issueDate ? new Date(body.issueDate) : new Date(),
            dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
            deliveryDate: body.dispatchDate ? new Date(body.dispatchDate) : undefined,
            type: 'SALE',
            customer: {
              id: customer.id,
              title: customer.name,
              address: customer.address,
              taxOffice: customer.taxOffice,
              taxNo: customer.taxNumber,
              email: customer.email,
              phone: customer.phone,
            },
            details: providerDetails,
            amounts: providerAmounts,
          })
        : null;

    const invoice = await prisma.invoice.create({
      data: {
        customerId: body.customerId,
        items: body.items,
        transferIds: transferIds.length > 0 ? transferIds : undefined,
        invoiceNumber: providerResponse?.invoiceNumber,
        totalAmount:
          body.summary?.grandTotal ??
          body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        createdById: req.currentUser?.id,
        documentType: body.documentType,
        documentNo: body.documentNo,
        issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        dispatchNo: body.dispatchNo,
        dispatchDate: body.dispatchDate ? new Date(body.dispatchDate) : undefined,
        notes: providerNote,
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

router.delete('/:invoiceId', requireStaff, async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.invoiceId },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Fatura bulunamadı' });
    }

    if (invoice.isCancelled) {
      return res.status(400).json({ message: 'Bu belge zaten iptal edilmiş' });
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        isCancelled: true,
        cancelledAt: new Date(),
        cancelledById: req.currentUser?.id,
      },
      include: {
        cancelledBy: true,
      },
    });

    await recordLog({
      userId: req.currentUser?.id,
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      actionType: ActionType.INVOICE_CANCELLED,
      description: `${invoice.documentType.toLowerCase()} iptal edildi (${invoice.invoiceNumber ?? invoice.id})`,
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.put('/:invoiceId', requireStaff, async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.invoiceId },
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Belge bulunamadı' });
    }

    if (invoice.documentType === 'FATURA' || invoice.isCancelled) {
      return res
        .status(400)
        .json({ message: 'Kesilmiş veya iptal edilmiş belgeler güncellenemez' });
    }

    const body = invoiceUpdateSchema.parse(req.body);
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        items: body.items,
        documentNo: body.documentNo ?? undefined,
        issueDate: body.issueDate ? new Date(body.issueDate) : invoice.issueDate,
        dueDate: body.dueDate ? new Date(body.dueDate) : invoice.dueDate,
        dispatchNo: body.dispatchNo ?? undefined,
        dispatchDate: body.dispatchDate ? new Date(body.dispatchDate) : invoice.dispatchDate,
        notes: body.notes ?? undefined,
        totalAmount:
          body.summary?.grandTotal ??
          body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        grossTotal: body.summary?.grossTotal,
        discountTotal: body.summary?.discountTotal,
        netTotal: body.summary?.netTotal,
        taxTotal: body.summary?.taxTotal,
      },
    });

    await recordLog({
      userId: req.currentUser?.id,
      customerId: invoice.customerId,
      actionType: ActionType.MANUAL_ADJUSTMENT,
      description: `${invoice.documentType.toLowerCase()} güncellendi (${invoice.invoiceNumber ?? invoice.id})`,
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

export default router;
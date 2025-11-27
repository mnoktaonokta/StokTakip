import { ActionType, Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';

interface LogPayload {
  userId?: string;
  customerId?: string;
  productId?: string;
  lotId?: string;
  transferId?: string;
  invoiceId?: string;
  warehouseId?: string;
  actionType: ActionType;
  description: string;
  barcodeUsed?: boolean;
}

export const recordLog = async (payload: LogPayload) => {
  try {
    return await prisma.log.create({
      data: {
        ...payload,
        barcodeUsed: payload.barcodeUsed ?? false,
      },
    });
  } catch (error) {
    if (
      payload.invoiceId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      const fallbackPayload = { ...payload, invoiceId: undefined };
      return prisma.log.create({
        data: {
          ...fallbackPayload,
          barcodeUsed: fallbackPayload.barcodeUsed ?? false,
        },
      });
    }
    throw error;
  }
};

import { ActionType } from '@prisma/client';

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
  return prisma.log.create({
    data: {
      ...payload,
      barcodeUsed: payload.barcodeUsed ?? false,
    },
  });
};

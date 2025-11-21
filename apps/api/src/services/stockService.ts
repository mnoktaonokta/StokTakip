import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma';

export const ensureStockLocation = async (warehouseId: string, lotId: string) => {
  return prisma.stockLocation.upsert({
    where: {
      warehouseId_lotId: {
        warehouseId,
        lotId,
      },
    },
    create: {
      warehouseId,
      lotId,
      quantity: 0,
    },
    update: {},
  });
};

interface AdjustStockParams {
  warehouseId: string;
  lotId: string;
  quantityDelta: number;
}

export const adjustStock = async ({ warehouseId, lotId, quantityDelta }: AdjustStockParams) => {
  const location = await ensureStockLocation(warehouseId, lotId);
  const newQuantity = location.quantity + quantityDelta;

  if (newQuantity < 0) {
    throw new Error('Bu stok hareketi için depoda yeterli ürün yok');
  }

  return prisma.stockLocation.update({
    where: { id: location.id },
    data: { quantity: newQuantity },
  });
};

export const getProductStockSummary = async () => {
  const products = await prisma.product.findMany({
    include: {
      lots: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return products.map((product) => {
    const totalQuantity = product.lots.reduce((acc, lot) => acc + lot.quantity, 0);
    return {
      ...product,
      totalQuantity,
    };
  });
};

export const findLotByBarcode = async (barcode: string) => {
  return prisma.lot.findFirst({
    where: {
      barcode,
    },
    include: {
      product: true,
    },
  });
};

interface AutoSelectLotParams {
  productId: string;
  barcode?: string;
}

export const autoSelectLot = async ({ productId, barcode }: AutoSelectLotParams) => {
  if (barcode) {
    const lotByBarcode = await findLotByBarcode(barcode);
    if (lotByBarcode) {
      return lotByBarcode;
    }
  }

  const lots = await prisma.lot.findMany({
    where: { productId },
    orderBy: [
      {
        expiryDate: Prisma.SortOrder.asc,
      },
      {
        createdAt: Prisma.SortOrder.asc,
      },
    ],
  });

  return lots.at(0) ?? null;
};

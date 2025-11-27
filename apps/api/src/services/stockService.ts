import { Prisma, WarehouseType } from '@prisma/client';

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

export const assignLotToMainWarehouse = async (lotId: string, quantity: number) => {
  if (quantity <= 0) {
    return;
  }

  const mainWarehouse = await getMainWarehouse();

  if (!mainWarehouse) {
    console.warn('Ana depo bulunamadığı için lot stok kaydı yapılamadı.');
    return;
  }

  await adjustStock({
    warehouseId: mainWarehouse.id,
    lotId,
    quantityDelta: quantity,
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

const getMainWarehouse = async () => {
  return prisma.warehouse.findFirst({
    where: { type: WarehouseType.MAIN },
    orderBy: { createdAt: 'asc' },
  });
};

export const syncMainWarehouseStock = async () => {
  const mainWarehouse = await getMainWarehouse();

  if (!mainWarehouse) {
    console.warn('Ana depo bulunamadı; stok senkronizasyonu atlandı.');
    return { updatedLots: 0 };
  }

  const lots = await prisma.lot.findMany({
    select: {
      id: true,
      quantity: true,
      stockLocations: {
        select: {
          quantity: true,
        },
      },
    },
  });

  let updatedLots = 0;

  for (const lot of lots) {
    const trackedQuantity = lot.stockLocations.reduce((sum, location) => sum + location.quantity, 0);
    const untrackedQuantity = lot.quantity - trackedQuantity;

    if (untrackedQuantity <= 0) {
      continue;
    }

    await prisma.stockLocation.upsert({
      where: {
        warehouseId_lotId: {
          warehouseId: mainWarehouse.id,
          lotId: lot.id,
        },
      },
      create: {
        warehouseId: mainWarehouse.id,
        lotId: lot.id,
        quantity: untrackedQuantity,
      },
      update: {
        quantity: {
          increment: untrackedQuantity,
        },
      },
    });

    updatedLots += 1;
  }

  if (updatedLots > 0) {
    console.log(`🔄 Ana depo stok senkronizasyonu: ${updatedLots} lot için eksik stok kaydı güncellendi.`);
  }

  return { updatedLots };
};

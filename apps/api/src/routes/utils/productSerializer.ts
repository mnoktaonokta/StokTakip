import { Prisma } from '@prisma/client';

export const productInclude = {
  lots: {
    orderBy: { createdAt: 'desc' },
    include: {
      stockLocations: {
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

export type ProductWithLots = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export const serializeLot = (lot: ProductWithLots['lots'][number]) => {
  const stockByWarehouseType = lot.stockLocations.reduce(
    (acc, loc) => {
      const type = loc.warehouse.type;
      acc[type] = (acc[type] ?? 0) + loc.quantity;
      acc.total += loc.quantity;
      return acc;
    },
    { total: 0 } as Record<string, number>,
  );
  const trackedQuantity = stockByWarehouseType.total ?? 0;

  return {
  id: lot.id,
  productId: lot.productId,
  lotNumber: lot.lotNumber,
  quantity: lot.quantity,
    trackedQuantity,
    onHandQuantity: (stockByWarehouseType.MAIN ?? 0) + (stockByWarehouseType.EMPLOYEE ?? 0),
    customerQuantity: stockByWarehouseType.CUSTOMER ?? 0,
    stockLocations: lot.stockLocations.map((location) => ({
      id: location.id,
      quantity: location.quantity,
      warehouse: location.warehouse,
    })),
  barcode: lot.barcode,
  expiryDate: lot.expiryDate ? lot.expiryDate.toISOString() : null,
  };
};

export const serializeProduct = (product: ProductWithLots) => {
  const lotSummaries = product.lots.map(serializeLot);

  const onHandQuantity = lotSummaries.reduce((sum, lot) => sum + (lot.onHandQuantity ?? 0), 0);
  const customerQuantity = lotSummaries.reduce((sum, lot) => sum + (lot.customerQuantity ?? 0), 0);

  return {
  id: product.id,
  name: product.name,
  referenceCode: product.referenceCode,
  brand: product.brand,
  category: product.category,
  salePrice: product.salePrice ? Number(product.salePrice) : null,
  purchasePrice: product.purchasePrice ? Number(product.purchasePrice) : null,
  vatRate: product.vatRate ? Number(product.vatRate) : null,
  isActive: product.isActive,
  criticalStockLevel: product.criticalStockLevel ?? null,
    totalQuantity: onHandQuantity,
    onHandQuantity,
    customerQuantity,
    lots: lotSummaries,
  };
};


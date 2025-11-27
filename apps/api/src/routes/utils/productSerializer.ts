import { Prisma } from '@prisma/client';

export const productInclude = {
  lots: {
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.ProductInclude;

export type ProductWithLots = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export const serializeLot = (lot: ProductWithLots['lots'][number]) => ({
  id: lot.id,
  productId: lot.productId,
  lotNumber: lot.lotNumber,
  quantity: lot.quantity,
  barcode: lot.barcode,
  expiryDate: lot.expiryDate ? lot.expiryDate.toISOString() : null,
});

export const serializeProduct = (product: ProductWithLots) => ({
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
  totalQuantity: product.lots.reduce((sum, lot) => sum + lot.quantity, 0),
  lots: product.lots.map(serializeLot),
});


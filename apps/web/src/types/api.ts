export interface ProductSummary {
  id: string;
  referenceCode: string;
  name: string;
  category?: string | null;
  salePrice?: number | null;
  purchasePrice?: number | null;
  totalQuantity: number;
  lots: Lot[];
}

export interface Lot {
  id: string;
  productId: string;
  lotNumber: string;
  quantity: number;
  barcode?: string | null;
  expiryDate?: string | null;
}

export interface Warehouse {
  id: string;
  name: string;
  type: 'MAIN' | 'CUSTOMER' | 'EMPLOYEE';
}

export interface WarehouseWithStock extends Warehouse {
  stockLocations: Array<{
    id: string;
    quantity: number;
    lot: Lot & { product: ProductSummary };
  }>;
}

export interface StockLocation {
  id: string;
  warehouseId: string;
  lotId: string;
  quantity: number;
  lot: Lot & { product: ProductSummary };
}

export interface Transfer {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  lot: Lot & { product: ProductSummary };
  quantity: number;
  status: 'PENDING' | 'COMPLETED' | 'REVERSED';
  barcodeScanned: boolean;
  timestamp: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  warehouseId: string;
}

export interface Invoice {
  id: string;
  invoiceNumber?: string | null;
  customer: Customer;
  totalAmount?: number | null;
  timestamp: string;
}

export interface ActivityLog {
  id: string;
  actionType: string;
  description: string;
  timestamp: string;
  user?: { name: string | null } | null;
  customer?: Customer | null;
  product?: ProductSummary | null;
  lot?: Lot | null;
}

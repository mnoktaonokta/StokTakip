export interface ProductSummary {
  id: string;
  referenceCode: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  salePrice?: number | null;
  vatRate?: number | null;
  isActive: boolean;
  criticalStockLevel?: number | null;
  totalQuantity: number;
  onHandQuantity?: number;
  customerQuantity?: number;
  lots: Lot[];
}

export interface Lot {
  id: string;
  productId: string;
  lotNumber: string;
  quantity: number;
  trackedQuantity?: number;
  onHandQuantity?: number;
  customerQuantity?: number;
  stockLocations?: Array<{
    id: string;
    quantity: number;
    warehouse: {
      id: string;
      name: string;
      type: 'MAIN' | 'CUSTOMER' | 'EMPLOYEE';
    };
  }>;
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
    lotId: string;
    quantity: number;
    lot: Lot & { product: ProductSummary };
  }>;
  customers?: Customer[];
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

export interface CustomerInvoiceSummary {
  id: string;
  totalAmount?: number | null;
  timestamp: string;
  invoiceNumber?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxOffice?: string | null;
  taxNumber?: string | null;
  logo?: string | null;
  warehouseId?: string | null;
  warehouse?: WarehouseWithStock | null;
  invoices?: CustomerInvoiceSummary[];
  notes?: CustomerNote[];
}

export interface CustomerNote {
  id: string;
  content: string;
  createdAt: string;
}

export interface InvoiceItem {
  productId: string;
  lotId: string;
  lotNumber?: string | null;
  description?: string | null;
  referenceCode?: string | null;
  quantity: number;
  unitPrice: number;
  vatRate?: number | null;
  category?: string | null;
  warehouseId?: string | null;
  stockLocationId?: string | null;
}

export interface Invoice {
  id: string;
  invoiceNumber?: string | null;
  customer: Customer;
  totalAmount?: number | null;
  timestamp: string;
  documentType?: 'PROFORMA' | 'IRSALIYE' | 'FATURA';
  documentNo?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  dispatchNo?: string | null;
  dispatchDate?: string | null;
  notes?: string | null;
  isCancelled?: boolean;
  cancelledAt?: string | null;
  cancelledBy?: { name: string | null } | null;
  items?: InvoiceItem[] | null;
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
  warehouse?: Warehouse | null;
  invoice?: Invoice | null;
}

export interface CurrentUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: 'admin' | 'employee';
  canManageStock?: boolean;
  canCreateInvoices?: boolean;
  canManageProducts?: boolean;
}

export interface UserSummary extends CurrentUser {}

export interface CompanyInfo {
  id: string;
  tradeName: string;
  address?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  bankAccount?: string | null;
}

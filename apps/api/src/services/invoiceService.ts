import axios from 'axios';
import dayjs from 'dayjs';

import { env } from '../config/env';

interface ProviderCustomer {
  id: string;
  title: string;
  address?: string | null;
  taxOffice?: string | null;
  taxNo?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface ProviderDetail {
  productId: string;
  productName: string;
  note?: string;
  barcode?: string | null;
  taxRate: number;
  quantity: number;
  unitPrice: number;
  grossPrice: number;
  discount: number;
  net: number;
  tax: number;
  total: number;
}

interface ProviderAmounts {
  currency: string;
  gross: number;
  discount: number;
  net: number;
  tax: number;
  total: number;
}

interface CreateInvoiceParams {
  invoiceNo?: string | null;
  note?: string | null;
  invoiceDate: Date;
  dueDate?: Date;
  deliveryDate?: Date;
  type: 'SALE' | 'PURCHASE';
  customer: ProviderCustomer;
  details: ProviderDetail[];
  amounts: ProviderAmounts;
}

const mapInvoiceType = (type: CreateInvoiceParams['type']) => {
  switch (type) {
    case 'SALE':
      return 3;
    case 'PURCHASE':
      return 5;
    default:
      return 3;
}
};

export const sendInvoiceToProvider = async (params: CreateInvoiceParams) => {
  if (!env.bizimHesapApiKey || !env.bizimHesapFirmId) {
    console.warn('[invoice] Missing BizimHesap credentials, skipping remote call');
    return {
      invoiceNumber: `SIM-${dayjs().format('YYYYMMDD-HHmmss')}`,
      payload: params,
    };
  }

  const payload = {
    firmId: env.bizimHesapFirmId,
    invoiceNo: params.invoiceNo ?? undefined,
    invoiceType: mapInvoiceType(params.type),
    note: params.note ?? undefined,
    dates: {
      invoiceDate: params.invoiceDate.toISOString(),
      deliveryDate: params.deliveryDate?.toISOString(),
      dueDate: params.dueDate?.toISOString() ?? params.invoiceDate.toISOString(),
    },
    customer: {
      customerId: params.customer.id,
      title: params.customer.title,
      address: params.customer.address ?? undefined,
      taxOffice: params.customer.taxOffice ?? undefined,
      taxNo: params.customer.taxNo ?? undefined,
      email: params.customer.email ?? undefined,
      phone: params.customer.phone ?? undefined,
    },
    details: params.details,
    amounts: params.amounts,
  };

  const response = await axios.post(`${env.bizimHesapApiUrl}/addinvoice`, payload, {
      headers: {
      token: env.bizimHesapApiKey,
        'Content-Type': 'application/json',
      },
  });

  const data = response.data;

  if (data.error) {
    throw new Error(`BizimHesap AddInvoice error: ${data.error}`);
  }

  return {
    invoiceNumber: data.guid ?? null,
    remoteUrl: data.url ?? null,
    raw: data,
  };
};

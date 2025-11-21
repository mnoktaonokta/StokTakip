import axios from 'axios';
import dayjs from 'dayjs';

import { env } from '../config/env';

interface InvoiceItem {
  productId: string;
  lotId: string;
  quantity: number;
  unitPrice: number;
}

interface CreateInvoiceParams {
  customerTaxNumber?: string;
  customerName: string;
  items: InvoiceItem[];
}

export const sendInvoiceToProvider = async (params: CreateInvoiceParams) => {
  if (!env.bizimHesapApiKey) {
    console.warn('[invoice] Missing BizimHesap credentials, skipping remote call');
    return {
      invoiceNumber: `SIM-${dayjs().format('YYYYMMDD-HHmmss')}`,
      payload: params,
    };
  }

  const response = await axios.post(
    `${env.bizimHesapApiUrl}/invoices`,
    {
      ...params,
    },
    {
      headers: {
        Authorization: `Bearer ${env.bizimHesapApiKey}`,
        'Content-Type': 'application/json',
      },
    },
  );

  return response.data;
};

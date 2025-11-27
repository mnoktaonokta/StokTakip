import { CustomerTable, type CustomerRow } from './CustomerTable';

import { apiFetch as apiFetchServer } from '@/lib/api-client/server';
import type { Customer } from '@/types/api';

export default async function CustomersPage() {
  const customers = await apiFetchServer<Customer[]>('/api/customers');

  const enriched: CustomerRow[] = customers.map((customer) => {
    const stockLocations = customer.warehouse?.stockLocations ?? [];
    const totalValue = stockLocations.reduce(
      (sum, location) => sum + location.quantity * (location.lot.product.salePrice ?? 0),
      0,
    );
    const openBalance = totalValue;
    const chequeBalance = 0;
    const phone = customer.phone ?? customer.email ?? '-';
    return {
      id: customer.id,
      name: customer.name,
      warehouseId: customer.warehouseId,
      displayPhone: phone,
      openBalance,
      totalValue,
      chequeBalance,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-slate-500">Aktif Müşteriler</p>
          <h1 className="text-3xl font-semibold text-white">Müşteri Listesi</h1>
          <p className="text-xs text-slate-400">Açık bakiyeleri ve depo stoklarını inceleyin.</p>
        </div>
      </div>

      <CustomerTable customers={enriched} />
    </div>
  );
}

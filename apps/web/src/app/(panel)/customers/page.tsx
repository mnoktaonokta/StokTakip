import { apiFetch } from '@/lib/api-client';
import type { Customer } from '@/types/api';

export default async function CustomersPage() {
  const customers = await apiFetch<Customer[]>('/api/customers');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-slate-500">Müşteri Depoları</p>
        <h1 className="text-3xl font-semibold text-white">Doktor & Klinik Bekleyen Ürünleri</h1>
        <p className="text-sm text-slate-400">
          Fatura kesilene kadar bekleyen implantları müşteri depolarında takip edin.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {customers.map((customer) => (
          <div key={customer.id} className="rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Müşteri</p>
                <h3 className="text-xl font-semibold text-white">{customer.name}</h3>
                <p className="text-xs text-slate-500">{customer.email ?? customer.phone ?? 'İletişim bilgisi yok'}</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                {customer.warehouseId.slice(0, 6)}
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Depo ID: <span className="font-mono text-slate-200">{customer.warehouseId}</span>
            </p>
            <p className="text-xs text-slate-500">Detaylı stok için müşteri kartından bakın.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

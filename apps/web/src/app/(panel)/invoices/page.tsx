import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { apiFetch } from '@/lib/api-client';
import type { Invoice } from '@/types/api';

export default async function InvoicesPage() {
  const invoices = await apiFetch<Invoice[]>('/api/invoices');

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-slate-500">Faturalama</p>
        <h1 className="text-3xl font-semibold text-white">E-Fatura Entegrasyonu</h1>
        <p className="text-sm text-slate-400">
          BizimHesap API ile fatura kesmeye hazır altyapı. Transferler ile eşleştirilen ürünler otomatik düşer.
        </p>
      </div>

      <InvoiceForm />

      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-xl font-semibold text-white">Son Faturalar</h2>
        <div className="mt-4 divide-y divide-slate-800 text-sm text-slate-200">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-white">{invoice.customer.name}</p>
                <p className="text-xs text-slate-500">{invoice.invoiceNumber ?? invoice.id}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-emerald-300">
                  {(invoice.totalAmount ?? 0).toLocaleString('tr-TR')} ₺
                </p>
                <p className="text-xs text-slate-500">{new Date(invoice.timestamp).toLocaleDateString('tr-TR')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

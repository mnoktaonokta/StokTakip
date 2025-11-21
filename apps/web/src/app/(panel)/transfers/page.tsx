import { TransferForm } from '@/components/transfers/TransferForm';
import { apiFetch } from '@/lib/api-client';
import type { Transfer } from '@/types/api';

export default async function TransfersPage() {
  const transfers = await apiFetch<Transfer[]>('/api/transfers?limit=20');

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-slate-500">Transfer</p>
        <h1 className="text-3xl font-semibold text-white">Barkod Destekli Transfer İş Akışı</h1>
        <p className="text-sm text-slate-400">
          Depolar arası, müşteri depolarına veya iade süreçlerinde lot bazlı hareketleri kaydedin.
        </p>
      </div>

      <TransferForm />

      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-xl font-semibold text-white">Son Transferler</h2>
        <div className="mt-4 divide-y divide-slate-800 text-sm">
          {transfers.map((transfer) => (
            <div key={transfer.id} className="flex items-center justify-between px-2 py-3 text-slate-200">
              <div>
                <p className="font-medium text-white">{transfer.lot.product.name}</p>
                <p className="text-xs text-slate-500">
                  Lot {transfer.lot.lotNumber} • {new Date(transfer.timestamp).toLocaleString('tr-TR')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-cyan-300">{transfer.quantity} adet</p>
                <p className="text-xs uppercase tracking-widest text-slate-500">{transfer.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

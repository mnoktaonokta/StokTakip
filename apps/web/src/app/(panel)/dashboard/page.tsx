import { apiFetch } from '@/lib/api-client';
import type { ActivityLog, Invoice, ProductSummary, Transfer } from '@/types/api';

const getDashboardData = async () => {
  const [products, transfers, invoices, logs] = await Promise.all([
    apiFetch<ProductSummary[]>('/api/products'),
    apiFetch<Transfer[]>('/api/transfers?limit=10'),
    apiFetch<Invoice[]>('/api/invoices'),
    apiFetch<ActivityLog[]>('/api/logs'),
  ]);

  const totalStock = products.reduce((sum, product) => sum + product.totalQuantity, 0);
  const pendingTransfers = transfers.filter((transfer) => transfer.status === 'PENDING').length;

  return {
    products,
    transfers,
    invoices,
    logs: logs.slice(0, 6),
    metrics: {
      totalProducts: products.length,
      totalStock,
      pendingTransfers,
      invoicesToday: invoices.filter((invoice) => new Date(invoice.timestamp).toDateString() === new Date().toDateString())
        .length,
    },
  };
};

export default async function DashboardPage() {
  const { metrics, products, transfers, logs } = await getDashboardData();

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Toplam Ürün', value: metrics.totalProducts },
          { label: 'Toplam Stok', value: metrics.totalStock },
          { label: 'Bekleyen Transfer', value: metrics.pendingTransfers },
          { label: 'Bugünkü Fatura', value: metrics.invoicesToday },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-lg shadow-black/10">
            <p className="text-sm text-slate-400">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Kritik Stoklar</h2>
          <p className="text-sm text-slate-400">Lot miktarı 10 adetten az olan ürünler</p>
          <div className="mt-4 space-y-3">
            {products
              .flatMap((product) => product.lots.map((lot) => ({ product, lot })))
              .filter(({ lot }) => lot.quantity < 10)
              .slice(0, 6)
              .map(({ product, lot }) => (
                <div key={lot.id} className="flex items-center justify-between rounded-xl border border-slate-800/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{product.name}</p>
                    <p className="text-xs text-slate-400">
                      Lot {lot.lotNumber} • Barkod {lot.barcode ?? '—'}
                    </p>
                  </div>
                  <span className="rounded-full bg-rose-500/20 px-3 py-1 text-sm text-rose-300">{lot.quantity} adet</span>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Bekleyen Transferler</h2>
          <div className="mt-4 space-y-3">
            {transfers
              .filter((transfer) => transfer.status === 'PENDING')
              .slice(0, 5)
              .map((transfer) => (
                <div key={transfer.id} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <p className="font-medium">{transfer.lot.product.name}</p>
                  <p className="text-xs text-amber-200">
                    {transfer.quantity} adet • Lot {transfer.lot.lotNumber}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Son İşlemler</h2>
          <div className="mt-4 space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-xl border border-slate-800/50 px-4 py-3">
                <p className="text-sm text-white">{log.description}</p>
                <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString('tr-TR')}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Lot Bazlı Stok</h2>
          <div className="mt-4 divide-y divide-slate-800 border border-slate-800/60 rounded-2xl">
            {products.slice(0, 6).map((product) => (
              <div key={product.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{product.name}</p>
                  <p className="text-xs text-slate-400">{product.referenceCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-cyan-300">{product.totalQuantity}</p>
                  <p className="text-xs text-slate-500">Adet</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

import { UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { apiFetch as apiFetchServer } from '@/lib/api-client/server';
import type { ActivityLog, Invoice, ProductSummary } from '@/types/api';

const getDashboardData = async () => {
  // Not: Backend henüz Clerk token'ını doğrulayamayabilir, 
  // bu yüzden fetch hatalarını yakalamak için try-catch bloğuna alabiliriz.
  try {
    const [products, invoices, logs] = await Promise.all([
      apiFetchServer<ProductSummary[]>('/api/products'),
      apiFetchServer<Invoice[]>('/api/invoices'),
      apiFetchServer<ActivityLog[]>('/api/logs'),
    ]);

    const totalStock = products.reduce((sum, product) => sum + product.totalQuantity, 0);

    return {
      products,
      invoices,
      logs: logs.slice(0, 6),
      metrics: {
        totalProducts: products.length,
        totalStock,
        invoicesToday: invoices.filter((invoice) => new Date(invoice.timestamp).toDateString() === new Date().toDateString())
          .length,
      },
    };
  } catch (error) {
    console.error("Dashboard veri çekme hatası:", error);
    // Hata durumunda boş veri dönelim ki sayfa patlamasın
    return {
      products: [],
      invoices: [],
      logs: [],
      metrics: { totalProducts: 0, totalStock: 0, invoicesToday: 0 }
    };
  }
};

export default async function DashboardPage() {
  // Clerk'ten kullanıcı bilgisini al
  const user = await currentUser();
  
  // API'den verileri al
  const { metrics, products, invoices, logs } = await getDashboardData();

  return (
    <div className="space-y-8 p-6 min-h-screen bg-slate-950 text-white">
      
      {/* --- YENİ EKLENEN HEADER KISMI --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
        <div>
          <h1 className="text-2xl font-bold text-white">Stok Takip Paneli</h1>
          <p className="text-slate-400">
            Hoş geldin, <span className="text-cyan-400 font-medium">{user?.firstName || 'Kullanıcı'}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500 hidden sm:inline">Oturum Yönetimi:</span>
          <div className="bg-white rounded-full p-1">
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </div>
      {/* ---------------------------------- */}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Toplam Ürün', value: metrics.totalProducts },
          { label: 'Toplam Stok', value: metrics.totalStock },
          { label: 'Bugünkü Fatura', value: metrics.invoicesToday },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-center shadow-lg shadow-black/10">
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
          <h2 className="text-lg font-semibold text-white">Son Faturalar</h2>
          <div className="mt-4 space-y-3">
            {invoices.length === 0 ? (
              <p className="text-sm text-slate-500">Henüz fatura kaydı yok.</p>
            ) : (
              invoices.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between rounded-xl border border-slate-800/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{invoice.customer.name}</p>
                    <p className="text-xs text-slate-400">{invoice.invoiceNumber ?? invoice.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-300">
                      {Number(invoice.totalAmount ?? 0).toLocaleString('tr-TR')} ₺
                    </p>
                    <p className="text-xs text-slate-500">{new Date(invoice.timestamp).toLocaleDateString('tr-TR')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Son İşlemler</h2>
          <div className="mt-4 space-y-3">
            {logs.length === 0 ? (
                <p className="text-sm text-slate-500">Henüz işlem kaydı yok.</p>
            ) : (
                logs.map((log) => (
                <div key={log.id} className="rounded-xl border border-slate-800/50 px-4 py-3">
                    <p className="text-sm text-white">{log.description}</p>
                    <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString('tr-TR')}</p>
                </div>
                ))
            )}
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
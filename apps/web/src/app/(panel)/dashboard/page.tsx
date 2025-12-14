import { ClerkLoaded, UserButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';
import { apiFetch as apiFetchServer } from '@/lib/api-client/server';
import type { Invoice, ProductSummary } from '@/types/api';

type CategoryKey = 'implant' | 'abutment' | 'intermediate' | 'other';

const CATEGORY_DEFINITIONS: Array<{
  key: CategoryKey;
  label: string;
  description: string;
  textColor: string;
  barColor: string;
}> = [
  {
    key: 'implant',
    label: 'İmplant',
    description: 'Vida ve implant gövdesi stokları',
    textColor: 'text-sky-300',
    barColor: 'bg-sky-500',
  },
  {
    key: 'abutment',
    label: 'Abutment',
    description: 'Abutment ve üst yapı parçaları',
    textColor: 'text-fuchsia-300',
    barColor: 'bg-fuchsia-500',
  },
  {
    key: 'intermediate',
    label: 'Ara Parça',
    description: 'Ara bağlantı, transfer, vida vb.',
    textColor: 'text-emerald-300',
    barColor: 'bg-emerald-500',
  },
  {
    key: 'other',
    label: 'Diğer',
    description: 'Kategori belirtilmemiş ürünler',
    textColor: 'text-slate-200',
    barColor: 'bg-slate-400',
  },
];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeCategory = (category?: string | null): CategoryKey => {
  if (!category) return 'other';

  const value = normalizeText(category);

  if (value.includes('implant')) return 'implant';
  if (value.includes('abut')) return 'abutment';
  if (value.includes('ara') || value.includes('intermediate') || value.includes('connector') || value.includes('transfer')) {
    return 'intermediate';
  }

  return 'other';
};

const getOnHandQuantity = (product: ProductSummary) => product.onHandQuantity ?? product.totalQuantity ?? 0;
const getCustomerQuantity = (product: ProductSummary) => product.customerQuantity ?? 0;

const getCategoryBreakdown = (products: ProductSummary[]) => {
  const counts: Record<
    CategoryKey,
    {
      onHand: number;
      customer: number;
    }
  > = {
    implant: { onHand: 0, customer: 0 },
    abutment: { onHand: 0, customer: 0 },
    intermediate: { onHand: 0, customer: 0 },
    other: { onHand: 0, customer: 0 },
  };

  for (const product of products) {
    const key = normalizeCategory(product.category);
    counts[key].onHand += getOnHandQuantity(product);
    counts[key].customer += getCustomerQuantity(product);
  }

  const total = Object.values(counts ?? {}).reduce((sum, value) => sum + (value?.onHand ?? 0) + (value?.customer ?? 0), 0);

  return { counts, total };
};

const getDashboardData = async () => {
  // Not: Backend henüz Clerk token'ını doğrulayamayabilir, 
  // bu yüzden fetch hatalarını yakalamak için try-catch bloğuna alabiliriz.
  try {
    const [products, invoices] = await Promise.all([
      apiFetchServer<ProductSummary[]>('/api/products'),
      apiFetchServer<Invoice[]>('/api/invoices'),
    ]);

    const totalStock = (products ?? []).reduce((sum, product) => sum + getOnHandQuantity(product), 0);
    const customerStock = (products ?? []).reduce((sum, product) => sum + getCustomerQuantity(product), 0);

    return {
      products,
      invoices,
      metrics: {
        totalProducts: products.length,
        totalStock,
        customerStock,
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
      metrics: { totalProducts: 0, totalStock: 0, customerStock: 0, invoicesToday: 0 }
    };
  }
};

export default async function DashboardPage() {
  // Clerk'ten kullanıcı bilgisini al
  const user = await currentUser();
  
  // API'den verileri al
  const { metrics, products, invoices } = await getDashboardData();
  const categoryStats = getCategoryBreakdown(products);

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
            <ClerkLoaded>
              <UserButton afterSignOutUrl="/sign-in" />
            </ClerkLoaded>
          </div>
        </div>
      </div>
      {/* ---------------------------------- */}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Toplam Ürün', value: metrics.totalProducts },
          { label: 'Depodaki Stok', value: metrics.totalStock },
          { label: 'Müşteri Deposu', value: metrics.customerStock },
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Kategori Bazlı Stok</h2>
              <p className="text-sm text-slate-400">İmplant, abutment ve diğer bileşenlerin payı</p>
            </div>
            <div className="rounded-xl bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-200">
              {categoryStats.total.toLocaleString('tr-TR')} adet
            </div>
          </div>
          <div className="mt-6 space-y-4">
            {CATEGORY_DEFINITIONS.map((category) => {
              const categoryCount = categoryStats.counts[category.key];
              const totalCount = categoryCount.onHand + categoryCount.customer;
              const share = categoryStats.total ? Math.round((totalCount / categoryStats.total) * 100) : 0;

              return (
                <div key={category.key} className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                  <div>
                      <p className="text-sm font-semibold text-white">{category.label}</p>
                      <p className="text-xs text-slate-500">{category.description}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-semibold ${category.textColor}`}>{totalCount.toLocaleString('tr-TR')}</p>
                      <p className="text-xs text-slate-500">{share}%</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span className="rounded-full border border-slate-800/80 px-2 py-0.5 text-slate-200">
                      Depoda {categoryCount.onHand.toLocaleString('tr-TR')} adet
                    </span>
                    <span className="rounded-full border border-slate-800/60 px-2 py-0.5 text-slate-400">
                      Müşteride {categoryCount.customer.toLocaleString('tr-TR')} adet
                    </span>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${category.barColor}`}
                      style={{ width: `${share}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              );
            })}
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
          <h2 className="text-lg font-semibold text-white">Kritik Stoklar</h2>
          <p className="text-sm text-slate-400">Lot miktarı 10 adetten az olan ürünler</p>
          <div className="mt-4 space-y-3">
            {products
              .flatMap((product) => product.lots.map((lot) => ({ product, lot })))
              .filter(({ lot }) => {
                const available = lot.onHandQuantity ?? lot.trackedQuantity ?? lot.quantity;
                return available < 10;
              })
              .slice(0, 6)
              .map(({ product, lot }) => {
                const available = lot.onHandQuantity ?? lot.trackedQuantity ?? lot.quantity;
                return (
                  <div key={lot.id} className="flex items-center justify-between rounded-xl border border-slate-800/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{product.name}</p>
                      <p className="text-xs text-slate-400">
                        Lot {lot.lotNumber} • Barkod {lot.barcode ?? '—'}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1 text-sm text-rose-300">
                      {available} adet
                      {lot.customerQuantity ? (
                        <span className="rounded-full bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-200">
                          Müşteri: {lot.customerQuantity}
                        </span>
                      ) : null}
                    </span>
                </div>
                );
              })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Lot Bazlı Stok</h2>
          <div className="mt-4 divide-y divide-slate-800 border border-slate-800/60 rounded-2xl">
            {products.slice(0, 6).map((product) => {
              const onHand = getOnHandQuantity(product);
              const customer = getCustomerQuantity(product);
              return (
              <div key={product.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{product.name}</p>
                  <p className="text-xs text-slate-400">{product.referenceCode}</p>
                </div>
                <div className="text-right">
                    <p className="text-lg font-semibold text-cyan-300">{onHand}</p>
                    <p className="text-xs text-slate-500">Depoda</p>
                    {customer ? <p className="text-xs text-slate-500">Müşteri: {customer}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
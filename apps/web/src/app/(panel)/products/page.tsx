import { ProductTable } from '@/components/products/ProductTable';
import { apiFetch } from '@/lib/api-client';
import type { ProductSummary } from '@/types/api';

export default async function ProductsPage() {
  const products = await apiFetch<ProductSummary[]>('/api/products');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-slate-500">Envanter</p>
        <h1 className="text-3xl font-semibold text-white">Ürün & Lot Yönetimi</h1>
        <p className="text-sm text-slate-400">
          Barkod ile takip edilen implant, abutment ve setlerin lot bazlı stok durumunu yönetin.
        </p>
      </div>

      <ProductTable products={products} hidePurchasePrice={false} />
    </div>
  );
}

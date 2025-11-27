import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProductEditor } from '@/components/products/ProductEditor';
import { apiFetch as apiFetchServer } from '@/lib/api-client/server';
import type { ProductSummary } from '@/types/api';

const fetchProduct = async (productId: string) => {
  try {
    return await apiFetchServer<ProductSummary>(`/api/products/${productId}`);
  } catch (error) {
    console.error('Ürün detayı yükleme hatası:', error);
    return null;
  }
};

export default async function ProductDetailPage({ params }: { params: any }) {
  const { productId } = await params;
  const product = await fetchProduct(productId);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Ürün Detayı</p>
          <h1 className="text-3xl font-semibold text-white">{product.name}</h1>
          <p className="text-sm text-slate-400">
            Ref Kod: <span className="font-mono text-slate-200">{product.referenceCode}</span>
          </p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center justify-center rounded-xl border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/70"
        >
          ← Ürün listesine dön
        </Link>
      </div>

      <ProductEditor product={product} />
    </div>
  );
}


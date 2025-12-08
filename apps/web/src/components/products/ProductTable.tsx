'use client';

import { PackageOpen } from 'lucide-react';
import { useState } from 'react';

import type { ProductSummary } from '@/types/api';

interface Props {
  products: ProductSummary[];
  hidePurchasePrice?: boolean;
}

export function ProductTable({ products, hidePurchasePrice }: Props) {
  const [selectedProduct, setSelectedProduct] = useState<ProductSummary | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-slate-800 shadow-2xl shadow-black/20">
        <table className="min-w-full divide-y divide-slate-800 bg-slate-900/30 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Ürün</th>
              <th className="px-4 py-3">Referans</th>
              <th className="px-4 py-3 text-right">Toplam Stok</th>
              {!hidePurchasePrice ? <th className="px-4 py-3 text-right">Alış</th> : null}
              <th className="px-4 py-3 text-right">Satış</th>
              <th className="px-4 py-3 text-right">Lot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-4">
                  <p className="font-medium text-white">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.category ?? 'Kategori Yok'}</p>
                </td>
                <td className="px-4 py-4 font-mono text-xs text-slate-400">{product.referenceCode}</td>
                <td className="px-4 py-4 text-right text-lg font-semibold text-cyan-300">
                  {product.onHandQuantity ?? product.totalQuantity ?? 0}
                  {product.customerQuantity ? (
                    <span className="block text-xs font-normal text-slate-400">
                      Müşteri: {product.customerQuantity}
                    </span>
                  ) : null}
                </td>
                {!hidePurchasePrice ? (
                  <td className="px-4 py-4 text-right text-sm text-slate-200">
                    {product.purchasePrice ? `${product.purchasePrice.toLocaleString('tr-TR')} ₺` : '—'}
                  </td>
                ) : null}
                <td className="px-4 py-4 text-right text-sm text-slate-200">
                  {product.salePrice ? `${product.salePrice.toLocaleString('tr-TR')} ₺` : '—'}
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(product)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-cyan-500 hover:text-cyan-300"
                  >
                    <PackageOpen className="size-4" />
                    Lot Detayı
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedProduct ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10 backdrop-blur">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950/95 p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm uppercase tracking-wider text-slate-400">Lot Detayı</p>
                <h3 className="text-2xl font-semibold text-white">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-500">{selectedProduct.referenceCode}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="rounded-full border border-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-400"
              >
                Kapat
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {selectedProduct.lots.map((lot) => (
                <div
                  key={lot.id}
                  className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">Lot {lot.lotNumber}</p>
                      <p className="text-xs text-slate-500">Barkod: {lot.barcode ?? '—'}</p>
                    </div>
                    <div className="text-right text-xs text-slate-300">
                      <p className="text-lg font-semibold text-cyan-300">
                        Depo {lot.onHandQuantity ?? lot.trackedQuantity ?? lot.quantity}
                      </p>
                      {lot.customerQuantity ? <p className="text-slate-400">Müşteri {lot.customerQuantity}</p> : null}
                    </div>
                  </div>
                  {lot.expiryDate ? (
                    <p className="text-xs text-amber-300">SKT: {new Date(lot.expiryDate).toLocaleDateString('tr-TR')}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

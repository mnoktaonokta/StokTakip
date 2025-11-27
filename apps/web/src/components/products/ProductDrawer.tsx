'use client';

import { X } from 'lucide-react';
import { useCallback } from 'react';

import { useApiQuery } from '@/hooks/useApi';
import { useStockManagerAccess } from '@/hooks/useStockManagerAccess';
import type { ProductSummary } from '@/types/api';
import { ProductEditor } from './ProductEditor';

interface ProductDrawerProps {
  productId: string | null;
  onClose: () => void;
  onUpdated: (product: ProductSummary) => void;
}

export function ProductDrawer({ productId, onClose, onUpdated }: ProductDrawerProps) {
  const isOpen = Boolean(productId);
  const { canEditStock, userId: currentUserId } = useStockManagerAccess();
  const { data, isLoading } = useApiQuery<ProductSummary>(
    ['product', productId ?? ''],
    `/api/products/${productId ?? ''}`,
    {
      enabled: isOpen && Boolean(productId),
    },
  );

  const handleSaved = useCallback(
    (product: ProductSummary) => {
      onUpdated(product);
      onClose();
    },
    [onClose, onUpdated],
  );

  if (!isOpen || !productId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-slate-800 p-2 text-slate-300 hover:bg-slate-800/70"
        >
          <X className="size-4" />
        </button>
        <div className="max-h-[90vh] overflow-y-auto p-6">
          {isLoading && (
            <div className="py-20 text-center text-slate-400">
              <p>Ürün bilgileri yükleniyor...</p>
            </div>
          )}
          {!isLoading && data ? (
            <ProductEditor
              product={data}
              onSaved={handleSaved}
              canEditStock={canEditStock}
              currentUserId={currentUserId}
            />
          ) : null}
          {!isLoading && !data ? (
            <div className="py-20 text-center text-red-400">
              Ürün bilgisi getirilemedi. Lütfen daha sonra tekrar deneyin.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


'use client';

import { X } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useApiQuery } from '@/hooks/useApi';
import { useStockManagerAccess } from '@/hooks/useStockManagerAccess';
import type { ProductSummary } from '@/types/api';
import { ProductEditor } from './ProductEditor';
import { LogModal } from '@/components/logs/LogModal';
import { useMemo } from 'react';

interface ProductDrawerProps {
  productId: string | null;
  onClose: () => void;
  onUpdated: (product: ProductSummary) => void;
}

export function ProductDrawer({ productId, onClose, onUpdated }: ProductDrawerProps) {
  const isOpen = Boolean(productId);
  const [showLogs, setShowLogs] = useState(false);
  const { canEditStock, userId: currentUserId, role } = useStockManagerAccess();
  const isAdmin = role === 'admin';
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

  const visibleProduct = useMemo(() => {
    if (!data) return null;
    if (isAdmin) return data;
    // Çalışanlar için alış fiyatını gizle
    return { ...data, purchasePrice: null };
  }, [data, isAdmin]);

  if (!isOpen || !productId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLogs(true)}
            className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800/70"
          >
            Loglar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-800 p-2 text-slate-300 hover:bg-slate-800/70"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[90vh] overflow-y-auto p-6">
          {isLoading && (
            <div className="py-20 text-center text-slate-400">
              <p>Ürün bilgileri yükleniyor...</p>
            </div>
          )}
          {!isLoading && visibleProduct ? (
            <ProductEditor
              product={visibleProduct}
              onSaved={handleSaved}
              canEditStock={canEditStock}
              currentUserId={currentUserId}
              hidePurchasePrice={!isAdmin}
            />
          ) : null}
          {!isLoading && !visibleProduct ? (
            <div className="py-20 text-center text-red-400">
              Ürün bilgisi getirilemedi. Lütfen daha sonra tekrar deneyin.
            </div>
          ) : null}
        </div>
      </div>
      {showLogs && productId && (
        <LogModal
          title="Ürün Logları"
          filter={{ productId }}
          onClose={() => setShowLogs(false)}
        />
      )}
    </div>
  );
}


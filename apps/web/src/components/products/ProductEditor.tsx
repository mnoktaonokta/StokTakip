'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { DEV_USER_ID } from '@/lib/api-client';
import { apiFetch } from '@/lib/api-client/client';
import type { Lot, ProductSummary } from '@/types/api';

interface ProductEditorProps {
  product: ProductSummary;
  onSaved?: (product: ProductSummary) => void;
  canEditStock?: boolean;
  currentUserId?: string;
  hidePurchasePrice?: boolean;
}

const formatExpiry = (value: Lot['expiryDate']) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return value;
  }
};

export function ProductEditor({
  product,
  onSaved,
  canEditStock = false,
  currentUserId,
  hidePurchasePrice = false,
}: ProductEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState({
    name: product.name,
    referenceCode: product.referenceCode,
    brand: product.brand ?? '',
    category: product.category ?? '',
    salePrice: product.salePrice?.toString() ?? '',
    criticalStockLevel: product.criticalStockLevel?.toString() ?? '',
    isActive: product.isActive,
  });
  const [isSaving, setIsSaving] = useState(false);
  const buildQuantityMap = (source: ProductSummary) =>
    Object.fromEntries(source.lots.map((lot) => [lot.id, lot.quantity.toString()]));
  const buildLotNumberMap = (source: ProductSummary) =>
    Object.fromEntries(source.lots.map((lot) => [lot.id, lot.lotNumber]));

  const [lotQuantityInputs, setLotQuantityInputs] = useState<Record<string, string>>(() => buildQuantityMap(product));
  const [lotNumberInputs, setLotNumberInputs] = useState<Record<string, string>>(() => buildLotNumberMap(product));
  const [lotSaving, setLotSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLotQuantityInputs(buildQuantityMap(product));
    setLotNumberInputs(buildLotNumberMap(product));
  }, [product.lots]);

  const dirty = useMemo(() => {
    return (
      formState.name !== product.name ||
      formState.referenceCode !== product.referenceCode ||
      formState.brand !== (product.brand ?? '') ||
      formState.category !== (product.category ?? '') ||
      formState.salePrice !== (product.salePrice?.toString() ?? '') ||
      formState.criticalStockLevel !== (product.criticalStockLevel?.toString() ?? '') ||
      formState.isActive !== product.isActive
    );
  }, [formState, product]);

  const handleChange =
    (field: keyof typeof formState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setFormState((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      const parseNumberInput = (value: string) => {
        if (!value) return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const salePrice = parseNumberInput(formState.salePrice);
      const criticalStockLevel = parseNumberInput(formState.criticalStockLevel);

      const body: Record<string, unknown> = {
        name: formState.name.trim(),
        referenceCode: formState.referenceCode.trim(),
        brand: formState.brand.trim() || null,
        category: formState.category.trim() || null,
        salePrice,
        criticalStockLevel,
        isActive: formState.isActive,
      };

      const updated = await apiFetch<ProductSummary>(`/api/products/${product.id}`, {
        method: 'PUT',
        body,
      });
      toast.success('Ürün bilgileri güncellendi');
      if (onSaved) {
        onSaved(updated);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error('Ürün güncelleme hatası:', error);
      toast.error(error instanceof Error ? error.message : 'Ürün güncellenemedi');
    } finally {
      setIsSaving(false);
    }
  };

  const lots = product.lots;
  const productOnHand = product.onHandQuantity ?? product.totalQuantity ?? 0;
  const productCustomerStock = product.customerQuantity ?? 0;

  const handleLotQuantityChange = (lotId: string, value: string) => {
    setLotQuantityInputs((prev) => ({ ...prev, [lotId]: value }));
  };

  const handleLotNumberChange = (lotId: string, value: string) => {
    setLotNumberInputs((prev) => ({ ...prev, [lotId]: value }));
  };

  const syncProductCaches = (updated: ProductSummary) => {
    queryClient.setQueryData<ProductSummary>(['product', updated.id], updated);
    queryClient.setQueryData<ProductSummary[]>(['products'], (previous) =>
      previous?.map((item) => (item.id === updated.id ? updated : item)) ?? previous,
    );
    queryClient.invalidateQueries({
      predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'products',
    });
  };

  const handleLotQuantitySave = async (lotId: string) => {
    const rawValue = lotQuantityInputs[lotId];
    const lotNumberValue = (lotNumberInputs[lotId] ?? '').trim();
    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      toast.error('Geçerli bir stok değeri girin');
      return;
    }

    if (!lotNumberValue) {
      toast.error('Lot numarası boş bırakılmaz');
      return;
    }

    setLotSaving((prev) => ({ ...prev, [lotId]: true }));
    try {
      const updated = await apiFetch<{ product: ProductSummary }>(`/api/lots/${lotId}`, {
        method: 'PATCH',
        headers: {
          'x-user-id': currentUserId ?? DEV_USER_ID,
        },
        body: {
          quantity: parsedValue,
          lotNumber: lotNumberValue,
        },
      });

      setLotQuantityInputs(buildQuantityMap(updated.product));
      setLotNumberInputs(buildLotNumberMap(updated.product));
      syncProductCaches(updated.product);
      toast.success('Lot stok bilgisi güncellendi');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lot stoğu güncellenemedi');
    } finally {
      setLotSaving((prev) => ({ ...prev, [lotId]: false }));
    }
  };

  const [newLot, setNewLot] = useState({
    lotNumber: '',
    quantity: '',
    barcode: '',
    expiryDate: '',
  });
  const [isCreatingLot, setIsCreatingLot] = useState(false);

  const handleNewLotChange = (field: keyof typeof newLot) => (event: ChangeEvent<HTMLInputElement>) => {
    setNewLot((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleNewLotSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreatingLot) return;

    const lotNumber = newLot.lotNumber.trim();
    const quantity = Number(newLot.quantity);

    if (!lotNumber) {
      toast.error('Lot numarası zorunlu');
      return;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error('Geçerli bir stok miktarı girin');
      return;
    }

    setIsCreatingLot(true);
    try {
      const created = await apiFetch<ProductSummary>(`/api/products/${product.id}/lots`, {
        method: 'POST',
        body: {
          lotNumber,
          quantity,
          barcode: newLot.barcode.trim() || undefined,
          expiryDate: newLot.expiryDate.trim() || undefined,
        },
      });
      syncProductCaches(created);
      setLotQuantityInputs(buildQuantityMap(created));
      setLotNumberInputs(buildLotNumberMap(created));
      setNewLot({
        lotNumber: '',
        quantity: '',
        barcode: '',
        expiryDate: '',
      });
      toast.success('Yeni lot eklendi');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Yeni lot eklenemedi');
    } finally {
      setIsCreatingLot(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-white">Ürün Bilgileri</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-300">
            Ürün Adı
            <input
              value={formState.name}
              onChange={handleChange('name')}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-white"
              required
            />
          </label>
          <label className="text-sm text-slate-300">
            Referans Kodu
            <input
              value={formState.referenceCode}
              onChange={handleChange('referenceCode')}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-white"
              required
            />
          </label>
        </div>
        <label className="text-sm text-slate-300">
          Kategori
          <input
            value={formState.category}
            onChange={handleChange('category')}
            className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-white"
            placeholder="Opsiyonel"
          />
        </label>
        <label className="text-sm text-slate-300">
          Marka
          <input
            value={formState.brand}
            onChange={handleChange('brand')}
            className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-white"
            placeholder="Örn. Macros"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-300">
            Satış Fiyatı (₺)
            <input
              type="number"
              min="0"
              step="0.01"
              value={formState.salePrice}
              onChange={handleChange('salePrice')}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-white"
            />
          </label>
          <div />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-300">
            Kritik Stok Seviyesi
            <input
              type="number"
              min={0}
              value={formState.criticalStockLevel}
              onChange={handleChange('criticalStockLevel')}
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-white"
              placeholder="opsiyonel"
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={formState.isActive}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  isActive: event.target.checked,
                }))
              }
              className="size-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-400"
            />
            Ürün aktif
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-800 pt-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Toplam Stok</p>
            <p className="text-2xl font-semibold text-white">{productOnHand} Adet</p>
            <p className="text-xs text-slate-400">
              Depo: {productOnHand} • Müşteri: {productCustomerStock}
            </p>
            {product.criticalStockLevel ? (
              <p className="text-xs text-slate-500">
                Kritik seviye: {product.criticalStockLevel} •{' '}
                {productOnHand < product.criticalStockLevel ? 'Altında' : 'Üstünde'}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={isSaving || !dirty}
            className="rounded-2xl bg-cyan-500/90 px-6 py-2 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Güncelleniyor...' : dirty ? 'Değişiklikleri Kaydet' : 'Güncel'}
          </button>
        </div>
      </form>

      <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Lotlar</h2>
          {canEditStock && lots.length > 0 && (
            <span className="text-xs uppercase tracking-widest text-emerald-400">Yetkili Stok Düzenleme</span>
          )}
        </div>
        {canEditStock && (
          <form onSubmit={handleNewLotSubmit} className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-widest text-emerald-300">Yeni Lot Ekle</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-slate-300">
                Lot Numarası
                <input
                  value={newLot.lotNumber}
                  onChange={handleNewLotChange('lotNumber')}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                Miktar
                <input
                  type="number"
                  min={0}
                  value={newLot.quantity}
                  onChange={handleNewLotChange('quantity')}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                  required
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-slate-300">
                Barkod (opsiyonel)
                <input
                  value={newLot.barcode}
                  onChange={handleNewLotChange('barcode')}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                />
              </label>
              <label className="flex flex-col gap-1 text-slate-300">
                SKT (YYYY-MM-DD)
                <input
                  type="date"
                  value={newLot.expiryDate}
                  onChange={handleNewLotChange('expiryDate')}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isCreatingLot}
              className="w-full rounded-xl bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreatingLot ? 'Ekleme yapılıyor...' : 'Lotu Ekle'}
            </button>
          </form>
        )}
        {lots.length === 0 ? (
          <p className="text-sm text-slate-500">Bu ürüne ait lot bilgisi bulunmuyor.</p>
        ) : (
          <div className="space-y-3">
            {lots.map((lot) => (
              <div key={lot.id} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm">
                <div className="flex items-center justify-between text-white">
                  <span className="font-mono text-xs">Lot {lot.lotNumber}</span>
                  <div className="text-right text-xs text-slate-300">
                    <p className="text-base font-semibold text-cyan-300">
                      Depo {lot.onHandQuantity ?? lot.trackedQuantity ?? lot.quantity}
                    </p>
                    {lot.customerQuantity ? <p className="text-slate-400">Müşteri {lot.customerQuantity}</p> : null}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  SKT: {formatExpiry(lot.expiryDate)} • Barkod: {lot.barcode ?? '—'}
                </div>
                {canEditStock ? (
                  <div className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-3 text-xs text-slate-300 sm:text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-slate-400">
                        Lot Numarası
                        <input
                          type="text"
                        value={lotNumberInputs[lot.id] ?? lot.lotNumber}
                        onChange={(event) => handleLotNumberChange(lot.id, event.target.value)}
                          className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 font-mono text-xs text-slate-300 sm:text-sm"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-slate-400">
                        Yeni Stok
                        <input
                          type="number"
                          min={0}
                        value={lotQuantityInputs[lot.id] ?? lot.quantity.toString()}
                          onChange={(event) => handleLotQuantityChange(lot.id, event.target.value)}
                          className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-white"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLotQuantitySave(lot.id)}
                      disabled={lotSaving[lot.id]}
                      className="w-full rounded-xl bg-amber-500/90 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                    >
                      {lotSaving[lot.id] ? 'Kaydediliyor...' : 'Stok Kaydet'}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


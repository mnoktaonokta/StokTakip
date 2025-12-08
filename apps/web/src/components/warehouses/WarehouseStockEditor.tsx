'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api-client/client';
import type { ProductSummary } from '@/types/api';

interface LookupLot {
  id: string;
  lotNumber: string;
  quantity: number;
  expiryDate: string | null;
  onHandQuantity?: number;
  customerQuantity?: number;
}

interface LookupResponse {
  product: {
    id: string;
    name: string;
    referenceCode: string;
    totalQuantity: number;
    onHandQuantity?: number;
    customerQuantity?: number;
  };
  lots: LookupLot[];
  autoSelectedLot: LookupLot | null;
  isBarcodeMatch: boolean;
}

interface WarehouseStockEditorProps {
  warehouseId: string;
  onUpdated: () => void;
}

const normalizeSearchTerm = (value: string) => value.toLocaleUpperCase('tr-TR');

export function WarehouseStockEditor({ warehouseId, onUpdated }: WarehouseStockEditorProps) {
  const [referenceCode, setReferenceCode] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResponse | null>(null);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isSaving, setSaving] = useState(false);
  const [isSearching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<Pick<ProductSummary, 'id' | 'name' | 'referenceCode' | 'totalQuantity' | 'onHandQuantity' | 'customerQuantity' | 'category'>>
  >([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleLookup = async (codeOverride?: string) => {
    const term = (codeOverride ?? referenceCode).trim();
    if (!term) {
      toast.error('Referans kodu girin');
      return;
    }
    try {
      setSearching(true);
      const normalized = normalizeSearchTerm(term);
      const result = await apiFetch<LookupResponse>(`/api/products/lookup?code=${encodeURIComponent(normalized)}`);
      setLookupResult(result);
      const initialLot = result.autoSelectedLot ?? result.lots[0];
      setSelectedLotId(initialLot?.id ?? '');
      if (!result.lots.length) {
        toast.error('Bu referans koduna ait lot bulunamadı');
      }
    } catch (error) {
      console.error(error);
      toast.error('Ürün bulunamadı');
      setLookupResult(null);
      setSelectedLotId('');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLotId || !quantity) {
      toast.error('Lot ve miktar zorunlu');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/warehouses/${warehouseId}/stock`, {
        method: 'POST',
        body: { lotId: selectedLotId, quantity: Number(quantity), mode: 'add' },
      });
      toast.success('Depo stoğu güncellendi');
      setQuantity('');
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Stok güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const term = referenceCode.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setIsSuggesting(true);
        const normalized = normalizeSearchTerm(term);
        const results = await apiFetch<ProductSummary[]>(`/api/products?search=${encodeURIComponent(normalized)}`);
        setSuggestions(
          results.slice(0, 8).map((product) => ({
            id: product.id,
            name: product.name,
            referenceCode: product.referenceCode,
            totalQuantity: product.totalQuantity,
            onHandQuantity: product.onHandQuantity,
            customerQuantity: product.customerQuantity,
            category: product.category,
          })),
        );
      } catch (error) {
        console.error('Ürün öneri hatası', error);
      } finally {
        setIsSuggesting(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [referenceCode]);

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3 text-xs text-slate-300">
      <p className="text-xs uppercase tracking-widest text-slate-500">Depo Stoku Güncelle</p>
      <label className="flex flex-col gap-1">
        Referans Kodu
        <input
          value={referenceCode}
          onChange={(event) => setReferenceCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleLookup();
            }
          }}
          placeholder="Ürün adı / referans / lot ara"
          className="flex-1 rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1 text-white"
        />
        {referenceCode.trim().length >= 2 && (isSuggesting || suggestions.length > 0) && (
          <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80">
            {isSuggesting && suggestions.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-slate-500">Aranıyor...</p>
            )}
            {suggestions.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  setReferenceCode(product.referenceCode);
                  setSuggestions([]);
                  handleLookup(product.referenceCode);
                }}
                className="flex w-full items-center justify-between border-b border-slate-800 px-3 py-2 text-left text-[11px] text-white hover:bg-slate-900/70"
              >
                <div>
                  <p className="font-semibold text-sm">{product.name}</p>
                  <p className="text-[10px] text-slate-400">{product.category ?? '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-300">{product.referenceCode}</p>
                  <p className="text-[10px] text-slate-500">
                    Depo {product.onHandQuantity ?? product.totalQuantity ?? 0} • Müşteri {product.customerQuantity ?? 0}
                  </p>
                </div>
              </button>
            ))}
            {!isSuggesting && suggestions.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-slate-500">Eşleşen ürün bulunamadı.</p>
            )}
          </div>
        )}
      </label>
      {lookupResult && (
        <div className="space-y-1 rounded-xl border border-slate-800/60 bg-slate-900/60 p-3 text-[11px] text-slate-300">
          <p className="text-sm font-semibold text-white">{lookupResult.product.name}</p>
          <p className="text-slate-400">Ref: {lookupResult.product.referenceCode}</p>
          <p className="text-slate-400">
            Depoda {lookupResult.product.onHandQuantity ?? lookupResult.product.totalQuantity} • Müşteride{' '}
            {lookupResult.product.customerQuantity ?? 0} adet
          </p>
        </div>
      )}
      {lookupResult && lookupResult.lots.length > 0 && (
        <label className="flex flex-col gap-1">
          Lot Seçimi
          <select
            value={selectedLotId}
            onChange={(event) => setSelectedLotId(event.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1 text-white"
          >
            {lookupResult.lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                  {lot.lotNumber} • Depo {lot.onHandQuantity ?? lot.quantity} adet
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1">
        Miktar
        <input
          type="number"
          min={0}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1 text-white"
        />
      </label>
      <button
        type="submit"
        disabled={isSaving || !selectedLotId}
        className="w-full rounded-lg bg-cyan-500/80 px-2 py-1 font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
      </button>
    </form>
  );
}




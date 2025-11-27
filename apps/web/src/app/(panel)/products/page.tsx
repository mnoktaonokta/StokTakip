'use client';

import { useCallback, useMemo, useState } from 'react';
import { UserButton } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Search } from 'lucide-react';

import { ProductDrawer } from '@/components/products/ProductDrawer';
import { useApiQuery } from '@/hooks/useApi';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { ProductSummary } from '@/types/api';

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 400);
  const [filters, setFilters] = useState({
    brand: '',
    reference: '',
    name: '',
    minStock: '',
    maxStock: '',
  });

  const normalize = (value: string) => value.toLocaleUpperCase('tr-TR');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', normalize(debouncedSearch));
    if (filters.brand) params.set('brand', normalize(filters.brand));
    if (filters.reference) params.set('reference', normalize(filters.reference));
    if (filters.name) params.set('name', normalize(filters.name));
    if (filters.minStock) params.set('minStock', filters.minStock);
    if (filters.maxStock) params.set('maxStock', filters.maxStock);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [debouncedSearch, filters]);

  const queryKey = useMemo(() => ['products', queryString], [queryString]);

  const { data, isLoading } = useApiQuery<ProductSummary[]>(queryKey, `/api/products${queryString}`);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const products = data ?? [];
  const productCount = products.length;
  const searchSuggestions = useMemo(() => {
    const term = normalize(searchTerm.trim());
    if (term.length < 2) return [];
    const seen = new Set<string>();
    const matches = products.filter((product) => {
      const referenceMatch = normalize(product.referenceCode).includes(term);
      const nameMatch = normalize(product.name).includes(term);
      const brandMatch = normalize(product.brand ?? '').includes(term);
      const categoryMatch = normalize(product.category ?? '').includes(term);
      return referenceMatch || nameMatch || brandMatch || categoryMatch;
    });
    return matches
      .filter((product) => {
        if (seen.has(product.id)) return false;
        seen.add(product.id);
        return true;
      })
      .slice(0, 8);
  }, [products, searchTerm]);

  const handleRowClick = (productId: string) => {
    setSelectedProductId(productId);
  };

  const handleCloseDrawer = () => setSelectedProductId(null);

  const handleProductUpdated = useCallback(
    (updated: ProductSummary) => {
      queryClient.setQueryData<ProductSummary[]>(['products'], (previous) =>
        previous?.map((product) => (product.id === updated.id ? { ...product, ...updated } : product)) ?? previous,
      );
      setSelectedProductId(null);
    },
    [queryClient],
  );

  const productRows = useMemo(() => {
    if (isLoading) {
      return <p className="p-6 text-center text-slate-400">Ürün listesi yükleniyor...</p>;
    }
    if (products.length === 0) {
      return <p className="p-6 text-center text-slate-500">Listede hiç ürün bulunamadı.</p>;
    }
    return products
      .filter((product) => product.isActive)
      .map((product) => {
        const isLowStock =
          product.criticalStockLevel !== null &&
          product.criticalStockLevel !== undefined &&
          product.totalQuantity < product.criticalStockLevel;

        return (
          <button
            key={product.id}
            type="button"
            onClick={() => handleRowClick(product.id)}
            className="grid w-full grid-cols-[2fr_3fr_4fr_2fr] items-center gap-2 p-4 text-left transition-colors hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
          >
            <span className="text-sm font-semibold text-slate-200">{product.brand ?? '—'}</span>
            <span className="font-mono text-sm text-slate-300">{product.referenceCode}</span>
            <div>
              <p className="font-medium text-white">{product.name}</p>
              <p className="text-xs text-slate-500">{product.category ?? '—'}</p>
            </div>
            <span className="flex items-center justify-end gap-2 text-right text-lg font-bold text-cyan-300">
              {product.totalQuantity} Adet
              {isLowStock ? <AlertTriangle className="size-4 text-amber-400" /> : null}
            </span>
          </button>
        );
      });
  }, [handleRowClick, isLoading, products]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <header className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-semibold text-cyan-400">Ürün Listesi ({productCount} ürün)</h1>
        <UserButton afterSignOutUrl="/sign-in" />
      </header>

      <div className="mb-6 space-y-3">
        <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-2">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Ürün adı, referans kodu veya kategori ara..."
            className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        {searchTerm.trim().length >= 2 && searchSuggestions.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/80">
            {searchSuggestions.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSearchTerm(product.referenceCode)}
                className="flex w-full items-center justify-between border-b border-slate-900 px-4 py-2 text-left text-xs text-white transition hover:bg-slate-900/50"
              >
                <div>
                  <p className="font-semibold text-sm">{product.name}</p>
                  <p className="text-[11px] text-slate-400">{product.category ?? 'Kategori yok'}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm text-slate-200">{product.referenceCode}</p>
                  <p className="text-[11px] text-slate-500">{product.totalQuantity} adet</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="grid grid-cols-[2fr_3fr_4fr_2fr] gap-4 border-b border-slate-800 px-4 py-3 text-xs text-slate-400 sm:text-sm">
          <div className="flex flex-col gap-1">
            <span className="font-medium uppercase tracking-wide">Marka</span>
            <input
              value={filters.brand}
              onChange={(event) => setFilters((prev) => ({ ...prev, brand: event.target.value }))}
              placeholder="Filtre"
              className="rounded-lg border border-slate-700 bg-slate-950/40 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-medium uppercase tracking-wide">Ürün Kodu</span>
            <input
              value={filters.reference}
              onChange={(event) => setFilters((prev) => ({ ...prev, reference: event.target.value }))}
              placeholder="Filtre"
              className="rounded-lg border border-slate-700 bg-slate-950/40 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-medium uppercase tracking-wide">Ürün Adı</span>
            <input
              value={filters.name}
              onChange={(event) => setFilters((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Filtre"
              className="rounded-lg border border-slate-700 bg-slate-950/40 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="font-medium uppercase tracking-wide">Toplam Stok</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                value={filters.minStock}
                onChange={(event) => setFilters((prev) => ({ ...prev, minStock: event.target.value }))}
                placeholder="Min"
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
              <input
                type="number"
                min={0}
                value={filters.maxStock}
                onChange={(event) => setFilters((prev) => ({ ...prev, maxStock: event.target.value }))}
                placeholder="Max"
                className="rounded-lg border border-slate-700 bg-slate-950/40 px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
        {productRows}
      </div>

      <ProductDrawer
        productId={selectedProductId}
        onClose={handleCloseDrawer}
        onUpdated={handleProductUpdated}
      />
    </div>
  );
}
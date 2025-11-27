'use client'; // <--- BU SATIR ÇOK ÖNEMLİ (Etkileşim için şart)

import { UserButton } from '@clerk/nextjs';
import { apiFetch } from '@/lib/api-client/client';
import { WarehouseForm } from '@/components/warehouses/WarehouseForm';
import { WarehouseStockEditor } from '@/components/warehouses/WarehouseStockEditor';
import type { WarehouseWithStock } from '@/types/api';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function WarehousesPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<WarehouseWithStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseWithStock | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<WarehouseWithStock['type']>('MAIN');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [removingStockId, setRemovingStockId] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<Record<string, { checked: boolean; quantity: number }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredWarehouses, setFilteredWarehouses] = useState<WarehouseWithStock[]>([]);
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        maximumFractionDigits: 2,
      }),
    [],
  );

  const stockSummary = useMemo(() => {
    if (!selectedWarehouse) {
      return { totalItems: 0, totalValue: 0 };
    }
    return selectedWarehouse.stockLocations.reduce(
      (acc, location) => {
        acc.totalItems += location.quantity;
        acc.totalValue += location.quantity * (location.lot.product.salePrice ?? 0);
        return acc;
      },
      { totalItems: 0, totalValue: 0 },
    );
  }, [selectedWarehouse]);

  const loadWarehouses = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<WarehouseWithStock[]>('/api/warehouses');
      setWarehouses(data);
      setSelectedWarehouse((current) => {
        if (!current) return current;
        return data.find((warehouse) => warehouse.id === current.id) ?? current;
      });
      setFilteredWarehouses(data);
    } catch (err: any) {
      console.error('Depo listesi hatası:', err);
      setError('Depo listesi yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Verileri Çek (Client Side Fetching)
  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  useEffect(() => {
    if (selectedWarehouse) {
      setEditName(selectedWarehouse.name);
      setEditType(selectedWarehouse.type);
    } else {
      setEditName('');
      setEditType('MAIN');
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredWarehouses(warehouses);
      return;
    }
    const normalized = searchTerm.trim().toLowerCase();
    setFilteredWarehouses(
      warehouses.filter(
        (warehouse) =>
          warehouse.name.toLowerCase().includes(normalized) ||
          warehouse.id.toLowerCase().includes(normalized) ||
          warehouse.type.toLowerCase().includes(normalized),
      ),
    );
  }, [warehouses, searchTerm]);

  const handleWarehouseUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedWarehouse) return;
    setIsUpdating(true);
    try {
      const updated = await apiFetch<WarehouseWithStock>(`/api/warehouses/${selectedWarehouse.id}`, {
        method: 'PATCH',
        body: {
          name: editName.trim(),
          type: editType,
        } satisfies Record<string, unknown>,
      });
      setWarehouses((prev) => prev.map((warehouse) => (warehouse.id === updated.id ? updated : warehouse)));
      setSelectedWarehouse(updated);
      toast.success('Depo bilgileri güncellendi');
    } catch (err: any) {
      toast.error(err?.message ?? 'Depo güncellenemedi');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleWarehouseDelete = async () => {
    if (!selectedWarehouse) return;
    const confirmDelete = window.confirm(
      'Bu depoyu silmek istediğinizden emin misiniz? Depoya bağlı müşterilerin bağlantıları kaldırılacak.',
    );
    if (!confirmDelete) return;
    try {
      setIsDeleting(true);
      await apiFetch(`/api/warehouses/${selectedWarehouse.id}`, {
        method: 'DELETE',
      });
      toast.success('Depo silindi');
      setSelectedWarehouse(null);
      loadWarehouses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Depo silinemedi');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStockDelete = async (stockLocationId: string) => {
    if (!selectedWarehouse) return;
    const confirmDelete = window.confirm('Bu stok satırını silmek istediğine emin misin?');
    if (!confirmDelete) return;
    try {
      setRemovingStockId(stockLocationId);
      await apiFetch(`/api/warehouses/${selectedWarehouse.id}/stock/${stockLocationId}`, {
        method: 'DELETE',
      });
      toast.success('Stok satırı silindi');
      loadWarehouses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Stok satırı silinemedi');
    } finally {
      setRemovingStockId(null);
    }
  };

  useEffect(() => {
    if (!selectedWarehouse) {
      setSelectedStock({});
      return;
    }
    const initial: Record<string, { checked: boolean; quantity: number }> = {};
    selectedWarehouse.stockLocations.forEach((location) => {
      initial[location.id] = { checked: false, quantity: location.quantity };
    });
    setSelectedStock(initial);
  }, [selectedWarehouse]);

  const handleToggleStock = (locationId: string, checked: boolean) => {
    setSelectedStock((prev) => ({
      ...prev,
      [locationId]: {
        quantity: prev[locationId]?.quantity ?? 1,
        checked,
      },
    }));
  };

  const allSelectableIds = selectedWarehouse?.stockLocations.map((location) => location.id) ?? [];
  const selectedCount = allSelectableIds.filter((id) => selectedStock[id]?.checked).length;
  const allSelected = selectedCount > 0 && selectedCount === allSelectableIds.length;

  const handleSelectAll = (checked: boolean) => {
    if (!selectedWarehouse) return;
    setSelectedStock((prev) => {
      const nextState = { ...prev };
      selectedWarehouse.stockLocations.forEach((location) => {
        const defaultQuantity = nextState[location.id]?.quantity ?? (location.quantity > 0 ? 1 : 0);
        nextState[location.id] = { checked, quantity: defaultQuantity };
      });
      return nextState;
    });
  };

  const handleInvoiceSelected = () => {
    if (!selectedWarehouse) return;
    const associatedCustomer = selectedWarehouse.customers?.[0];
    if (!associatedCustomer) {
      toast.error('Bu depo bir müşteriye bağlı değil.');
      return;
    }

    const selectedItems = selectedWarehouse.stockLocations
      .filter((location) => selectedStock[location.id]?.checked)
      .map((location) => {
        const desired = selectedStock[location.id]?.quantity ?? location.quantity;
        const quantity = location.quantity > 0 ? location.quantity : desired;
        return {
          stockLocationId: location.id,
          warehouseId: selectedWarehouse.id,
          productId: location.lot.product.id,
          lotId: location.lot.id,
          lotNumber: location.lot.lotNumber,
          description: location.lot.product.name,
          referenceCode: location.lot.product.referenceCode,
          quantity,
          unitPrice: Number(location.lot.product.salePrice ?? 0),
          vatRate: location.lot.product.vatRate ?? 10,
          category: location.lot.product.category ?? undefined,
        };
      })
      .filter((item) => item.quantity > 0);

    if (selectedItems.length === 0) {
      toast.error('Faturalamak için ürün seçmelisiniz.');
      return;
    }

    const draft = {
      customerId: associatedCustomer.id,
      customerName: associatedCustomer.name,
      warehouseId: selectedWarehouse.id,
      items: selectedItems,
    };

    sessionStorage.setItem('invoiceDraft', JSON.stringify(draft));
    toast.success('Seçilen ürünler fatura taslağına eklendi.');
    setSelectedWarehouse(null);
    router.push(`/invoices?mode=builder&customerId=${associatedCustomer.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      
      {/* ÜST BAŞLIK */}
      <header className="flex justify-between items-center pb-4 mb-6 border-b border-slate-800">
        <div>
            <p className="text-sm uppercase tracking-widest text-slate-500 mb-1">Yönetim</p>
            <h1 className="text-3xl font-semibold text-cyan-400">Depo & Lokasyonlar</h1>
        </div>
        <div className="flex items-center gap-4">
            <button 
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-cyan-900/20"
                onClick={() => setIsFormOpen(true)}
            >
                + Yeni Depo Ekle
            </button>
            <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>

      {/* Yeni Depo Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Depo Yönetimi</p>
                <h2 className="text-xl font-semibold text-white">Yeni Depo Oluştur</h2>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="rounded-full border border-slate-700 px-2 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Kapat
              </button>
            </div>
                <WarehouseForm
                  onCreated={() => {
                    setIsFormOpen(false);
                    loadWarehouses();
                  }}
                />
          </div>
        </div>
      )}

      {/* Depo Yönetim Modal */}
      {selectedWarehouse && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Depo Yönetimi</p>
                <h2 className="text-2xl font-semibold text-white">{selectedWarehouse.name}</h2>
                <p className="text-sm text-slate-400">
                  Tip: <span className="font-mono text-slate-200">{selectedWarehouse.type}</span>
                </p>
                <p className="text-xs text-slate-500">
                  ID: <span className="font-mono">{selectedWarehouse.id}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedWarehouse(null)}
                className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Kapat
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-4 md:grid-cols-2">
                <form
                  onSubmit={handleWarehouseUpdate}
                  className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4"
                >
                  <h3 className="text-lg font-semibold text-white">Depo Bilgileri</h3>
                  <label className="text-sm text-slate-300">
                    Depo adı
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
                      required
                    />
                  </label>
                  <label className="text-sm text-slate-300">
                    Depo tipi
                    <select
                      value={editType}
                      onChange={(event) => setEditType(event.target.value as WarehouseWithStock['type'])}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
                    >
                      <option value="MAIN">Ana depo</option>
                      <option value="CUSTOMER">Müşteri</option>
                      <option value="EMPLOYEE">Çalışan</option>
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={isUpdating || !editName.trim()}
                    className="w-full rounded-xl bg-emerald-500/80 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUpdating ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                  </button>
                </form>

                <WarehouseStockEditor
                  warehouseId={selectedWarehouse.id}
                  onUpdated={() => {
                    loadWarehouses();
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleWarehouseDelete}
                disabled={isDeleting}
                className="w-full rounded-2xl border border-rose-500/40 bg-rose-600/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Depo siliniyor...' : 'Depoyu Sil'}
              </button>

              <div className="space-y-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Depo Stoğu</h3>
                    <p className="text-xs text-slate-400">
                      {stockSummary.totalItems} adet • {currencyFormatter.format(stockSummary.totalValue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Tahmini değer</p>
                    <p className="text-xl font-semibold text-emerald-300">
                      {currencyFormatter.format(stockSummary.totalValue)}
                    </p>
                  </div>
                </div>

                {selectedWarehouse.stockLocations.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-500">
                    Bu depoda henüz stok bulunmuyor.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                      <div />
                      <button
                        type="button"
                        onClick={handleInvoiceSelected}
                        disabled={selectedCount === 0 || !selectedWarehouse.customers?.length}
                        className="rounded-2xl border border-emerald-400/40 bg-emerald-500/80 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {selectedCount > 0 ? `Fatura Et (${selectedCount})` : 'Fatura Et'}
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-800/60">
                      <table className="min-w-full text-sm text-slate-300">
                        <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-2 text-left">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  onChange={(event) => handleSelectAll(event.target.checked)}
                                />
                                Ürün
                              </label>
                            </th>
                            <th className="px-2 py-2 text-center" />
                            <th className="px-4 py-2 text-right">Stoktaki Adet</th>
                            <th className="px-4 py-2 text-right">Birim Fiyat</th>
                            <th className="px-4 py-2 text-right">Toplam</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedWarehouse.stockLocations
                            .slice()
                            .sort((a, b) => b.quantity - a.quantity)
                            .map((location) => {
                              const unitPrice = Number(location.lot.product.salePrice ?? 0);
                              const totalValue = unitPrice * location.quantity;
                              const selection = selectedStock[location.id];
                              return (
                                <tr key={location.id} className="border-t border-slate-800/60">
                                  <td className="px-4 py-3">
                                    <div className="flex items-start gap-3">
                                      <input
                                        type="checkbox"
                                        checked={selection?.checked ?? false}
                                        onChange={(event) => handleToggleStock(location.id, event.target.checked)}
                                      />
                                      <div>
                                        <p className="font-medium text-white">{location.lot.product.name}</p>
                                        <p className="text-xs text-slate-500">
                                          Lot {location.lot.lotNumber} • Ref {location.lot.product.referenceCode}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleStockDelete(location.id)}
                                      disabled={removingStockId === location.id}
                                      className="rounded-full border border-rose-500/40 bg-rose-600/80 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {removingStockId === location.id ? 'Siliniyor...' : '×'}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-right text-cyan-300">{location.quantity}</td>
                                  <td className="px-4 py-3 text-right text-cyan-300">{location.quantity}</td>
                                  <td className="px-4 py-3 text-right">
                                    {unitPrice > 0 ? currencyFormatter.format(unitPrice) : '—'}
                                  </td>
                                  <td className="px-4 py-3 text-right font-semibold text-emerald-300">
                                    {currencyFormatter.format(totalValue)}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Depo adı, ID veya tip ara..."
          className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-white placeholder:text-slate-500"
        />
      </div>

      {/* HATA MESAJI */}
      {error && (
        <div className="bg-rose-900/20 text-rose-300 p-4 rounded-xl border border-rose-800 mb-6">
          {error}
        </div>
      )}

      {/* YÜKLENİYOR DURUMU */}
      {isLoading && (
        <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      )}

      {/* DEPO LİSTESİ */}
      {!isLoading && !error && (
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70">
          <div className="hidden grid-cols-12 gap-4 border-b border-slate-800 bg-slate-950 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-400 md:grid">
            <span className="col-span-4">Depo Adı</span>
            <span className="col-span-2 text-center">Tip</span>
            <span className="col-span-3 text-right">Stok Adedi</span>
            <span className="col-span-3 text-right">Tahmini Değer</span>
          </div>

          <div className="divide-y divide-slate-800">
            {filteredWarehouses.map((warehouse) => {
              const totalQuantity = warehouse.stockLocations.reduce((sum, loc) => sum + loc.quantity, 0);
              const totalValue = warehouse.stockLocations.reduce(
                (sum, loc) => sum + loc.quantity * (loc.lot.product.salePrice ?? 0),
                0,
              );

              return (
                <button
                  key={warehouse.id}
                  onClick={() => setSelectedWarehouse(warehouse)}
                  className="w-full flex flex-col gap-3 px-4 py-4 text-left transition hover:bg-slate-900/40 md:grid md:grid-cols-12 md:items-center md:gap-4"
                >
                  <div className="col-span-4">
                    <p className="text-base font-semibold text-white">{warehouse.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{warehouse.id.slice(0, 10)}...</p>
                  </div>
                  <div className="col-span-2 text-center text-xs uppercase tracking-widest text-slate-400">
                    {warehouse.type}
                  </div>
                  <div className="col-span-3 text-right text-sm font-semibold text-cyan-300">
                    {totalQuantity} adet
                  </div>
                  <div className="col-span-3 text-right text-sm font-semibold text-emerald-300">
                    {currencyFormatter.format(totalValue)}
                  </div>
                </button>
              );
            })}

            {warehouses.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">Henüz sisteme kayıtlı depo bulunmuyor.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
'use client';

import { Layers, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api-client/client';
import { WarehouseStockEditor } from './WarehouseStockEditor';
import type { WarehouseWithStock } from '@/types/api';

interface WarehouseCardProps {
  warehouse: WarehouseWithStock;
  onDeleted: (warehouseId: string) => void;
  onStockUpdated: (warehouseId: string) => void;
}

export function WarehouseCard({ warehouse, onDeleted, onStockUpdated }: WarehouseCardProps) {
  const [isDeleting, setDeleting] = useState(false);
  const [isStockOpen, setStockOpen] = useState(false);
  const [isRefreshing, setRefreshing] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`${warehouse.name} deposunu silmek istediğinize emin misiniz?`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/warehouses/${warehouse.id}`, {
        method: 'DELETE',
      });
      toast.success('Depo silindi');
      onDeleted(warehouse.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Depo silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  const refreshWarehouse = async () => {
    setRefreshing(true);
    try {
      await onStockUpdated(warehouse.id);
      toast.success('Depo stoğu yenilendi');
    } finally {
      setRefreshing(false);
    }
  };

  const total = warehouse.stockLocations.reduce((sum, loc) => sum + loc.quantity, 0);
  const uniqueLots = new Set(warehouse.stockLocations.map((loc) => loc.lotId)).size;

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">{warehouse.type}</p>
          <h3 className="text-xl font-semibold text-white">{warehouse.name}</h3>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-cyan-300">{total}</p>
          <p className="text-xs text-slate-500">adet stok</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-400 transition hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed"
      >
        <Trash2 className="size-3" />
        {isDeleting ? 'Siliniyor...' : 'Depoyu Sil'}
      </button>
      <button
        type="button"
        onClick={() => setStockOpen((prev) => !prev)}
        className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300"
      >
        <Layers className="size-3" />
        {isStockOpen ? 'Stok Formunu Gizle' : 'Stok Formunu Aç'}
      </button>

      <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-200">
        <p className="text-xs uppercase tracking-widest text-slate-500">İlk Lotlar</p>
        <ul className="mt-2 space-y-2">
          {warehouse.stockLocations.slice(0, 4).map((location) => (
            <li key={location.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">{location.lot.product.name}</p>
                <p className="text-xs text-slate-500">
                  Lot {location.lot.lotNumber} • Barkod {location.lot.barcode ?? '—'}
                </p>
              </div>
              <span className="text-sm font-semibold text-cyan-300">{location.quantity} adet</span>
            </li>
          ))}
        </ul>
        {warehouse.stockLocations.length > 4 ? (
          <p className="mt-2 text-xs text-slate-500">
            +{warehouse.stockLocations.length - 4} lot daha
          </p>
        ) : null}
      </div>

      {isStockOpen ? (
        <div className="mt-4 space-y-2">
          <WarehouseStockEditor
            warehouseId={warehouse.id}
            onUpdated={async () => {
              await refreshWarehouse();
              setStockOpen(false);
            }}
          />
          <button
            type="button"
            onClick={refreshWarehouse}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300 disabled:cursor-not-allowed"
          >
            {isRefreshing ? <Loader2 className="size-3 animate-spin" /> : null}
            Stoğu Yenile
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex gap-4 text-xs text-slate-400">
        <span>Lot Sayısı: {uniqueLots}</span>
        <span>Toplam Satır: {warehouse.stockLocations.length}</span>
      </div>
    </div>
  );
}


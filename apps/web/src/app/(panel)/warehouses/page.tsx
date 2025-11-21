import { apiFetch } from '@/lib/api-client';
import type { WarehouseWithStock } from '@/types/api';

const getWarehouseStats = (warehouse: WarehouseWithStock) => {
  const total = warehouse.stockLocations.reduce((sum, loc) => sum + loc.quantity, 0);
  const uniqueLots = new Set(warehouse.stockLocations.map((loc) => loc.lotId)).size;
  return { total, uniqueLots };
};

export default async function WarehousesPage() {
  const warehouses = await apiFetch<WarehouseWithStock[]>('/api/warehouses');

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-slate-500">Depolar</p>
        <h1 className="text-3xl font-semibold text-white">Depo & Müşteri Stok Lokasyonları</h1>
        <p className="text-sm text-slate-400">
          Ana depo, doktor depoları ve çalışan kitleri arasında lot bazlı stok akışını yönetin.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {warehouses.map((warehouse) => {
          const stats = getWarehouseStats(warehouse);
          return (
            <div key={warehouse.id} className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-500">{warehouse.type}</p>
                  <h3 className="text-xl font-semibold text-white">{warehouse.name}</h3>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-cyan-300">{stats.total}</p>
                  <p className="text-xs text-slate-500">adet stok</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-widest text-slate-500">Lot Dağılımı</p>
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

              <div className="mt-4 flex gap-4 text-xs text-slate-400">
                <span>Lot Sayısı: {stats.uniqueLots}</span>
                <span>Toplam Satır: {warehouse.stockLocations.length}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

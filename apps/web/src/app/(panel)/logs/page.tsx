import { LogViewer } from '@/components/logs/LogViewer';

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-slate-500"> Log Kütüphanesi</p>
        <h1 className="text-3xl font-semibold text-white">Tüm Hareketlerin Audit Trail Kaydı</h1>
        <p className="text-sm text-slate-400">
          Kullanıcı, müşteri, ürün, depo bazlı filtrelerle tüm hareketleri anlık izleyin.
        </p>
      </div>
      <LogViewer />
    </div>
  );
}

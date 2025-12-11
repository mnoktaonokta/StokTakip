'use client';

import { X } from 'lucide-react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api-client/client';
import type { ActivityLog } from '@/types/api';

interface LogModalProps {
  title: string;
  filter?: {
    customerId?: string;
    productId?: string;
    warehouseId?: string;
    userId?: string;
    actionType?: string;
  };
  actionPrefix?: string;
  onClose: () => void;
}

export function LogModal({ title, filter, actionPrefix, onClose }: LogModalProps) {
  const query = useMemo(() => {
    const params: Record<string, string> = {};
    if (filter?.customerId) params.customerId = filter.customerId;
    if (filter?.productId) params.productId = filter.productId;
    if (filter?.warehouseId) params.warehouseId = filter.warehouseId;
    if (filter?.userId) params.userId = filter.userId;
    if (filter?.actionType) params.actionType = filter.actionType;
    return params;
  }, [filter]);

  const { data, isLoading } = useQuery({
    queryKey: ['log-modal', query],
    queryFn: () => apiFetch<ActivityLog[]>('/api/logs', { query }),
  });

  const logs = useMemo(() => {
    if (!data) return [];
    if (!actionPrefix) return data;
    return data.filter((log) => log.actionType.startsWith(actionPrefix));
  }, [data, actionPrefix]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Log Kayıtları</p>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800/70"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <p className="p-6 text-center text-sm text-slate-400">Loglar yükleniyor...</p>
          ) : logs.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">Henüz kayıt bulunamadı.</p>
          ) : (
            <ul className="divide-y divide-slate-800 text-sm text-slate-200">
              {logs.map((log) => (
                <li key={log.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{log.description}</p>
                      <p className="text-xs text-slate-500">
                        {log.actionType}
                        {log.user?.name ? ` • ${log.user.name}` : ''}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString('tr-TR')}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}



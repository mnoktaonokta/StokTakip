'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { apiFetch } from '@/lib/api-client';
import type { ActivityLog } from '@/types/api';

const actionTypes = [
  'STOCK_IN',
  'STOCK_OUT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'TRANSFER_REVERSE',
  'INVOICE_CREATED',
  'CSV_IMPORT',
  'MANUAL_ADJUSTMENT',
];

export function LogViewer() {
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState<string>();

  const query = useMemo(
    () => ({
      actionType: actionType || undefined,
    }),
    [actionType],
  );

  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs', actionType],
    queryFn: () => apiFetch<ActivityLog[]>('/api/logs', { query }),
  });

  const filteredLogs = logs?.filter((log) => log.description.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ürün, müşteri veya açıklama ara"
          className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white"
        />
        <select
          value={actionType ?? ''}
          onChange={(event) => setActionType(event.target.value || undefined)}
          className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white"
        >
          <option value="">Tümü</option>
          {actionTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/40">
        {isLoading ? (
          <p className="p-6 text-center text-sm text-slate-400">Loglar yükleniyor...</p>
        ) : (
          <ul className="divide-y divide-slate-800 text-sm text-slate-200">
            {filteredLogs?.map((log) => (
              <li key={log.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{log.description}</p>
                    <p className="text-xs text-slate-500">{log.actionType}</p>
                  </div>
                  <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString('tr-TR')}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

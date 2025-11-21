'use client';

import { ChangeEvent, useState } from 'react';
import { toast } from 'sonner';

export function CsvUploader() {
  const [warehouseId, setWarehouseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setUploading] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    setFile(selected ?? null);
  };

  const handleSubmit = async () => {
    if (!file || !warehouseId) {
      toast.error('Depo seçin ve CSV ekleyin');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('warehouseId', warehouseId);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/csv/upload`, {
        method: 'POST',
        headers: {
          'x-user-role': 'admin',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast.success('CSV başarıyla yüklendi');
      setFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'CSV yüklenemedi');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-slate-300">
          Depo ID
          <input
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-white"
          />
        </label>
        <label className="text-sm text-slate-300">
          CSV Dosyası
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="mt-1 w-full rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-white"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isUploading}
        className="rounded-2xl bg-cyan-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:opacity-50"
      >
        {isUploading ? 'Yükleniyor...' : 'CSV Yükle'}
      </button>
    </div>
  );
}

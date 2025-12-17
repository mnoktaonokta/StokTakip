'use client';

import { ChangeEvent, useState } from 'react';
import { toast } from 'sonner';

import { API_URL, DEV_USER_ID } from '@/lib/api-client';
import { apiFetch } from '@/lib/api-client/client';
import type { ProductSummary } from '@/types/api';

export function CsvUploader() {
  const [warehouseId, setWarehouseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setUploading] = useState(false);
  const [isExporting, setExporting] = useState(false);

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

      const response = await fetch(`${API_URL}/api/csv/upload`, {
        method: 'POST',
        headers: {
          'x-user-role': 'admin',
          'x-user-id': DEV_USER_ID,
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

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Marka',
      'Ürün Adı',
      'Ürün Kodu',
      'Kategori',
      'Satış Fiyatı',
      'Alış Fiyatı',
      'Kritik Stok',
      'Barkod',
      'Lot Numarası',
      'Stok Adedi',
    ];
    const exampleRow = [
      'DentPlus',
      'İmplant Vida 4.0 x 10mm',
      'DP-IM410',
      'Implant',
      '1500',
      '900',
      '5',
      '8690000000012',
      'LOT-2025-001',
      '25',
    ];
    const csv = [headers.join(','), exampleRow.join(',')].join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'urun_sablonu.csv');
    toast.info('Örnek satır içeren şablon indirildi.');
  };

  const handleDownloadProducts = async () => {
    try {
      setExporting(true);
      const products = await apiFetch<ProductSummary[]>('/api/products?includeInactive=true');
      const headers = [
        'Marka',
        'Ürün Adı',
        'Ürün Kodu',
        'Kategori',
        'Satış Fiyatı',
        'Alış Fiyatı',
        'Kritik Stok',
        'Toplam Stok',
        'Barkodlar',
      ];
      const rows = products.map((product) => [
        product.brand ?? '',
        product.name,
        product.referenceCode,
        product.category ?? '',
        (product as any).salePrice ?? '',
        product.criticalStockLevel ?? '',
        product.totalQuantity ?? '',
        product.lots.map((lot) => `${lot.barcode ?? ''}/${lot.lotNumber}`).join(' | '),
      ]);
      const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'urun_listesi.csv');
      toast.success('Ürün listesi indirildi.');
    } catch (error) {
      console.error('Ürün listesi indirme hatası:', error);
      toast.error('Ürün listesi indirilemedi.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/70"
        >
          Örnek Şablonu İndirin
        </button>
        <button
          type="button"
          onClick={handleDownloadProducts}
          disabled={isExporting}
          className="rounded-2xl border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {isExporting ? 'İndiriliyor...' : 'Ürün Listesini İndir'}
        </button>
      </div>
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

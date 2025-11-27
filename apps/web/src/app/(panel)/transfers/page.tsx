// apps/web/src/app/(panel)/transfers/page.tsx

'use client'; // <-- SAYFAYI İNTERAKTİF HALE GETİRİYORUZ

import { UserButton } from '@clerk/nextjs';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { API_URL, DEV_USER_ID } from '@/lib/api-client';
import { apiFetch } from '@/lib/api-client/client';

// --- TİP TANIMLARI ---
type Warehouse = { id: string; name: string; type: string; };
type Lot = { id: string; lotNumber: string; quantity: number; barcode: string | null; expiryDate: string | null; };
type LotWithAvailability = Lot & { warehouseQuantity: number };
type WarehouseStockLocation = {
  id: string;
  warehouseId: string;
  lotId: string;
  quantity: number;
  lot: {
    id: string;
    lotNumber: string;
    productId: string;
    barcode: string | null;
    expiryDate: string | null;
  };
};

// Backend'den gelecek yanıtın tipi
type LookupResponse = {
  product: { id: string; name: string; referenceCode: string; totalQuantity: number; };
  lots: Lot[];
  autoSelectedLot: Lot | null;
  isBarcodeMatch: boolean;
};

export default function TransferPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fromWarehouseId, setFromWarehouseId] = useState<string>();
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedLotId, setSelectedLotId] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [excelWarehouseId, setExcelWarehouseId] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isExcelUploading, setIsExcelUploading] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStockLocation[]>([]);
  const [isStockLoading, setIsStockLoading] = useState(false);

  const fetchWarehouseStock = useCallback(
    async (warehouseId?: string) => {
      if (!warehouseId) {
        setWarehouseStock([]);
        return;
      }
      setIsStockLoading(true);
      try {
        const data = await apiFetch<WarehouseStockLocation[]>(`/api/warehouses/${warehouseId}/stock`);
        setWarehouseStock(data);
      } catch (error) {
        console.error('Depo stok bilgisi alınamadı:', error);
        setWarehouseStock([]);
      } finally {
        setIsStockLoading(false);
      }
    },
    [],
  );

  // 1. DEPODAN VERİ ÇEKME (Client Side useEffect ile)
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const data = await apiFetch<Warehouse[]>('/api/warehouses');
        setWarehouses(data);
      } catch (error) {
        console.error("Depo listesi çekilemedi:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchWarehouses();
  }, []);

  useEffect(() => {
    fetchWarehouseStock(fromWarehouseId);
  }, [fetchWarehouseStock, fromWarehouseId]);

  // 2. ARAMA İŞLEMİ (ENTER tuşuna basınca çalışır)
  const handleSearch = async () => {
    if (!searchTerm) return;
    try {
      const result = await apiFetch<LookupResponse>(`/api/products/lookup?code=${searchTerm}`);
      setLookupResult(result);
    } catch (error) {
      console.error('Ürün arama hatası:', error);
      toast.error('Ürün bulunamadı veya API hatası oluştu');
      setLookupResult(null);
    }
  };

  const mainWarehouse = warehouses.find((w) => w.type === 'MAIN');
  const mainWarehouseId = mainWarehouse?.id ?? '';
  const destinationWarehouses = warehouses.filter((w) => w.id !== fromWarehouseId);
  const lotQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    warehouseStock.forEach((item) => {
      map.set(item.lotId, item.quantity);
    });
    return map;
  }, [warehouseStock]);

  const availableLots: LotWithAvailability[] = useMemo(() => {
    if (!lookupResult) {
      return [];
    }

    return (lookupResult.lots ?? [])
      .map((lot) => ({
        ...lot,
        warehouseQuantity: lotQuantityMap.get(lot.id) ?? 0,
      }))
      .filter((lot) => lot.warehouseQuantity > 0);
  }, [lookupResult, lotQuantityMap]);

  useEffect(() => {
    if (mainWarehouseId && !fromWarehouseId) {
      setFromWarehouseId(mainWarehouseId);
    }
  }, [fromWarehouseId, mainWarehouseId]);

  useEffect(() => {
    if (!excelWarehouseId && fromWarehouseId) {
      setExcelWarehouseId(fromWarehouseId);
    }
  }, [excelWarehouseId, fromWarehouseId]);

  useEffect(() => {
    if (!lookupResult) {
      setSelectedLotId(undefined);
      return;
    }

    if (selectedLotId && availableLots.some((lot) => lot.id === selectedLotId)) {
      return;
    }

    const defaultLotId = availableLots[0]?.id;
    setSelectedLotId(defaultLotId);
  }, [lookupResult, availableLots, selectedLotId]);

  const selectedLot = useMemo(() => {
    return availableLots.find((lot) => lot.id === selectedLotId) ?? null;
  }, [availableLots, selectedLotId]);

  useEffect(() => {
    if (!selectedLot) {
      setQuantity(1);
      return;
    }

    setQuantity((prev) => {
      if (prev > selectedLot.warehouseQuantity) {
        return selectedLot.warehouseQuantity;
      }
      if (prev <= 0) {
        return 1;
      }
      return prev;
    });
  }, [selectedLot]);

  const maxTransferQuantity = selectedLot?.warehouseQuantity ?? 0;
  const isSameWarehouse = Boolean(fromWarehouseId && toWarehouseId && fromWarehouseId === toWarehouseId);
  const canSubmit = Boolean(
    lookupResult?.product.id &&
      selectedLot &&
      fromWarehouseId &&
      toWarehouseId &&
      !isSameWarehouse &&
      quantity > 0 &&
      quantity <= maxTransferQuantity,
  );

  const handleTransfer = async () => {
    if (!canSubmit || !lookupResult || !selectedLot || !fromWarehouseId || !toWarehouseId) {
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch('/api/transfers', {
        method: 'POST',
        body: JSON.stringify({
          fromWarehouseId,
          toWarehouseId,
          productId: lookupResult.product.id,
          lotId: selectedLot.id,
          quantity,
          barcode: lookupResult.isBarcodeMatch ? searchTerm : undefined,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      toast.success('Transfer kaydedildi');
      if (fromWarehouseId) {
        await fetchWarehouseStock(fromWarehouseId);
      }
      await handleSearch();
    } catch (error) {
      console.error('Transfer kaydetme hatası:', error);
      toast.error(error instanceof Error ? error.message : 'Transfer kaydedilemedi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setExcelFile(file);
  };

  const handleExcelUpload = async () => {
    if (!excelWarehouseId || !excelFile) {
      toast.error('Depo ve Excel dosyası seçin');
      return;
    }
    setIsExcelUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', excelFile);
      formData.append('warehouseId', excelWarehouseId);

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

      toast.success('Excel dosyası başarıyla içe aktarıldı');
      setExcelFile(null);
      if (excelInputRef.current) {
        excelInputRef.current.value = '';
      }
      setShowExcelUpload(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Excel yüklemesi başarısız');
    } finally {
      setIsExcelUploading(false);
    }
  };

  const handleExcelButtonClick = () => {
    if (!showExcelUpload && !excelWarehouseId) {
      setExcelWarehouseId(fromWarehouseId ?? mainWarehouseId ?? '');
    }
    setShowExcelUpload((prev) => !prev);
  };

  const pickExcelFile = () => excelInputRef.current?.click();

  const excelFileName = excelFile?.name ?? 'Dosya seçilmedi';
  const canUploadExcel = Boolean(excelWarehouseId && excelFile && !isExcelUploading);


  return (
    <div className="space-y-8 p-6 min-h-screen bg-slate-950 text-white">
      
      {/* ÜST BAŞLIK */}
      <header className="flex flex-wrap gap-4 justify-between items-center pb-4 mb-6 border-b border-slate-800">
        <h1 className="text-3xl font-semibold text-amber-500">Stok Transfer ve Barkod İşlemleri</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExcelButtonClick}
            className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            Excel ile Toplu Ürün Yükle
          </button>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>

      {showExcelUpload && (
        <div className="mb-6 space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-slate-200">
              Hedef Depo
              <select
                value={excelWarehouseId}
                onChange={(event) => setExcelWarehouseId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-white"
              >
                <option value="">Depo seçin</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.type})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-slate-200">
              Excel Dosyası (.xlsx / .xls)
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelFileChange}
                className="mt-1 hidden"
              />
              <div className="mt-1 flex items-center gap-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-3">
                <button
                  type="button"
                  onClick={pickExcelFile}
                  className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
                >
                  Dosya Seç
                </button>
                <span className="truncate text-xs text-slate-300">{excelFileName}</span>
              </div>
            </label>
          </div>
          <p className="text-xs text-slate-400">
            Beklenen sütunlar: <span className="text-emerald-300">Ürün/Hizmet Adı, Ürün Kodu, Barkodu, Lot/Seri</span> ve{' '}
            <span className="text-emerald-300">Stok Adedi (veya Kritik Stok)</span>. Lot/Seri girilmezse ürün kodu otomatik
            lot numarası olarak kullanılır.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleExcelUpload}
              disabled={!canUploadExcel}
              className={`rounded-xl px-5 py-2 text-sm font-semibold text-slate-950 ${
                canUploadExcel ? 'bg-emerald-400 hover:bg-emerald-300' : 'bg-slate-600 cursor-not-allowed text-slate-300'
              }`}
            >
              {isExcelUploading ? 'İçe aktarılıyor...' : 'Excel\'i Yükle'}
            </button>
            <button
              type="button"
              onClick={() => setShowExcelUpload(false)}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800/60"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* İÇERİK KARTLARI */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-lg">
        <h2 className="text-xl font-semibold mb-6 text-white">Transfer Detayları</h2>

        {/* DEPODAN VERİ ÇEKİLİYORSA YÜKLENİYOR İBARESİ */}
        {isLoading && <div className="text-center text-slate-500">Depo listesi yükleniyor...</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* KAYNAK DEPO */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Kaynak Depo</label>
            <select
              disabled={isLoading || warehouses.length === 0}
              value={fromWarehouseId ?? ''}
              onChange={(event) => setFromWarehouseId(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white focus:ring-cyan-500"
            >
              <option value="">{isLoading ? 'Yükleniyor...' : 'Kaynak depo seçin'}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} ({warehouse.type})
                </option>
              ))}
            </select>
          </div>

          {/* HEDEF DEPO */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Hedef Depo</label>
            <select 
              disabled={isLoading || destinationWarehouses.length === 0}
              value={toWarehouseId}
              onChange={(event) => setToWarehouseId(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white focus:ring-cyan-500"
            >
              <option value="">Hedef Depo Seçin</option>
              {destinationWarehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
              ))}
            </select>
          </div>
        </div>

        {/* ÜRÜN SEÇİMİ VE BARKOD ALANI */}
        <h3 className="text-lg font-semibold text-cyan-400 border-t border-slate-800 pt-6 mb-4">Ürün ve Lot Seçimi</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* BARKOD OKUMA INPUTU */}
            <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-400 mb-1">Barkod/Ürün Kodu</label>
                <input 
                    type="text" 
                    placeholder="ENTER'a basın"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        console.log('--- ENTER tuşlandı!');
                        handleSearch();
                      }
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white placeholder-slate-500 focus:ring-cyan-500"
                />
            </div>
            
            {/* LOT BİLGİSİ VE SEÇİMİ */}
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-1">Bulunan Ürün Bilgisi</label>
                {lookupResult ? (
                    <div className="space-y-4">
                        <div className={`rounded-lg border px-4 py-3 ${lookupResult.isBarcodeMatch ? 'border-green-500/50 bg-green-900/10' : 'border-blue-500/50 bg-blue-900/10'}`}>
                            <p className="font-medium text-white">{lookupResult.product.name}</p>
                            <p className="text-xs text-slate-400">
                                Ref: {lookupResult.product.referenceCode} • Toplam {lookupResult.product.totalQuantity} adet stok
                            </p>
                            {lookupResult.isBarcodeMatch && (
                              <p className="text-xs text-green-400 mt-1">Barkod eşleşmesi bulundu</p>
                            )}
                        </div>
                        {isStockLoading && (
                          <p className="text-xs text-slate-500">Kaynak depo stok bilgisi alınıyor...</p>
                        )}
                        {availableLots.length > 0 ? (
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-400">
                              Lot Seçimi
                              <select
                                value={selectedLot?.id ?? ''}
                                onChange={(event) => setSelectedLotId(event.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white focus:ring-cyan-500"
                              >
                                {availableLots.map((lot) => (
                                  <option key={lot.id} value={lot.id}>
                                    Lot {lot.lotNumber} • Bu depoda {lot.warehouseQuantity} adet
                                  </option>
                                ))}
                              </select>
                            </label>
                            {selectedLot && (
                              <p className="text-xs text-slate-400">
                                Seçilen lot bu depoda {selectedLot.warehouseQuantity} adet stok içeriyor. SKT:{' '}
                                {selectedLot.expiryDate ? selectedLot.expiryDate.slice(0, 10) : '—'}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200">
                            Seçilen kaynak depoda bu ürün için stok bulunamadı. Farklı depo seçin veya stoğu güncelleyin.
                          </div>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-slate-500 p-3">Ürün bekleniyor...</div>
                )}
            </div>
        </div>

        {/* TRANSFERİ KAYDET */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap gap-4 items-center">
            <div>
              <span className="text-xl font-bold text-white">Transfer Adeti</span>
              <p className="text-xs text-slate-500">Max: {selectedLot ? selectedLot.warehouseQuantity : '-'}</p>
            </div>
            <input 
                type="number"
                value={selectedLot ? quantity : ''}
                disabled={!selectedLot}
                min={1}
                max={selectedLot?.warehouseQuantity || 1}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isNaN(value)) {
                    setQuantity(1);
                    return;
                  }
                  const max = selectedLot?.quantity ?? value;
                  const sanitized = Math.min(Math.max(value, 1), max);
                  setQuantity(sanitized);
                }}
                className="w-24 rounded-lg border border-slate-700 bg-slate-800 p-3 text-white text-center disabled:opacity-50"
            />
            <button 
                type="button"
                onClick={handleTransfer}
                disabled={!canSubmit || isSubmitting}
                className={`text-slate-900 font-bold py-3 px-6 rounded-xl transition-colors ${canSubmit ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-700 cursor-not-allowed'}`}
            >
                {isSubmitting ? 'Kaydediliyor...' : 'Transferi Kaydet'}
            </button>
        </div>
        {isSameWarehouse && (
          <p className="mt-2 text-sm text-red-400">Kaynak ve hedef depo farklı olmalıdır.</p>
        )}
      </div>

    </div>
  );
}
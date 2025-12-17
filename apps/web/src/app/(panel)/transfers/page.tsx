// apps/web/src/app/(panel)/transfers/page.tsx

'use client'; // <-- SAYFAYI İNTERAKTİF HALE GETİRİYORUZ

import { ClerkLoaded, UserButton } from '@clerk/nextjs';
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { API_URL, DEV_USER_ID } from '@/lib/api-client';
import { apiFetch } from '@/lib/api-client/client';
import { LogModal } from '@/components/logs/LogModal';
import { Trash2 } from 'lucide-react';
// Kamera ile tarama kaldırıldı

// --- TİP TANIMLARI ---
type Warehouse = { id: string; name: string; type: string; };
type Lot = {
  id: string;
  lotNumber: string;
  quantity: number;
  barcode: string | null;
  expiryDate: string | null;
  onHandQuantity?: number;
  customerQuantity?: number;
  stockLocations?: Array<{
    id: string;
    quantity: number;
    warehouse: Warehouse;
  }>;
};
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
  product: {
    id: string;
    name: string;
    referenceCode: string;
    totalQuantity: number;
    onHandQuantity?: number;
    customerQuantity?: number;
  };
  lots: Lot[];
  autoSelectedLot: Lot | null;
  isBarcodeMatch: boolean;
};

// Transfer listesine eklenecek ürün tipi
type TransferItem = {
  id: string; // Geçici client ID
  product: {
    id: string;
    name: string;
    referenceCode: string;
  };
  lot: LotWithAvailability;
  quantity: number;
  barcodeScanned?: string;
};

export default function TransferPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fromWarehouseId, setFromWarehouseId] = useState<string>();
  const [toWarehouseId, setToWarehouseId] = useState('');
  
  // SEPET LİSTESİ
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);

  // Seçili ürün için miktar ve lot
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [selectedLotId, setSelectedLotId] = useState<string>();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [excelWarehouseId, setExcelWarehouseId] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isExcelUploading, setIsExcelUploading] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStockLocation[]>([]);
  const [isStockLoading, setIsStockLoading] = useState(false);
  // Kamera ile tarama kaldırıldı

  // DEBUG
  const [lastScannedDebug, setLastScannedDebug] = useState('');

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
    // Kaynak depo değişirse sepeti temizleyelim (stoklar değişeceği için)
    setTransferItems([]); 
    setLookupResult(null);
  }, [fetchWarehouseStock, fromWarehouseId]);

  // 2. ARAMA İŞLEMİ (ENTER tuşuna basınca çalışır)
  const handleSearch = useCallback(async (overrideTerm?: string) => {
    const term = overrideTerm ?? searchTerm;
    if (!term) return;
    try {
      const result = await apiFetch<LookupResponse>(`/api/products/lookup?code=${term}`);
      setLookupResult(result);
    } catch (error) {
      console.error('Ürün arama hatası:', error);
      toast.error('Ürün bulunamadı veya API hatası oluştu');
      setLookupResult(null);
    }
  }, [searchTerm]);

  const mainWarehouse = warehouses.find((w) => w.type === 'MAIN');
  const mainWarehouseId = mainWarehouse?.id ?? '';
  const sourceWarehouse = useMemo(
    () => warehouses.find((w) => w.id === fromWarehouseId),
    [warehouses, fromWarehouseId],
  );
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
      setCurrentQuantity(1);
      return;
    }

    setCurrentQuantity((prev) => {
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
  
  // Listeye ekleme butonu aktif mi?
  const canAddToItems = Boolean(
    lookupResult?.product.id &&
      selectedLot &&
      currentQuantity > 0 &&
      currentQuantity <= maxTransferQuantity
  );

  const handleAddToItems = () => {
    if (!canAddToItems || !selectedLot || !lookupResult) return;

    // Aynı lot daha önce eklendiyse miktarını arttır
    const existingIndex = transferItems.findIndex(
      (item) => item.product.id === lookupResult.product.id && item.lot.id === selectedLot.id
    );

    if (existingIndex >= 0) {
      // Mevcut miktarı güncelle
      const existingItem = transferItems[existingIndex];
      const newQuantity = existingItem.quantity + currentQuantity;

      if (newQuantity > selectedLot.warehouseQuantity) {
        toast.error(`Toplam miktar stok limitini aşıyor (Maks: ${selectedLot.warehouseQuantity})`);
        return;
      }

      setTransferItems((prev) => {
        const copy = [...prev];
        copy[existingIndex].quantity = newQuantity;
        return copy;
      });
      toast.success('Miktar güncellendi');
    } else {
      // Yeni satır ekle
      const newItem: TransferItem = {
        id: Math.random().toString(36).substring(2) + Date.now().toString(36),
        product: {
          id: lookupResult.product.id,
          name: lookupResult.product.name,
          referenceCode: lookupResult.product.referenceCode,
        },
        lot: selectedLot,
        quantity: currentQuantity,
        barcodeScanned: lookupResult.isBarcodeMatch ? searchTerm : undefined,
      };
      setTransferItems((prev) => [...prev, newItem]);
      toast.success('Listeye eklendi');
    }

    // Seçimi sıfırla
    setSearchTerm('');
    setLookupResult(null);
    setSelectedLotId(undefined);
    setCurrentQuantity(1);
  };

  const handleRemoveItem = (id: string) => {
    setTransferItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSetMaxQuantity = () => {
    if (!selectedLot) return;
    const max = selectedLot.warehouseQuantity;
    if (max <= 0) return;
    if (sourceWarehouse?.type === 'MAIN') {
      const ok = window.confirm(`Ana depodaki ${max} adet ürünün tamamını göndermek istediğinizden emin misiniz?`);
      if (!ok) return;
    }
    setCurrentQuantity(max);
  };

  const handleSubmitAll = async () => {
    if (transferItems.length === 0 || !fromWarehouseId || !toWarehouseId) return;

    if (isSameWarehouse) {
      toast.error('Kaynak ve hedef depo farklı olmalıdır');
      return;
    }

    setIsSubmitting(true);
    try {
      // Tüm ürünleri sırayla transfer et (veya backend'de toplu endpoint açılabilir)
      // Şimdilik sırayla client-side döngü:
      for (const item of transferItems) {
        await apiFetch('/api/transfers', {
          method: 'POST',
          body: JSON.stringify({
            fromWarehouseId,
            toWarehouseId,
            productId: item.product.id,
            lotId: item.lot.id,
            quantity: item.quantity,
            barcode: item.barcodeScanned,
          }),
          headers: { 'Content-Type': 'application/json' },
        });
      }

      toast.success(`${transferItems.length} kalem ürün transfer edildi`);
      
      // State temizliği
      setTransferItems([]);
      if (fromWarehouseId) {
        await fetchWarehouseStock(fromWarehouseId);
      }
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
            onClick={() => setShowLogModal(true)}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800/70"
          >
            Loglar
          </button>
          <button
            type="button"
            onClick={handleExcelButtonClick}
            className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            Excel ile Toplu Ürün Yükle
          </button>
          <ClerkLoaded>
            <UserButton afterSignOutUrl="/sign-in" />
          </ClerkLoaded>
        </div>
      </header>

      {showExcelUpload && (
        <div className="mb-6 space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-sm">
          {/* ... Excel Upload UI aynı kalabilir ... */}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SOL: ÜRÜN SEÇİM ALANI */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-lg">
            <h2 className="text-xl font-semibold mb-6 text-white">Ürün Ekleme</h2>

            {/* DEPODAN VERİ ÇEKİLİYORSA YÜKLENİYOR İBARESİ */}
            {isLoading && <div className="text-center text-slate-500">Depo listesi yükleniyor...</div>}

            <div className="grid grid-cols-1 gap-6 mb-8">
                {/* KAYNAK DEPO */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Kaynak Depo</label>
                    <select
                        disabled={isLoading || warehouses.length === 0 || transferItems.length > 0} // Sepet doluysa kaynak depo değiştirilemez
                        value={fromWarehouseId ?? ''}
                        onChange={(event) => setFromWarehouseId(event.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white focus:ring-cyan-500 disabled:opacity-50"
                    >
                        <option value="">{isLoading ? 'Yükleniyor...' : 'Kaynak depo seçin'}</option>
                        {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name} ({warehouse.type})
                        </option>
                        ))}
                    </select>
                    {transferItems.length > 0 && <p className="text-xs text-amber-500 mt-1">Listede ürün varken kaynak depo değiştirilemez.</p>}
                </div>
            </div>

            {/* DEBUG BARKOD INPUT */}
            <div className="mb-6 p-4 rounded-lg bg-slate-950/50 border border-slate-800 hidden md:block">
               <label className="block text-xs font-mono text-cyan-400 mb-2">DEBUG: Barkod Test Alanı (Focusla ve okut)</label>
               <input 
                  className="w-full bg-black border border-slate-700 text-green-400 font-mono text-sm p-2 rounded"
                  placeholder="Buraya tıkla ve barkod okut..."
                  value={lastScannedDebug}
                  onChange={(e) => setLastScannedDebug(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       console.log('Barkod okundu:', lastScannedDebug);
                       setSearchTerm(lastScannedDebug); // Arama alanına taşı
                       setLastScannedDebug(''); // Temizle
                       // handleSearch(); // Otomatik arama yapabiliriz
                       setTimeout(() => handleSearch(lastScannedDebug), 100); 
                    }
                  }}
               />
               <p className="text-xs text-slate-500 mt-2">Bu alan barkod okuyucunun ne gönderdiğini test etmek içindir. Okunan değer otomatik olarak aşağıdaki aramaya aktarılacaktır.</p>
            </div>

            {/* ÜRÜN SEÇİMİ VE BARKOD ALANI */}
            <h3 className="text-lg font-semibold text-cyan-400 border-t border-slate-800 pt-6 mb-4">Ürün ve Lot Seçimi</h3>
            <div className="grid grid-cols-1 gap-6">
                
                {/* BARKOD OKUMA INPUTU */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Barkod/Ürün Kodu</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Kodu girin veya okutun"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSearch();
                                }
                            }}
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 p-3 text-white placeholder-slate-500 focus:ring-cyan-500"
                        />
                        <button
                           type="button"
                           onClick={() => handleSearch()}
                           className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                            Ara
                        </button>
                    </div>
                </div>
                
                {/* LOT BİLGİSİ VE SEÇİMİ */}
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Bulunan Ürün Bilgisi</label>
                    {lookupResult ? (
                        <div className="space-y-4">
                            <div className={`rounded-lg border px-4 py-3 ${lookupResult.isBarcodeMatch ? 'border-green-500/50 bg-green-900/10' : 'border-blue-500/50 bg-blue-900/10'}`}>
                                <p className="font-medium text-white">{lookupResult.product.name}</p>
                                <p className="text-xs text-slate-400">
                                    Ref: {lookupResult.product.referenceCode} • Toplam {lookupResult.product.totalQuantity} adet
                                </p>
                                {lookupResult.isBarcodeMatch && (
                                    <p className="text-xs text-green-400 mt-1">Barkod eşleşmesi bulundu</p>
                                )}
                            </div>
                            
                            {isStockLoading && (
                                <p className="text-xs text-slate-500">Kaynak depo stok bilgisi alınıyor...</p>
                            )}

                            {availableLots.length > 0 ? (
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium text-slate-400">
                                    Lot Seçimi
                                    <select
                                        value={selectedLot?.id ?? ''}
                                        onChange={(event) => setSelectedLotId(event.target.value)}
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white focus:ring-cyan-500"
                                    >
                                        {availableLots.map((lot) => (
                                        <option key={lot.id} value={lot.id}>
                                            Lot {lot.lotNumber} • Mevcut: {lot.warehouseQuantity}
                                        </option>
                                        ))}
                                    </select>
                                    </label>
                                    
                                    <div className="flex items-end gap-3">
                                      <div className="flex-1">
                                        <label className="block text-sm font-medium text-slate-400 mb-1">Miktar</label>
                                        <div className="flex gap-2">
                                          <input
                                            type="number"
                                            value={selectedLot ? currentQuantity : ''}
                                            disabled={!selectedLot}
                                            min={1}
                                            max={selectedLot?.warehouseQuantity || 1}
                                            onChange={(event) => {
                                              const value = Number(event.target.value);
                                              setCurrentQuantity(value);
                                            }}
                                            className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white"
                                          />
                                          <button
                                            type="button"
                                            onClick={handleSetMaxQuantity}
                                            disabled={!selectedLot}
                                            className="rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                                          >
                                            Hepsini Al
                                          </button>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={handleAddToItems}
                                        disabled={!canAddToItems}
                                        className={`py-3 px-4 rounded-xl font-bold transition-colors ${canAddToItems ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                                      >
                                        Listeye Ekle
                                      </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-200">
                                    Seçilen kaynak depoda bu ürün için stok bulunamadı.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-sm text-slate-500 p-3 border border-dashed border-slate-800 rounded-lg text-center">
                            Ürün aramak için kod girin veya barkod okutun
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* SAĞ: TRANSFER LİSTESİ VE ONAY */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-lg flex flex-col h-full">
            <h2 className="text-xl font-semibold mb-6 text-white flex items-center justify-between">
                Transfer Listesi
                <span className="text-sm font-normal text-slate-400">{transferItems.length} kalem</span>
            </h2>

            <div className="flex-1 overflow-y-auto min-h-[300px] mb-6 space-y-3 bg-slate-950/30 p-4 rounded-xl border border-slate-800/50">
                {transferItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <p>Liste boş</p>
                        <p className="text-sm">Soldan ürün ekleyin</p>
                    </div>
                ) : (
                    transferItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 group hover:border-slate-600 transition-colors">
                            <div>
                                <p className="font-medium text-white">{item.product.name}</p>
                                <p className="text-xs text-slate-400">
                                    {item.product.referenceCode} • Lot: {item.lot.lotNumber}
                                    {item.barcodeScanned && <span className="ml-2 text-green-500/70 text-[10px] border border-green-500/30 px-1 rounded">BARKODLU</span>}
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-lg font-bold text-cyan-400">{item.quantity} Adet</span>
                                <button 
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                    <Trash2 className="size-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="pt-6 border-t border-slate-800 space-y-4">
                {/* HEDEF DEPO SEÇİMİ (BURAYA TAŞINDI) */}
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

                <div className="flex justify-end pt-2">
                    <button 
                        type="button"
                        onClick={handleSubmitAll}
                        disabled={transferItems.length === 0 || !toWarehouseId || isSubmitting || isSameWarehouse}
                        className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-colors shadow-lg ${
                            transferItems.length > 0 && toWarehouseId && !isSubmitting && !isSameWarehouse
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-amber-500/20' 
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        {isSubmitting ? 'Transfer Ediliyor...' : 'Transferi Tamamla'}
                    </button>
                </div>
            </div>
        </div>

      </div>

      {showLogModal && (
        <LogModal
          title="Transfer Logları"
          actionPrefix="TRANSFER"
          onClose={() => setShowLogModal(false)}
        />
      )}
    </div>
  );
}

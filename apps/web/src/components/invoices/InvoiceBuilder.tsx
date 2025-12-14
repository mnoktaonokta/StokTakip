'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api-client/client';
import type { Customer, ProductSummary } from '@/types/api';

type DocumentType = 'PROFORMA' | 'IRSALIYE' | 'FATURA';

interface InvoiceBuilderProps {
  onClose?: () => void;
}

interface DraftItem {
  stockLocationId?: string;
  warehouseId?: string;
  productId: string;
  lotId: string;
  lotNumber?: string;
  description: string;
  referenceCode?: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  category?: string | null;
}

interface InvoiceDraft {
  invoiceId?: string;
  documentType?: DocumentType;
  customerId: string;
  customerName: string;
  warehouseId?: string;
  items: DraftItem[];
  form?: {
    documentNo?: string;
    issueDate?: string;
    dueDate?: string;
    dispatchNo?: string;
    dispatchDate?: string;
    notes?: string;
  };
}

interface InvoiceItemState extends DraftItem {
  id: string;
  discountPercent: number;
}

const createDefaultForm = () => ({
  documentNo: '',
  issueDate: new Date().toISOString().slice(0, 16),
  dueDate: new Date().toISOString().slice(0, 10),
  dispatchNo: '',
  dispatchDate: new Date().toISOString().slice(0, 10),
  notes: '',
});

export function InvoiceBuilder({ onClose }: InvoiceBuilderProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<InvoiceItemState[]>([]);
  const [documentType, setDocumentType] = useState<DocumentType>('FATURA');
  const [form, setForm] = useState(createDefaultForm);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [extraDiscount, setExtraDiscount] = useState(0);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingDocumentType, setEditingDocumentType] = useState<DocumentType | null>(null);

  const loadDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem('invoiceDraft');
    if (!stored) {
      setDraft(null);
      setItems([]);
      setEditingInvoiceId(null);
      setEditingDocumentType(null);
      setForm(createDefaultForm());
      setDocumentType('FATURA');
      return;
    }
    try {
      const parsed: InvoiceDraft = JSON.parse(stored);
      setDraft(parsed);
      setEditingInvoiceId(parsed.invoiceId ?? null);
      const inferredType = parsed.documentType ?? 'FATURA';
      setEditingDocumentType(parsed.documentType ?? null);
      setDocumentType(inferredType);
      setItems(
        (parsed.items ?? []).map((item, index) => ({
          ...item,
          id: `${item.productId}-${item.lotId}-${index}`,
          discountPercent: 0,
        })),
      );
      setForm((prev) => ({
        documentNo: parsed.form?.documentNo ?? '',
        issueDate: parsed.form?.issueDate ?? prev.issueDate,
        dueDate: parsed.form?.dueDate ?? prev.dueDate,
        dispatchNo: parsed.form?.dispatchNo ?? '',
        dispatchDate: parsed.form?.dispatchDate ?? prev.dispatchDate,
        notes: parsed.form?.notes ?? '',
      }));
    } catch (error) {
      console.error('Taslak okunamadı', error);
    }
  }, []);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  useEffect(() => {
    if (!draft?.customerId) {
      setCustomer(null);
      return;
    }
    let cancelled = false;
    apiFetch<Customer>(`/api/customers/${draft.customerId}/depot`)
      .then((data) => {
        if (!cancelled) {
          setCustomer(data);
        }
      })
      .catch((error) => {
        console.error('Müşteri bilgisi alınamadı', error);
      });
    return () => {
      cancelled = true;
    };
  }, [draft?.customerId]);

  useEffect(() => {
    if (searchTerm.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    apiFetch<ProductSummary[]>(`/api/products?search=${encodeURIComponent(searchTerm.trim())}`)
      .then((products) => {
        if (!cancelled) {
          setSearchResults(products.slice(0, 8));
        }
      })
      .catch((error) => {
        console.error('Ürün arama hatası', error);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchTerm]);

  const totals = useMemo(() => {
    const grossTotal = (items ?? []).reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discountTotal =
      (items ?? []).reduce((sum, item) => {
        const line = item.quantity * item.unitPrice;
        return sum + (line * item.discountPercent) / 100;
      }, 0) + extraDiscount;
    const netTotal = Math.max(grossTotal - discountTotal, 0);
    const taxTotal = (items ?? []).reduce((sum, item) => {
      const line = item.quantity * item.unitPrice;
      const discount = (line * item.discountPercent) / 100;
      const taxable = Math.max(line - discount, 0);
      return sum + (taxable * item.vatRate) / 100;
    }, 0);
    const grandTotal = netTotal + taxTotal;
    return { grossTotal, discountTotal, netTotal, taxTotal, grandTotal };
  }, [items, extraDiscount]);

  const categorySummary = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item) => {
      if (!item.category) return;
      map.set(item.category, (map.get(item.category) ?? 0) + item.quantity);
    });
    return Array.from(map.entries());
  }, [items]);

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleUpdateItem = (itemId: string, updates: Partial<InvoiceItemState>) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
  };

  const handleAddProduct = (product: ProductSummary) => {
    const quantity = Number(prompt(`Kaç adet "${product.name}" eklensin?`, '1'));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Geçerli bir miktar girin.');
      return;
    }
    const unitPrice = Number(prompt('Birim fiyat (KDV hariç)', product.salePrice?.toString() ?? '0')) || 0;
    const lotNumber = prompt('Lot numarası (opsiyonel)', '') ?? undefined;
    const lotId = product.lots[0]?.id ?? product.id;
    setItems((prev) => [
      ...prev,
      {
        id: `${product.id}-${Date.now()}`,
        productId: product.id,
        lotId,
        lotNumber,
        description: product.name,
        referenceCode: product.referenceCode,
        quantity,
        unitPrice,
        vatRate: product.vatRate ?? 10,
        category: product.category,
        discountPercent: 0,
      },
    ]);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleApplyDiscount = () => {
    const target = Number(prompt('Yeni toplam (KDV dahil) tutarı girin:', totals.grandTotal.toFixed(2)));
    if (!Number.isFinite(target) || target <= 0) {
      toast.error('Geçerli bir tutar girin.');
      return;
    }
    const difference = totals.grandTotal - target;
    if (difference < 0) {
      toast.error('Hedef tutar mevcut toplamdan büyük olamaz.');
      return;
    }
    setExtraDiscount(difference);
    toast.success('İskonto uygulandı.');
  };

  const handleSave = async (type: DocumentType) => {
    setDocumentType(type);
    if (!draft?.customerId) {
      toast.error('Önce bir müşteri seçmelisiniz.');
      return;
    }
    if (items.length === 0) {
      toast.error('Faturaya eklenecek ürün yok.');
      return;
    }
    try {
      const isEditing = Boolean(editingInvoiceId && editingDocumentType === type);
    const stockAdjustments = items
        .filter((item) => item.stockLocationId && item.warehouseId)
        .map((item) => ({
          warehouseId: item.warehouseId!,
          stockLocationId: item.stockLocationId,
          lotId: item.lotId,
          quantity: item.quantity,
        }));

      const shouldAdjustStock = !isEditing && stockAdjustments.length > 0;
      const baseBody = {
        items: items.map((item) => ({
          productId: item.productId,
          lotId: item.lotId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: Number(item.vatRate ?? 0),
          lotNumber: item.lotNumber,
          description: item.description,
          category: item.category,
        })),
        documentNo: form.documentNo || undefined,
        issueDate: form.issueDate ? new Date(form.issueDate).toISOString() : undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        dispatchNo: form.dispatchNo || undefined,
        dispatchDate: form.dispatchDate ? new Date(form.dispatchDate).toISOString() : undefined,
        notes: form.notes || undefined,
        summary: {
          grossTotal: totals.grossTotal,
          discountTotal: totals.discountTotal,
          netTotal: totals.netTotal,
          taxTotal: totals.taxTotal,
          grandTotal: totals.grandTotal,
          categories: categorySummary.map(([category, quantity]) => ({
            category,
            quantity,
            unit: 'Ad',
          })),
        },
      };

      if (isEditing && editingInvoiceId) {
        await apiFetch(`/api/invoices/${editingInvoiceId}`, {
          method: 'PUT',
          body: baseBody,
        });
        toast.success('Belge güncellendi.');
      } else {
        await apiFetch('/api/invoices', {
          method: 'POST',
          body: {
            customerId: draft.customerId,
            stockAdjustments: shouldAdjustStock ? stockAdjustments : undefined,
            documentType: type,
            ...baseBody,
          },
        });
        toast.success(
          type === 'PROFORMA'
            ? 'Proforma kaydedildi.'
            : type === 'IRSALIYE'
              ? 'İrsaliye kaydedildi.'
              : 'Fatura kaydedildi.',
        );
      }
      sessionStorage.removeItem('invoiceDraft');
      setEditingInvoiceId(null);
      setEditingDocumentType(null);
      loadDraft();
      router.refresh();
      onClose?.();
    } catch (error) {
      console.error('Fatura kaydı başarısız', error);
      toast.error(error instanceof Error ? error.message : 'Fatura kaydedilemedi');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-slate-500">Faturalama</p>
        <h1 className="text-3xl font-semibold text-white">Fatura / İrsaliye / Proforma</h1>
        <p className="text-sm text-slate-400">Depodan seçtiğiniz ürünleri tek ekran üzerinden faturalayın.</p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl">
        <div className="flex flex-wrap items-center gap-3">
        {(['PROFORMA', 'IRSALIYE', 'FATURA'] as DocumentType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleSave(type)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              documentType === type
                ? 'bg-cyan-500/80 text-slate-950'
                : 'border border-slate-700 text-slate-300 hover:border-cyan-500'
            }`}
          >
            {type === 'PROFORMA' && 'Proforma / Sipariş Kaydet'}
            {type === 'IRSALIYE' && 'İrsaliye Kaydet'}
            {type === 'FATURA' && 'Fatura Kaydet'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            if (onClose) {
              onClose();
            } else {
              router.push('/invoices');
            }
          }}
          className="ml-auto rounded-2xl border border-slate-600 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800/70"
        >
          Geri Dön
        </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-4">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 lg:col-span-1">
            <h2 className="text-lg font-semibold text-white">Belge Bilgileri</h2>
            <div className="space-y-3 text-sm text-slate-200">
              <p className="text-2xl font-bold text-cyan-300">{customer?.name ?? draft?.customerName ?? 'Müşteri seçilmedi'}</p>
              <label className="block">
                <span className="text-xs text-slate-400">Belge No</span>
                <input
                  type="text"
                  value={form.documentNo}
                  onChange={(event) => setForm((prev) => ({ ...prev, documentNo: event.target.value }))}
                  placeholder="Boş bırakırsanız otomatik üretilir"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Fatura Tarihi</span>
                <input
                  type="datetime-local"
                  value={form.issueDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, issueDate: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Vade Tarihi</span>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">İrsaliye No</span>
                <input
                  type="text"
                  value={form.dispatchNo}
                  onChange={(event) => setForm((prev) => ({ ...prev, dispatchNo: event.target.value }))}
                  placeholder="Otomatik üretilebilir"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Sevk Tarihi</span>
                <input
                  type="date"
                  value={form.dispatchDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, dispatchDate: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-400">Not</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
                  placeholder="Müşteriye özel notlar..."
                />
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 lg:col-span-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-widest text-slate-500">Ürün / Hizmet Arama</label>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Ürün isminden arayın veya barkod okutun..."
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
              />
            </div>
            {isSearching && <p className="text-xs text-slate-500">Aranıyor...</p>}
            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/90">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleAddProduct(product)}
                    className="flex w-full items-center justify-between border-b border-slate-800 px-4 py-2 text-left text-sm text-white hover:bg-slate-800/70"
                  >
                    <span>{product.name}</span>
                    <span className="text-xs text-slate-400">{product.referenceCode}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-slate-800">
              <table className="min-w-full text-sm text-slate-300">
                <thead className="bg-slate-900/70 text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Açıklama</th>
                    <th className="px-4 py-2 text-center">Lot</th>
                    <th className="px-4 py-2 text-center">Miktar</th>
                    <th className="px-4 py-2 text-right">Birim Fiyat</th>
                    <th className="px-4 py-2 text-right">% İnd.</th>
                    <th className="px-4 py-2 text-right">Net</th>
                    <th className="px-4 py-2 text-right">KDV</th>
                    <th className="px-4 py-2 text-right">Toplam</th>
                    <th className="px-2 py-2 text-right">Sil</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-6 text-center text-xs text-slate-500">
                        Depodan ürün seçerek veya soldan aratarak listeye ekleyin.
                      </td>
                    </tr>
                  )}
                  {items.map((item, index) => {
                    const line = item.quantity * item.unitPrice;
                    const discountAmount = (line * item.discountPercent) / 100;
                    const net = line - discountAmount;
                    const vat = (net * item.vatRate) / 100;
                    const total = net + vat;
                    return (
                      <tr key={item.id} className="border-t border-slate-800">
                        <td className="px-4 py-3 text-xs text-slate-500">{index + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{item.description}</p>
                          <p className="text-[10px] text-slate-500">{item.referenceCode}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-400">{item.lotNumber ?? '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) =>
                              handleUpdateItem(item.id, { quantity: Math.max(Number(event.target.value), 1) })
                            }
                            className="w-20 rounded-xl border border-slate-700 bg-slate-900/80 px-2 py-1 text-center text-white"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(event) =>
                              handleUpdateItem(item.id, { unitPrice: Math.max(Number(event.target.value), 0) })
                            }
                            className="w-24 rounded-xl border border-slate-700 bg-slate-900/80 px-2 py-1 text-right text-white"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={item.discountPercent}
                            onChange={(event) =>
                              handleUpdateItem(item.id, { discountPercent: Math.min(Math.max(Number(event.target.value), 0), 100) })
                            }
                            className="w-16 rounded-xl border border-slate-700 bg-slate-900/80 px-2 py-1 text-right text-white"
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-300">{net.toFixed(2)} ₺</td>
                        <td className="px-4 py-3 text-right text-slate-200">{vat.toFixed(2)} ₺</td>
                        <td className="px-4 py-3 text-right font-semibold text-white">{total.toFixed(2)} ₺</td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="rounded-full bg-rose-600/70 px-2 py-1 text-xs text-white hover:bg-rose-500"
                          >
                            Sil
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-800/70 bg-slate-900/70 p-4 text-sm text-slate-200">
              <div className="flex justify-between">
                <span>Toplam Miktar</span>
                <span className="font-semibold">{items.reduce((sum, item) => sum + item.quantity, 0)} Ad</span>
              </div>
              {categorySummary.length > 0 && (
                <div className="space-y-1 text-xs text-slate-400">
                  {categorySummary.map(([category, quantity]) => (
                    <div key={category} className="flex justify-between">
                      <span>{category}</span>
                      <span>{quantity}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between">
                <span>Brüt Toplam</span>
                <span>{totals.grossTotal.toFixed(2)} ₺</span>
              </div>
              <div className="flex justify-between text-rose-300">
                <span>İndirim</span>
                <span>-{totals.discountTotal.toFixed(2)} ₺</span>
              </div>
              <div className="flex justify-between">
                <span>Net Toplam</span>
                <span>{totals.netTotal.toFixed(2)} ₺</span>
              </div>
              <div className="flex justify-between">
                <span>KDV</span>
                <span>{totals.taxTotal.toFixed(2)} ₺</span>
              </div>
              <div className="flex justify-between text-lg font-semibold text-white">
                <span>TOPLAM</span>
                <span>{totals.grandTotal.toFixed(2)} ₺</span>
              </div>
              <button
                type="button"
                onClick={handleApplyDiscount}
                className="w-full rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/30"
              >
                Fatura Altı İskonto Yap
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


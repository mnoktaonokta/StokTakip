'use client';

import { toast } from 'sonner';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/lib/api-client/client';
import type { Invoice } from '@/types/api';
import { InvoiceBuilder } from './InvoiceBuilder';

interface InvoicesScreenProps {
  invoices: Invoice[];
  initialMode?: 'list' | 'builder';
}

interface DraftFromInvoice {
  customerId: string;
  customerName: string;
  items: Array<{
    productId: string;
    lotId: string;
    lotNumber?: string;
    description: string;
    referenceCode?: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
  }>;
}

const currencyFormatter = (value: number) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(value);

const documentTypeLabels: Record<string, string> = {
  PROFORMA: 'Proforma',
  IRSALIYE: 'İrsaliye',
  FATURA: 'Fatura',
};

export function InvoicesScreen({ invoices, initialMode = 'list' }: InvoicesScreenProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'list' | 'builder'>(initialMode);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (initialMode === 'builder') {
      setMode('builder');
      return;
    }
    setMode('list');
  }, [initialMode]);

  const handleOpenBuilder = (invoice?: Invoice) => {
    setMode('builder');
    if (invoice) {
      const draft: DraftFromInvoice = {
        customerId: invoice.customer.id,
        customerName: invoice.customer.name,
        items:
          Array.isArray(invoice.items) && invoice.items.length > 0
            ? (invoice.items as DraftFromInvoice['items'])
            : [],
      };
      if (draft.items.length > 0) {
        sessionStorage.setItem('invoiceDraft', JSON.stringify(draft));
      }
    }
    router.replace('/invoices?mode=builder');
  };

  const handleCloseBuilder = () => {
    setMode('list');
    router.replace('/invoices');
  };

  const handleDelete = async (invoiceId: string) => {
    const confirmDelete = window.confirm('Bu belgeyi silmek istediğinizden emin misiniz? Faturalı kayıtlar silinemez.');
    if (!confirmDelete) {
      return;
    }
    try {
      setIsDeleting(invoiceId);
      await apiFetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
      });
      router.refresh();
    } catch (error) {
      console.error('Invoice delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Belge silinemedi');
    } finally {
      setIsDeleting(null);
    }
  };

  const grouped = useMemo(() => {
    const sections: Record<'FATURA' | 'IRSALIYE' | 'PROFORMA', Invoice[]> = {
      FATURA: [],
      IRSALIYE: [],
      PROFORMA: [],
    };
    invoices.forEach((invoice) => {
      const type = (invoice.documentType ?? 'FATURA') as 'FATURA' | 'IRSALIYE' | 'PROFORMA';
      sections[type].push(invoice);
    });
    return sections;
  }, [invoices]);

  if (mode === 'builder') {
    return <InvoiceBuilder onClose={handleCloseBuilder} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-slate-500">Faturalama</p>
          <h1 className="text-3xl font-semibold text-white">Kesilen Belgeler</h1>
          <p className="text-sm text-slate-400">Proforma, irsaliye ve fatura geçmişinizi buradan görüntüleyin.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenBuilder}
          className="rounded-2xl bg-cyan-500/80 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          + Yeni Belge Oluştur
        </button>
      </div>

      {(['FATURA', 'IRSALIYE', 'PROFORMA'] as const).map((type) => {
        const entries = grouped[type];
        if (entries.length === 0) {
          return null;
        }
        return (
          <div key={type} className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">{documentTypeLabels[type]}</h2>
              <span className="text-xs uppercase tracking-widest text-slate-500">{entries.length} kayıt</span>
            </div>
            <div className="divide-y divide-slate-800 rounded-2xl border border-slate-800/60 bg-slate-950/30">
              {entries.map((invoice) => (
                <div
                  key={invoice.id}
                  className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-900/40"
                >
                  <button
                    onClick={() => handleOpenBuilder(invoice)}
                    className="col-span-6 flex flex-col items-start gap-0.5 text-left"
                  >
                    <span className="text-sm font-semibold text-white">{invoice.customer.name}</span>
                    <span className="text-[10px] text-slate-500">{invoice.invoiceNumber ?? invoice.id}</span>
                  </button>
                  <div className="col-span-3 text-right">
                    <p className="text-xs font-semibold text-emerald-300">
                      {currencyFormatter(Number(invoice.totalAmount ?? 0))}
                    </p>
                    <p className="text-[9px] text-slate-500">
                      {new Date(invoice.timestamp).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                  <div className="col-span-2 text-right text-[9px] uppercase tracking-widest text-slate-500">
                    {invoice.documentType ?? 'FATURA'}
                  </div>
                  {type !== 'FATURA' && (
                    <button
                      onClick={() => handleDelete(invoice.id)}
                      disabled={isDeleting === invoice.id}
                      className="col-span-1 rounded-lg border border-rose-500/50 px-2 py-1 text-[10px] font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      {isDeleting === invoice.id ? '...' : 'Sil'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {invoices.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">
          Henüz oluşturulmuş bir belge yok. Sağ üstten “Yeni Belge Oluştur” diyerek başlayabilirsiniz.
        </div>
      )}
    </div>
  );
}


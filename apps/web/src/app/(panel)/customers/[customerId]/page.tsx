import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CustomerNotesCard } from '../CustomerNotesCard';

import { apiFetch as apiFetchServer } from '@/lib/api-client/server';
import type { Customer } from '@/types/api';

const currencyFormatter = (value: number) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string) => new Date(value).toLocaleDateString('tr-TR');

interface PageProps {
  params: Promise<{ customerId: string }>;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { customerId } = await params;

  let customer: Customer | null = null;
  try {
    customer = await apiFetchServer<Customer>(`/api/customers/${customerId}/depot`);
  } catch (_error) {
    notFound();
  }

  if (!customer) {
    notFound();
  }

  const invoices = customer.invoices ?? [];
  const totalTurnover = (invoices ?? []).reduce((sum, invoice) => sum + Number(invoice?.totalAmount ?? 0), 0);
  const openBalance = totalTurnover;
  const chequeBalance = 0;

  const infoCards = [
    {
      label: 'Açık Bakiyesi',
      value: currencyFormatter(openBalance),
      badge: openBalance >= 0 ? 'alacaklı' : 'borçlu',
      tone: 'bg-rose-500/10 text-rose-100 border border-rose-500/20',
    },
    {
      label: 'Çek Bakiyesi',
      value: currencyFormatter(0),
      badge: 'çek',
      tone: 'bg-sky-500/10 text-sky-100 border border-sky-500/20',
    },
    {
      label: 'Senet Bakiyesi',
      value: currencyFormatter(chequeBalance),
      badge: chequeBalance > 0 ? 'borçlu' : '0',
      tone: 'bg-blue-500/10 text-blue-100 border border-blue-500/20',
    },
    {
      label: 'Cirosu',
      value: currencyFormatter(totalTurnover),
      badge: '2024',
      tone: 'bg-emerald-500/10 text-emerald-100 border border-emerald-500/20',
    },
  ];

  const salesRows = invoices.map((invoice) => ({
    id: invoice.id,
    date: formatDate(invoice.timestamp),
    number: invoice.invoiceNumber ?? invoice.id.slice(0, 8),
    status: invoice.invoiceNumber ? 'Faturalanmış' : 'Fatura edilmedi',
    total: currencyFormatter(Number(invoice.totalAmount ?? 0)),
  }));

  const paymentsRows: Array<{ id: string; date: string; amount: string; method: string }> = [];

  const actionButtons = [
    {
      label: 'Satış Yap',
      href: `/warehouses?customer=${customer.id}`,
      style: 'bg-slate-800 text-white hover:bg-slate-700',
    },
    {
      label: 'Teklif Hazırla',
      href: `/quotes/new?customer=${customer.id}`,
      style: 'bg-amber-500/80 text-slate-900 hover:bg-amber-400',
    },
    {
      label: 'Tahsilat/Ödeme',
      href: `/payments/new?customer=${customer.id}`,
      style: 'bg-emerald-500/80 text-slate-900 hover:bg-emerald-400',
    },
    {
      label: 'Hesap Ekstresi',
      href: `/customers/${customer.id}/statement`,
      style: 'border border-slate-700 text-slate-200 hover:bg-slate-800/60',
    },
    {
      label: 'Müşteri Bilgilerini Güncelle',
      href: `/customers/${customer.id}/edit`,
      style: 'border border-slate-700 text-slate-200 hover:bg-slate-800/60',
    },
    {
      label: 'Müşteriyi Sil',
      href: `/customers/${customer.id}/delete`,
      style: 'bg-rose-600/80 text-white hover:bg-rose-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/30">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
            {customer.logo ? (
              <Image
                src={customer.logo}
                alt={customer.name}
                width={120}
                height={120}
                unoptimized
                className="h-24 w-24 rounded-3xl border border-slate-800 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-slate-800 bg-slate-950 text-2xl font-semibold text-slate-500">
                {customer.name
                  .split(' ')
                  .slice(0, 2)
                  .map((word) => word.charAt(0).toUpperCase())
                  .join('')}
              </div>
            )}
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-white">{customer.name}</h1>
              {customer.phone && (
                <p className="text-sm text-slate-300">
                  <span className="text-emerald-300">📞</span> {customer.phone}
                </p>
              )}
              {customer.address && (
                <p className="text-sm text-slate-300">
                  <span className="text-emerald-300">📍</span> {customer.address}
                </p>
              )}
              <div className="flex flex-col gap-1 text-sm text-slate-300 sm:flex-row sm:items-center sm:gap-4">
                {(customer.taxOffice || customer.taxNumber) && (
                  <span>
                    {customer.taxOffice && (
                      <>
                        <span className="text-emerald-300">🏢</span> {customer.taxOffice}
                      </>
                    )}
                    {customer.taxOffice && customer.taxNumber && <span className="text-slate-500"> / </span>}
                    {customer.taxNumber && <span>{customer.taxNumber}</span>}
                  </span>
                )}
              </div>
            </div>
          </div>
        <CustomerNotesCard customerId={customer.id} initialNotes={customer.notes ?? []} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {infoCards.map((card) => (
          <div key={card.label} className={`rounded-3xl p-4 shadow-lg shadow-black/30 ${card.tone}`}>
            <p className="text-xs uppercase tracking-widest text-slate-400">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            <p className="text-xs text-slate-400">{card.badge}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {actionButtons.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${action.style}`}
          >
            {action.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Önceki Satışlar</h2>
            <button className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-400">⌄</button>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex text-xs uppercase tracking-wide text-slate-500">
              <span className="w-1/3">Tarih</span>
              <span className="w-1/3">No</span>
              <span className="w-1/3 text-right">Durum / Tutar</span>
            </div>
            {salesRows.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-800/60 bg-slate-900/40 p-4 text-xs text-slate-500">
                Bu müşteri için henüz satış kaydı yok.
              </p>
            ) : (
              salesRows.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center rounded-2xl border border-slate-800/60 bg-slate-950/50 px-3 py-2"
                >
                  <span className="w-1/3 text-slate-200">{sale.date}</span>
                  <span className="w-1/3 text-slate-400">{sale.number}</span>
                  <span className="w-1/3 text-right text-slate-300">
                    {sale.status}
                    <br />
                    <strong className="text-white">{sale.total}</strong>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Önceki Ödemeler</h2>
            <button className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-400">⌄</button>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex text-xs uppercase tracking-wide text-slate-500">
              <span className="w-1/3">Tarih</span>
              <span className="w-1/3">Tutar</span>
              <span className="w-1/3 text-right">Şekli</span>
            </div>
            {paymentsRows.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-800/60 bg-slate-900/40 p-4 text-xs text-slate-500">
                Bu müşteri için henüz tahsilat kaydı yok.
              </p>
            ) : (
              paymentsRows.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center rounded-2xl border border-slate-800/60 bg-slate-950/50 px-3 py-2"
                >
                  <span className="w-1/3 text-slate-200">{payment.date}</span>
                  <span className="w-1/3 text-emerald-300">{payment.amount}</span>
                  <span className="w-1/3 text-right text-slate-400">{payment.method}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
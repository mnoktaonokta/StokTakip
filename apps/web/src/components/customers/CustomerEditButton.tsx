'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import type { Customer } from '@/types/api';
import { apiFetch } from '@/lib/api-client/client';

interface Props {
  customer: Customer;
}

export function CustomerEditButton({ customer }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: customer.name ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    address: customer.address ?? '',
    taxOffice: customer.taxOffice ?? '',
    taxNumber: customer.taxNumber ?? '',
  });

  const handleChange =
    (field: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      await apiFetch<Customer>(`/api/customers/${customer.id}`, {
        method: 'PUT',
        body: form,
      });
      toast.success('Müşteri bilgileri güncellendi');
      setOpen(false);
      // sayfayı tazele
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message ?? 'Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-slate-700 text-slate-200 hover:bg-slate-800/60 rounded-full px-3 py-1 text-sm"
      >
        Müşteri Bilgilerini Güncelle
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Müşteri</p>
                <h3 className="text-xl font-semibold text-white">Bilgileri Güncelle</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800/70"
              >
                Kapat
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-slate-300">
                İsim / Ünvan
                <input
                  value={form.name}
                  onChange={handleChange('name')}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-white"
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-300">
                  Telefon
                  <input
                    value={form.phone}
                    onChange={handleChange('phone')}
                    className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-white"
                    placeholder="(5xx) xxx xx xx"
                  />
                </label>
                <label className="text-sm text-slate-300">
                  E-posta
                  <input
                    value={form.email}
                    onChange={handleChange('email')}
                    className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-white"
                    placeholder="ornek@mail.com"
                  />
                </label>
              </div>
              <label className="text-sm text-slate-300">
                Adres
                <textarea
                  value={form.address}
                  onChange={handleChange('address')}
                  rows={3}
                  className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-white"
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-300">
                  Vergi Dairesi
                  <input
                    value={form.taxOffice}
                    onChange={handleChange('taxOffice')}
                    className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Vergi / TC Kimlik No
                  <input
                    value={form.taxNumber}
                    onChange={handleChange('taxNumber')}
                    className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-white"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800/60"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={saving || !form.name.trim()}
                onClick={handleSubmit}
                className="rounded-2xl border border-emerald-400/40 bg-emerald-500/80 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


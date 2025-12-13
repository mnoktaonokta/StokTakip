'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api-client/client';

export interface CustomerRow {
  id: string;
  name: string;
  warehouseId?: string | null;
  displayPhone: string;
  openBalance: number;
  totalValue: number;
  chequeBalance: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(value);

const maskWarehouse = (warehouseId?: string | null) =>
  warehouseId ? warehouseId.slice(0, 8).toUpperCase() : '—';

interface CustomerTableProps {
  customers: CustomerRow[];
}

export function CustomerTable({ customers }: CustomerTableProps) {
  const [query, setQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    taxOffice: '',
    taxNumber: '',
  });

  useEffect(() => {
    return () => {
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  // Modal açıksa body scroll'u kilitle (mobilde altta kalan butona erişim için)
  useEffect(() => {
    if (isFormOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isFormOpen]);

  const filteredCustomers = useMemo(() => {
    if (query.trim().length < 3) {
      return customers;
    }
    const normalized = query.trim().toLowerCase();
    return customers.filter((customer) => customer.name.toLowerCase().includes(normalized));
  }, [customers, query]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const convertFileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });

  const handleCreateCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      const logo = logoFile ? await convertFileToBase64(logoFile) : undefined;

      await apiFetch('/api/customers', {
        method: 'POST',
        body: {
          name: formData.name.trim(),
          address: formData.address.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          taxOffice: formData.taxOffice.trim() || undefined,
          taxNumber: formData.taxNumber.trim() || undefined,
          logo,
        },
      });

      toast.success('Müşteri kaydedildi');
      setIsFormOpen(false);
      setFormData({
        name: '',
        address: '',
        phone: '',
        email: '',
        taxOffice: '',
        taxNumber: '',
      });
      setLogoFile(null);
      setLogoPreview(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Müşteri kaydedilemedi');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="w-full max-w-md rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 md:w-1/3"
        >
          + Yeni Müşteri Ekle
        </button>
        <div className="w-full md:w-1/3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ara (en az 3 karakter)..."
            className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80">
        <div className="hidden grid-cols-12 gap-4 border-b border-slate-800 bg-slate-950 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-slate-400 md:grid">
          <span className="col-span-5">İsim / Ünvan</span>
          <span className="col-span-2 text-center">Telefon</span>
          <span className="col-span-2 text-right">Açık Bakiye</span>
          <span className="col-span-2 text-right">Depo Değeri</span>
          <span className="col-span-1 text-right">Çek/Senet</span>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredCustomers.map((customer) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-900/40 md:grid md:grid-cols-12 md:items-center md:gap-4"
            >
              <div className="col-span-5">
                <p className="text-base font-semibold text-white">{customer.name}</p>
                <p className="text-xs text-slate-500">
                  Depo ID: <span className="font-mono">{maskWarehouse(customer.warehouseId)}</span>
                </p>
              </div>
              <div className="col-span-2 text-center text-sm font-semibold text-emerald-300">
                {customer.displayPhone}
              </div>
              <div className="col-span-2 text-right text-sm font-semibold text-slate-200">
                {formatCurrency(customer.openBalance)}
              </div>
              <div className="col-span-2 text-right text-sm font-semibold text-cyan-300">
                {formatCurrency(customer.totalValue)}
              </div>
              <div className="col-span-1 text-right text-sm font-semibold text-slate-300">
                {formatCurrency(customer.chequeBalance)}
              </div>
            </Link>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              Aradığınız kriterlerde müşteri bulunamadı.
            </div>
          )}
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 py-6 overflow-y-auto overscroll-contain">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl max-h-[90vh] h-[90vh] overflow-y-auto overscroll-contain pb-24">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Yeni Müşteri</p>
                <h2 className="text-2xl font-semibold text-white">Clinic / Müşteri Oluştur</h2>
                <p className="text-xs text-slate-500">
                  Bilgileri doldurun, kaydetmeden önce logoyu yükleyebilirsiniz.
                </p>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Kapat
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col text-sm text-slate-300">
                  İsim / Ünvan
                  <input
                    required
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-white"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  Telefon
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="(5xx) xxx xx xx"
                    className="mt-1 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-white"
                  />
                </label>
              </div>

              <label className="flex flex-col text-sm text-slate-300">
                Adres
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-white"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col text-sm text-slate-300">
                  Mail Adresi
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="mt-1 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-white"
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-300">
                  Vergi Dairesi
                  <input
                    name="taxOffice"
                    value={formData.taxOffice}
                    onChange={handleInputChange}
                    className="mt-1 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-white"
                  />
                </label>
              </div>

              <label className="flex flex-col text-sm text-slate-300">
                Vergi / TC Kimlik No
                <input
                  name="taxNumber"
                  value={formData.taxNumber}
                  onChange={handleInputChange}
                  className="mt-1 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-white"
                  maxLength={30}
                />
              </label>

              <div className="space-y-2 rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-4">
                <p className="text-sm font-semibold text-white">Klinik / Müşteri Logosu</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="w-full flex-1 cursor-pointer rounded-2xl border border-slate-700 px-4 py-3 text-center text-sm text-slate-300 transition hover:border-cyan-500 hover:text-white">
                    Logo Seç
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                  </label>
                  {logoPreview && (
                    <img
                      src={logoPreview}
                      alt="Logo önizleme"
                      className="h-20 w-20 rounded-2xl border border-slate-700 object-cover"
                    />
                  )}
                </div>
                <p className="text-[11px] text-slate-500">PNG, JPG veya SVG dosyası yükleyebilirsiniz.</p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800/60"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-2xl border border-emerald-400/40 bg-emerald-500/80 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


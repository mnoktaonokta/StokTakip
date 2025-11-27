'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api-client/client';
import type { Customer, Warehouse } from '@/types/api';

interface WarehouseFormProps {
  onCreated: (warehouse: Warehouse) => void;
}

export function WarehouseForm({ onCreated }: WarehouseFormProps) {
  const [isSubmitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const data = await apiFetch<Customer[]>('/api/customers');
        setCustomers(data);
      } catch (error) {
        console.error('Müşteri listesi alınamadı', error);
      }
    };
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    if (searchQuery.trim().length < 3) {
      return customers;
    }
    const normalized = searchQuery.trim().toLowerCase();
    return customers.filter((customer) => customer.name.toLowerCase().includes(normalized));
  }, [customers, searchQuery]);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!selectedCustomer) {
      toast.error('Önce müşteri seçmelisin');
      return;
    }
    if (selectedCustomer.warehouseId) {
      toast.error('Bu müşterinin zaten bir deposu var');
      return;
    }
    setSubmitting(true);
    try {
      const warehouse = await apiFetch<Warehouse>('/api/warehouses', {
        method: 'POST',
        body: {
          name: selectedCustomer.name,
          type: 'CUSTOMER',
          customerId: selectedCustomerId || undefined,
        },
      });
      toast.success('Depo oluşturuldu');
      setSelectedCustomerId('');
      setDropdownOpen(false);
      onCreated(warehouse);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Depo oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-lg font-semibold text-white">Yeni Depo</h2>
      <div className="space-y-2 text-sm text-slate-300">
        <p>Müşteri Seç</p>
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-left text-sm text-white"
        >
          {selectedCustomer ? selectedCustomer.name : 'Müşteri seçmek için tıklayın'}
          <span className="text-xs text-slate-400">{isDropdownOpen ? '▲' : '▼'}</span>
        </button>
        {isDropdownOpen && (
          <div className="max-h-64 space-y-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
            <div className="border-b border-slate-800 p-2">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Ara (en az 3 karakter)..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div className="max-h-44 overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-500">Eşleşen müşteri bulunamadı.</p>
              ) : (
                filteredCustomers.map((customer) => {
                  const disabled = Boolean(customer.warehouseId);
                  const isActive = selectedCustomerId === customer.id;
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return;
                        setSelectedCustomerId(customer.id);
                        setDropdownOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm text-white transition ${
                        isActive ? 'bg-cyan-500/10 text-cyan-200' : disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-900/80'
                      }`}
                    >
                      <span>{customer.name}</span>
                      {!customer.warehouseId ? (
                        <span className="text-xs text-emerald-300">Uygun</span>
                      ) : (
                        <span className="text-xs text-rose-300">Deposu var</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
        {selectedCustomer && (
          <p className="text-xs text-emerald-300">
            Seçilen müşteri: <span className="font-semibold">{selectedCustomer.name}</span>
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isSubmitting || !selectedCustomer || Boolean(selectedCustomer?.warehouseId)}
        className="w-full rounded-xl bg-emerald-500/80 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Oluşturuluyor...' : 'Depo Oluştur'}
      </button>
    </form>
  );
}




'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useApiMutation, useApiQuery } from '@/hooks/useApi';
import type { Customer, Transfer } from '@/types/api';

const invoiceSchema = z.object({
  customerId: z.string(),
  transferIds: z.array(z.string()).nonempty(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export function InvoiceForm() {
  const router = useRouter();
  const { data: customers } = useApiQuery<Customer[]>(['customers'], '/api/customers');
  const { data: transfers } = useApiQuery<Transfer[]>(['transfers'], '/api/transfers?limit=50');

  const pendingTransfers = useMemo(() => transfers?.filter((transfer) => transfer.status === 'PENDING') ?? [], [transfers]);

  const mutation = useApiMutation('/api/invoices', {
    onSuccess: () => {
      toast.success('Fatura hazırlandı');
      router.refresh();
      reset();
    },
    onError: (error) => toast.error(error.message),
  });

  const { register, handleSubmit, reset } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { transferIds: [] },
  });

  const onSubmit = handleSubmit((values) => {
    const items = values.transferIds
      .map((transferId) => pendingTransfers.find((transfer) => transfer.id === transferId))
      .filter(Boolean)
      .map((transfer) => ({
        productId: transfer!.lot.productId,
        lotId: transfer!.lot.id,
        quantity: transfer!.quantity,
        unitPrice: transfer!.lot.product.salePrice ?? 0,
      }));

    mutation.mutate({
      customerId: values.customerId,
      transferIds: values.transferIds,
      items,
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="text-xl font-semibold text-white">Fatura Oluştur</h2>

      <label className="text-sm text-slate-300">
        Müşteri
        <select
          {...register('customerId')}
          className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
        >
          <option value="">Müşteri seçiniz</option>
          {customers?.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
        <p className="text-sm font-medium text-slate-200">Transfer Seçin</p>
        <div className="max-h-64 space-y-2 overflow-y-auto pr-2">
          {pendingTransfers.map((transfer) => (
            <label key={transfer.id} className="flex items-center gap-3 rounded-xl border border-slate-800/60 px-3 py-2 text-sm">
              <input
                type="checkbox"
                value={transfer.id}
                {...register('transferIds')}
                className="size-4 rounded border-slate-700 bg-slate-900 text-cyan-400"
              />
              <div>
                <p className="text-white">{transfer.lot.product.name}</p>
                <p className="text-xs text-slate-500">
                  {transfer.quantity} adet • Lot {transfer.lot.lotNumber}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-2xl bg-emerald-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {mutation.isPending ? 'Gönderiliyor...' : 'Fatura Hazırla'}
      </button>
    </form>
  );
}

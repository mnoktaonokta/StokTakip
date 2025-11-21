'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useApiMutation, useApiQuery } from '@/hooks/useApi';
import type { ProductSummary, WarehouseWithStock } from '@/types/api';
import { BarcodeScanner } from '../barcode/BarcodeScanner';

const transferSchema = z.object({
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  productId: z.string(),
  lotId: z.string().optional(),
  quantity: z.coerce.number().int().positive(),
  barcode: z.string().optional(),
  notes: z.string().optional(),
});

type TransferFormValues = z.infer<typeof transferSchema>;

export function TransferForm() {
  const router = useRouter();
  const { data: products } = useApiQuery<ProductSummary[]>(['products'], '/api/products');
  const { data: warehouses } = useApiQuery<WarehouseWithStock[]>(['warehouses'], '/api/warehouses');
  const [barcode, setBarcode] = useState<string>();

  const mutation = useApiMutation('/api/transfers', {
    onSuccess: () => {
      toast.success('Transfer kaydedildi');
      router.refresh();
      reset();
    },
    onError: (error) => toast.error(error.message),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      quantity: 1,
      barcode: '',
    },
  });

  const selectedProductId = useWatch({
    control,
    name: 'productId',
  });
  const selectedProduct = useMemo(
    () => products?.find((product) => product.id === selectedProductId),
    [products, selectedProductId],
  );
  const lots = selectedProduct?.lots ?? [];

  useEffect(() => {
    if (!barcode || !selectedProduct) return;
    const match = selectedProduct.lots.find((lot) => lot.barcode === barcode);
    if (match) {
      setValue('lotId', match.id);
    }
  }, [barcode, selectedProduct, setValue]);

  const onSubmit = handleSubmit((values) => {
    mutation.mutate({ ...values, barcode });
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-xl font-semibold text-white">Transfer Bilgileri</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-300">
            Kaynak Depo
            <select
              {...register('fromWarehouseId')}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
            >
              <option value="">Seçiniz</option>
              {warehouses?.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-300">
            Hedef Depo
            <select
              {...register('toWarehouseId')}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
            >
              <option value="">Seçiniz</option>
              {warehouses?.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="text-sm text-slate-300">
          Ürün
          <select
            {...register('productId', {
              onChange: () => setValue('lotId', ''),
            })}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
          >
            <option value="">Ürün seçiniz</option>
            {products?.map((product) => (
              <option key={product.id} value={product.id}>
                {product.referenceCode} • {product.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          Lot
          <select
            {...register('lotId')}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
          >
            <option value="">Otomatik seç</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                Lot {lot.lotNumber} • {lot.quantity} adet
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-300">
            Adet
            <input
              type="number"
              min={1}
              {...register('quantity', { valueAsNumber: true })}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
            />
          </label>

          <label className="text-sm text-slate-300">
            Barkod
            <input
              value={barcode ?? ''}
              onChange={(event) => setBarcode(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
              placeholder="otomatik / manuel"
            />
          </label>
        </div>

        <label className="text-sm text-slate-300">
          Not
          <textarea
            {...register('notes')}
            rows={3}
            className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting || mutation.isPending}
          className="w-full rounded-2xl bg-cyan-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:opacity-60"
        >
          {mutation.isPending ? 'Kaydediliyor...' : 'Transfer Kaydet'}
        </button>
      </form>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-xl font-semibold text-white">iOS Barkod Tarama</h2>
        <p className="text-sm text-slate-400">Kamera izni vererek lotu otomatik seçebilirsiniz.</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800">
          <BarcodeScanner
            onDetected={(value) => {
              setBarcode(value);
              toast.success(`Barkod okundu: ${value}`);
            }}
          />
        </div>
      </div>
    </div>
  );
}

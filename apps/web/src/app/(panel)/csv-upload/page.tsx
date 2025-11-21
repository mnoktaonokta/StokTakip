import { CsvUploader } from '@/components/csv/CsvUploader';

export default function CsvUploadPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-slate-500">Toplu Stok</p>
        <h1 className="text-3xl font-semibold text-white">CSV ile Lot & Barkod Yükleme</h1>
        <p className="text-sm text-slate-400">
          Supabase veritabanına toplu ürün, lot, adet ve barkod aktarımı yapın. Format: reference_code,name,lot_number,quantity,barcode,expiry_date,sale_price,purchase_price
        </p>
      </div>

      <CsvUploader />
    </div>
  );
}

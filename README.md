# Dental İmplant Stok, Transfer, Barkod ve Faturalama Sistemi

Tam entegre stok, lot, barkod, müşteri depo ve e-fatura yönetimi için hazırlanan **Next.js + Express + Prisma + Supabase** projesi.

## Monorepo Yapısı

```
/apps
  /api      → Express + Prisma backend (Supabase/PostgreSQL)
  /web      → Next.js 16 App Router + Tailwind + Clerk + PWA
```

## Öne Çıkan Özellikler

- Lot bazlı stok & depo yönetimi, müşteri depoları ve bekleyen ürün mantığı
- Barkod okuma (ZXing) ile transfer oluşturma, otomatik lot seçimi, reverse transfer
- CSV ile toplu stok yükleme
- BizimHesap e-fatura API entegrasyonuna hazır invoice servisi
- Clerk/Dev mod destekli rol bazlı yetkilendirme, ayrıntılı loglama
- PWA (iOS kamera erişimi), React Query, Tailwind 4 tabanlı modern UI

## Başlangıç

```bash
cp .env.example .env
# Supabase bağlantısı, Clerk anahtarları ve BizimHesap API bilgilerini doldurun

npm install
npm run prisma:generate

# Backend
npm run dev:api

# Frontend
npm run dev:web
```

## Önemli Diziler

- `apps/api/prisma/schema.prisma` : Supabase modelleri
- `apps/api/src/routes/*` : Ürün, transfer, csv, log, fatura API uçları
- `apps/web/src/app/(panel)` : Dashboard, ürünler, depolar, transfer, müşteri, fatura, log ve CSV sayfaları
- `apps/web/src/components` : Barkod tarama, transfer formu, invoice formu vb.

## Geliştirme Notları

- Backend `x-user-role` header'ı üzerinden dev ortamında rol seçimine izin verir; üretimde Clerk zorunludur.
- Prisma v7 ile `prisma.config.ts` kullanılarak Supabase bağlantısı yönetilir.
- PWA için `manifest.ts`, `next-pwa` ve `getUserMedia` destekli barcode komponenti hazırdır.

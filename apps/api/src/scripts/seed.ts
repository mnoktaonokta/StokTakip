// apps/api/src/scripts/seed.ts
import { PrismaClient, WarehouseType, ActionType, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// Gerçekçi Dental Veri Seti (Senin excel yapına uygun)
const dentalProducts = [
  {
    ref: 'IMP-3510-S',
    name: 'Active Bone Level İmplant Ø3.5 L10mm',
    category: 'İmplant',
    price: 1850.00,
    lots: [
      { number: 'LOT-2023001', qty: 45, barcode: '868000111001', exp: '2027-05-20' },
      { number: 'LOT-2023002', qty: 12, barcode: '868000111002', exp: '2026-08-15' }
    ]
  },
  {
    ref: 'IMP-4012-S',
    name: 'Active Bone Level İmplant Ø4.0 L12mm',
    category: 'İmplant',
    price: 1950.00,
    lots: [
      { number: 'LOT-2023045', qty: 8, barcode: '868000111045', exp: '2027-01-10' } // Kritik stok (<10)
    ]
  },
  {
    ref: 'IMP-4510-S',
    name: 'Active Bone Level İmplant Ø4.5 L10mm',
    category: 'İmplant',
    price: 2050.00,
    lots: [
      { number: 'LOT-2023088', qty: 120, barcode: '868000111088', exp: '2028-03-01' },
      { number: 'LOT-2023099', qty: 50, barcode: '868000111099', exp: '2028-04-15' }
    ]
  },
  {
    ref: 'ABT-STR-GH2',
    name: 'Düz Abutment GH:2mm',
    category: 'Protez Parçası',
    price: 450.00,
    lots: [
      { number: 'LOT-ABT001', qty: 200, barcode: '868000222001', exp: null } // SKT yok
    ]
  },
  {
    ref: 'ABT-ANG-15',
    name: 'Açılı Abutment 15° GH:2mm',
    category: 'Protez Parçası',
    price: 550.00,
    lots: [
      { number: 'LOT-ANG055', qty: 5, barcode: '868000222055', exp: null } // Kritik stok
    ]
  },
  {
    ref: 'HB-45-30',
    name: 'İyileşme Başlığı Ø4.5 H3.0',
    category: 'Gingiva Şekillendirici',
    price: 250.00,
    lots: [
      { number: 'LOT-HB777', qty: 300, barcode: '868000333777', exp: null }
    ]
  }
];

async function main() {
  console.log('🌱 Veritabanı ekimi (Seed) başlatılıyor...');

  // 1. Admin Kullanıcısını Oluştur (Mevcut kodun)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@stoktakip.local' },
    create: { email: 'admin@stoktakip.local', name: 'Admin', role: UserRole.admin },
    update: {},
  });
  console.log('👤 Admin kontrol edildi:', admin.name);

  // 2. Ana Depoyu Oluştur
  const warehouse = await prisma.warehouse.upsert({
    where: { id: 'main-warehouse' },
    update: {},
    create: {
      id: 'main-warehouse',
      name: 'Merkez Depo',
      type: WarehouseType.MAIN,
    },
  });
  console.log('🏭 Depo Hazır:', warehouse.name);

  // 3. Ürünleri ve Lotları Döngü ile Ekle
  for (const p of dentalProducts) {
    const product = await prisma.product.upsert({
      where: { referenceCode: p.ref },
      update: {},
      create: {
        name: p.name,
        referenceCode: p.ref,
        salePrice: p.price,
        category: p.category,
      },
    });

    for (const l of p.lots) {
      // Lot var mı kontrol et, yoksa oluştur
      // Not: Lot tablosunda (productId + lotNumber) unique olmalı.
      // Eğer schema.prisma'da @@unique([productId, lotNumber]) varsa bu çalışır.
      const lot = await prisma.lot.upsert({
        where: { 
          productId_lotNumber: { productId: product.id, lotNumber: l.number } 
        },
        update: { quantity: l.qty }, // Miktar güncellensin
        create: {
          productId: product.id,
          lotNumber: l.number,
          quantity: l.qty,
          barcode: l.barcode,
          expiryDate: l.exp ? new Date(l.exp) : null,
        },
      });

      // Log kaydı at (Sisteme giriş hareketi)
      // Logları "create" yapıyoruz, çünkü her seed çalıştığında yeni log atması sorun değil, 
      // dashboard'da hareket görmek istiyoruz.
      await prisma.log.create({
        data: {
          actionType: ActionType.STOCK_IN,
          description: `Başlangıç Stoku: ${product.name} - Lot: ${l.number} (${l.qty} Adet)`,
          productId: product.id,
          lotId: lot.id,
          warehouseId: warehouse.id,
          timestamp: new Date(),
          // user ilişkisini opsiyonel yapmıştık schema'da, 
          // ama buraya admin id'sini bağlayabilirsin istersen:
          userId: admin.id 
        },
      });
    }
    console.log(`📦 ${product.name} işlendi.`);
  }

  console.log('✅ Seed işlemi başarıyla tamamlandı!');
}

main()
  .catch((e) => {
    console.error('❌ Seed hatası:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
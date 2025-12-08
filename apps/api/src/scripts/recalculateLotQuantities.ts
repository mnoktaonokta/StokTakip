import 'dotenv/config';

import { prisma } from '../lib/prisma';

async function recalculate() {
  const lots = await prisma.lot.findMany({
    select: {
      id: true,
      stockLocations: {
        select: {
          quantity: true,
        },
      },
    },
  });

  let updated = 0;

  for (const lot of lots) {
    const total = lot.stockLocations.reduce((sum, location) => sum + location.quantity, 0);
    await prisma.lot.update({
      where: { id: lot.id },
      data: { quantity: total },
    });
    updated += 1;
  }

  console.log(`🔄 Lot miktar senkronizasyonu tamamlandı. ${updated} lot güncellendi.`);
}

recalculate()
  .catch((error) => {
    console.error('Lot miktarları güncellenemedi:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


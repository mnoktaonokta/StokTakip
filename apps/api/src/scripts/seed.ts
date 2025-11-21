import { prisma } from '../lib/prisma';
import { WarehouseType, UserRole } from '@prisma/client';

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@stoktakip.local' },
    create: { email: 'admin@stoktakip.local', name: 'Admin', role: UserRole.admin },
    update: {},
  });

  await prisma.warehouse.upsert({
    where: { id: 'main-warehouse' },
    update: {},
    create: {
      id: 'main-warehouse',
      name: 'Ana Depo',
      type: WarehouseType.MAIN,
    },
  });

  console.log('Seed tamamlandı', { admin });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

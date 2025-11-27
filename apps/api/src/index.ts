require('dotenv').config({ path: '.env' });

import { createServer } from './server';
import { env } from './config/env';

const app = createServer();

app.listen(env.port, () => {
  console.log(`API server listening on http://localhost:${env.port}`);
});

app.get('/api/warehouses', async (req, res) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(warehouses);
  } catch (error) {
    console.error('Depo çekme hatası:', error);
    res.status(500).json({ error: 'Depolar yüklenemedi' });
  }
});
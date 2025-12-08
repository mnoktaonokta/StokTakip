require('dotenv').config({ path: '.env' });

import { createServer } from './server';
import { env } from './config/env';

const app = createServer();

// BURASI ÇOK ÖNEMLİ: Varsayılan 4000 olsun
const PORT = env.port || 4000;

// '0.0.0.0' YAZMAZSA TELEFON GÖREMEZ!
app.listen(PORT, '0.0.0.0', () => {
  console.log('================================================');
  console.log(`🚀 SUNUCU SIFIRDAN BAŞLADI!`);
  console.log(`📡 Adres: http://0.0.0.0:${PORT}`);
  console.log('================================================');
});
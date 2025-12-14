import cors from 'cors';
import morgan from 'morgan';
import { clerkClient } from '@clerk/express';
import { UserRole } from '@prisma/client';

import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { clerkAuthMiddleware, attachCurrentUser } from './middleware/auth';
import { requireAdmin, requireStaff } from './middleware/roleGuard';
import { syncMainWarehouseStock } from './services/stockService';
import { prisma } from './lib/prisma';

import productRouter from './routes/products';
import warehouseRouter from './routes/warehouses';
import transferRouter from './routes/transfers';
import invoiceRouter from './routes/invoices';
import customerRouter from './routes/customers';
import logRouter from './routes/logs';
import csvRouter from './routes/csv';
import lotRouter from './routes/lots';

export const createServer = () => {
  const app = express();

  // --- CORS (Production ready) ---
  app.use((req, res, next) => {
    const allowedOrigins = env.corsAllowedOrigins;
    const originHeader = req.headers.origin;

    // Server-side istekler (!originHeader), listedekiler veya brndental.online içerenler
    const isAllowed = !originHeader || allowedOrigins.includes(originHeader) || (originHeader && originHeader.includes('brndental.online'));

    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', originHeader || '*'); // Server-side için * veya gelen origin
    }
    
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  app.use(morgan('tiny'));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // ... (Geri kalan kodlar Cursor'daki ile aynıdır, sadece üstteki CORS kısmını değiştirmeniz yeterli)
  // Ancak garanti olsun diye CORS ayarını yukarıdaki gibi yaptığınızdan emin olun.
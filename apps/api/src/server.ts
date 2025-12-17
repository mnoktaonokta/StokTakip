import express, { json, urlencoded } from 'express';
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

    const isAllowed = !originHeader || allowedOrigins.includes(originHeader) || (originHeader && originHeader.includes('brndental.online'));

    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', originHeader || '*');
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
  // HATA ÇÖZÜMÜ: express.json() yerine direkt import edilen json() kullanıyoruz
  app.use(urlencoded({ extended: true }));
  app.use(json());

  // --- ROUTES (Eksik olan kısım burasıydı) ---
  app.use('/products', productRouter);
  app.use('/warehouses', warehouseRouter);
  app.use('/transfers', transferRouter);
  app.use('/invoices', invoiceRouter);
  app.use('/customers', customerRouter);
  app.use('/logs', logRouter);
  app.use('/csv', csvRouter);
  app.use('/lots', lotRouter);

  // --- Error Handler ---
  app.use(errorHandler);

  return app;
};
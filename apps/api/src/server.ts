import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { clerkAuthMiddleware, attachCurrentUser } from './middleware/auth';
import { syncMainWarehouseStock } from './services/stockService';

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

  syncMainWarehouseStock().catch((error) => {
    console.error('Ana depo stok senkronizasyonu başarısız:', error);
  });

  app.use(
    cors({
      origin: [env.appBaseUrl, 'http://localhost:3000', 'https://localhost:3000'],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.use(clerkAuthMiddleware);
  app.use(attachCurrentUser);

  app.get('/api/health', (_req, res) =>
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
  );

  app.use('/api/products', productRouter);
  app.use('/api/warehouses', warehouseRouter);
  app.use('/api/transfers', transferRouter);
  app.use('/api/invoices', invoiceRouter);
  app.use('/api/customers', customerRouter);
  app.use('/api/logs', logRouter);
  app.use('/api/csv', csvRouter);
  app.use('/api/lots', lotRouter);

  app.use(errorHandler);

  return app;
};

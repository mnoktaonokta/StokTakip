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
// import userRouter from './routes/users'; // Eğer users dosyası varsa bunu açarız, şimdilik dursun.

export const createServer = () => {
  const app = express();

  // --- CORS ---
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
  app.use(urlencoded({ extended: true }));
  app.use(json());

  // --- ROUTES (DÜZELTME: Başına /api eklendi) ---
  app.use('/api/products', productRouter);
  app.use('/api/warehouses', warehouseRouter);
  app.use('/api/transfers', transferRouter);
  app.use('/api/invoices', invoiceRouter);
  app.use('/api/customers', customerRouter);
  app.use('/api/logs', logRouter);
  app.use('/api/csv', csvRouter);
  app.use('/api/lots', lotRouter);
  
  // Not: Loglarda '/api/users/me' hatası da vardı. Eğer user router'ınız varsa onu da eklemeliyiz.
  // Ama şimdilik ürünleri ve depolara odaklanalım.

  app.use(errorHandler);

  return app;
};
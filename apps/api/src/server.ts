import express from 'express';
// import cors from 'cors'; // Kapalı
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

  // --- CORS (Production-ready) ---
  app.use((req, res, next) => {
    const allowedOrigins = env.corsAllowedOrigins;
    const originHeader = req.headers.origin;
    const isDev = env.nodeEnv !== 'production';

    const isAllowed =
      allowedOrigins.length === 0
        ? isDev // dev'de boşsa serbest
        : originHeader && allowedOrigins.includes(originHeader);

    if (isAllowed && originHeader) {
      res.setHeader('Access-Control-Allow-Origin', originHeader);
    } else if (allowedOrigins.length === 0 && isDev) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-user-role, x-user-id, X-Requested-With, Accept, Origin',
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      if (!isAllowed && !(allowedOrigins.length === 0 && isDev)) {
        return res.status(403).end();
      }
      return res.status(200).end();
    }

    if (!isAllowed && !(allowedOrigins.length === 0 && isDev)) {
      return res.status(403).json({ message: 'CORS forbidden' });
    }

    next();
  });

  syncMainWarehouseStock().catch((error) => {
    console.error('Ana depo stok senkronizasyonu başarısız:', error);
  });

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

  // --- AUTHENTICATED ROUTES ---
  app.use(clerkAuthMiddleware);
  app.use(attachCurrentUser);

  // Me: oturum bilgisi
  app.get('/api/users/me', requireStaff, async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.currentUser?.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canManageStock: true,
        canCreateInvoices: true,
        canManageProducts: true,
      },
    });
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    return res.json(user);
  });

  // Admin: kullanıcı yönetimi
  app.get('/api/admin/users', requireAdmin, async (_req, res) => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          canManageStock: true,
          canCreateInvoices: true,
          canManageProducts: true,
        },
      });
      res.json(users);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Kullanıcılar alınamadı' });
    }
  });

  app.post('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const { firstName, lastName, email, password, canManageStock, canCreateInvoices, canManageProducts } = req.body;
      const normalizedEmail = email.toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();

      const clerkUser = await clerkClient.users.createUser({
        emailAddress: [normalizedEmail],
        firstName,
        lastName,
        password,
      });

      const user = await prisma.user.upsert({
        where: { email: normalizedEmail },
        update: {
          name: fullName,
          role: UserRole.employee,
          canManageStock: Boolean(canManageStock),
          canCreateInvoices: Boolean(canCreateInvoices),
          canManageProducts: Boolean(canManageProducts),
        },
        create: {
          email: normalizedEmail,
          name: fullName,
          role: UserRole.employee,
          canManageStock: Boolean(canManageStock),
          canCreateInvoices: Boolean(canCreateInvoices),
          canManageProducts: Boolean(canManageProducts),
        },
      });

      res.json({ ...user, clerkUserId: clerkUser.id });
    } catch (e: any) {
      console.error(e);
      let message = e.errors?.[0]?.message || 'Kullanıcı oluşturulamadı';

      if (message.includes('Password has been found in an online data breach')) {
        message = 'Bu şifre güvensiz bulundu (veri sızıntılarında yer alıyor). Lütfen daha güçlü bir şifre seçin.';
      } else if (message.includes('Password must be at least 8 characters')) {
        message = 'Şifre en az 8 karakter olmalıdır.';
      } else if (message.includes('is invalid')) {
        message = 'Geçersiz veri girişi (E-posta formatını kontrol edin).';
      } else if (message.includes('already exists')) {
        message = 'Bu e-posta adresiyle zaten bir kullanıcı mevcut.';
      }

      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/admin/users/:id/permissions', requireAdmin, async (req, res) => {
    try {
      const { canManageStock, canCreateInvoices, canManageProducts } = req.body;
      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: {
          ...(canManageStock !== undefined ? { canManageStock } : {}),
          ...(canCreateInvoices !== undefined ? { canCreateInvoices } : {}),
          ...(canManageProducts !== undefined ? { canManageProducts } : {}),
        },
      });
      res.json(user);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Yetki güncellenemedi' });
    }
  });

  app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!user) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      }

      try {
        const clerkUsers = await clerkClient.users.getUserList({ emailAddress: [user.email], limit: 1 });
        const target = Array.isArray(clerkUsers?.data) ? clerkUsers.data[0] : undefined;
        if (target?.id) {
          await clerkClient.users.deleteUser(target.id);
        }
      } catch (clerkError) {
        console.warn('Clerk kullanıcı silme uyarısı:', clerkError);
      }

      await prisma.user.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Kullanıcı silinemedi' });
    }
  });

  // Firma Bilgisi
  app.get('/api/admin/company', requireAdmin, async (_req, res) => {
    try {
      const company = await prisma.companyInfo.findFirst({ orderBy: { createdAt: 'asc' } });
      res.json(company);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Firma bilgisi alınamadı' });
    }
  });

  app.put('/api/admin/company', requireAdmin, async (req, res) => {
    try {
      const { tradeName, address, phone, taxNumber, taxOffice, bankAccount } = req.body;
      const existing = await prisma.companyInfo.findFirst({ orderBy: { createdAt: 'asc' } });
      const data = { tradeName, address, phone, taxNumber, taxOffice, bankAccount };

      const company = existing
        ? await prisma.companyInfo.update({ where: { id: existing.id }, data })
        : await prisma.companyInfo.create({ data });

      res.json(company);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Firma bilgisi kaydedilemedi' });
    }
  });

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

import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';

import { env } from '../config/env';

const { csvUploaderUserId, stockManagerUserIds } = env;

const ensureUserContext = (req: Request, fallbackId?: string) => {
  if (!req.currentUser && fallbackId) {
    req.currentUser = {
      id: fallbackId,
      role: UserRole.admin,
      name: 'System User',
      email: undefined,
    };
  }
};

const isUserAllowed = (req: Request, allowedIds: string[]) => {
  const headerUserId = req.header('x-user-id');
  const candidates = [headerUserId, req.currentUser?.id].filter((id): id is string => Boolean(id));
  return candidates.some((id) => allowedIds.includes(id));
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.currentUser || req.currentUser.role !== UserRole.admin) {
    return res.status(403).json({ message: 'Sadece admin bu işlemi yapabilir' });
  }
  return next();
};

export const requireCsvUploader = (req: Request, res: Response, next: NextFunction) => {
  if (!csvUploaderUserId) {
    return res.status(403).json({ message: 'CSV yükleme yetkilisi tanımlı değil' });
  }

  if (!isUserAllowed(req, [csvUploaderUserId])) {
    return res.status(403).json({ message: 'Sadece yetkili kullanıcı dosya yükleyebilir' });
  }

  ensureUserContext(req, req.header('x-user-id') ?? csvUploaderUserId);

  return next();
};

export const requireStockManager = (req: Request, res: Response, next: NextFunction) => {
  if (req.currentUser?.role === UserRole.admin) {
    return next();
  }

  if (stockManagerUserIds.length === 0) {
    return res.status(403).json({ message: 'Stok yöneticisi tanımlı değil' });
  }

  if (!isUserAllowed(req, stockManagerUserIds)) {
    return res.status(403).json({ message: 'Stok düzenleme yetkiniz yok' });
  }

  ensureUserContext(req, req.header('x-user-id') ?? stockManagerUserIds[0]);

  return next();
};

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
  if (!req.currentUser) {
    return res.status(401).json({ message: 'Oturum bulunamadı' });
  }

  if (req.currentUser.role !== UserRole.admin) {
    return res.status(403).json({ message: 'Sadece admin bu işlemi yapabilir' });
  }

  return next();
};

export const requireStaff = (req: Request, res: Response, next: NextFunction) => {
  if (!req.currentUser) {
    return res.status(401).json({ message: 'Oturum bulunamadı' });
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
  if (!req.currentUser) {
    return res.status(401).json({ message: 'Oturum bulunamadı' });
  }

  // Admin her zaman yetkilidir
  if (req.currentUser.role === UserRole.admin) {
    return next();
  }

  // Yeni model: Kullanıcının DB üzerinde canManageStock bayrağı olmalı
  if (req.currentUser.canManageStock) {
    return next();
  }

  // Eski modelle geriye dönük uyumluluk: ENV üzerinden tanımlı stok yöneticileri
  if (stockManagerUserIds.length > 0 && isUserAllowed(req, stockManagerUserIds)) {
    ensureUserContext(req, req.header('x-user-id') ?? stockManagerUserIds[0]);
    return next();
  }

  return res.status(403).json({ message: 'Stok düzenleme yetkiniz yok' });
};

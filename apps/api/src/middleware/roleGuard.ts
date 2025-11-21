import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.currentUser || req.currentUser.role !== UserRole.admin) {
    return res.status(403).json({ message: 'Sadece admin bu işlemi yapabilir' });
  }
  return next();
};

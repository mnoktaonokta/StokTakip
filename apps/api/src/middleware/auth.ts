import { clerkMiddleware } from '@clerk/express';
import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';

import { prisma } from '../lib/prisma';

// GÜNCELLEME: Eski fonksiyon yerine yeni middleware kullanıldı
export const clerkAuthMiddleware = clerkMiddleware();

const FALLBACK_EMAIL = 'dev@stoktakip.local';

const getRoleFromHeader = (req: Request): UserRole => {
  const header = (req.header('x-user-role') ?? 'employee').toLowerCase();
  return header === 'admin' ? UserRole.admin : UserRole.employee;
};

export const attachCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const emailFromHeader = req.header('x-user-email');
    const nameFromHeader = req.header('x-user-name');

    // Clerk auth objesi var mı ve kullanıcı giriş yapmış mı kontrolü
    if (req.auth?.userId) {
      const email =
        (req.auth.sessionClaims?.email as string | undefined) ??
        emailFromHeader ??
        `${req.auth.userId}@stoktakip.app`;

      const user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name: (req.auth.sessionClaims?.fullName as string | undefined) ?? nameFromHeader ?? 'Clerk User',
          role:
            ((req.auth.sessionClaims?.role as string | undefined)?.toLowerCase() as UserRole | undefined) ??
            getRoleFromHeader(req),
        },
        update: {
          name: (req.auth.sessionClaims?.fullName as string | undefined) ?? nameFromHeader ?? undefined,
        },
      });

      req.currentUser = { id: user.id, email: user.email, name: user.name, role: user.role };
      return next();
    }

    // Production ortamında giriş yapılmamışsa hata ver
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ message: 'Yetkilendirme başarısız' });
    }

    // Development ortamı için "Fallback" (Yedek) kullanıcı mantığı
    const fallbackUser = await prisma.user.upsert({
      where: { email: emailFromHeader ?? FALLBACK_EMAIL },
      create: {
        email: emailFromHeader ?? FALLBACK_EMAIL,
        name: nameFromHeader ?? 'Dev Admin',
        role: getRoleFromHeader(req),
      },
      update: {
        name: nameFromHeader ?? undefined,
        role: getRoleFromHeader(req),
      },
    });

    req.currentUser = {
      id: fallbackUser.id,
      email: fallbackUser.email,
      name: fallbackUser.name,
      role: fallbackUser.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};
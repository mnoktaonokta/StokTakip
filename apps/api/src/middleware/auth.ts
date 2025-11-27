import { clerkClient, clerkMiddleware } from '@clerk/express';
import { PrismaClient, UserRole } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

const prisma = new PrismaClient();

// 1. Clerk Middleware: Token doğrulamasını yapar
export const clerkAuthMiddleware = clerkMiddleware({
  publishableKey: env.clerkPublishableKey,
  secretKey: env.clerkSecretKey,
});

// 2. Kullanıcı Eşitleme: Clerk'ten gelen veriyi veritabanımızla senkronize eder
type AuthState =
  | {
      userId: string;
      sessionClaims?: Record<string, unknown>;
    }
  | undefined
  | null;

const resolveAuthState = (req: Request): AuthState => {
  const rawAuth = (req as any).auth;
  if (!rawAuth) return undefined;
  return typeof rawAuth === 'function' ? rawAuth() : rawAuth;
};

export const attachCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authState = resolveAuthState(req);

    // Token yoksa (Anonim istek) devam et, yetki hatasını route handler verir
    if (!authState?.userId) {
      console.warn('🎫 Token Durumu: YOK – frontend Auth header göndermiyor.');
      return next();
    }

    const { userId, sessionClaims } = authState;
    
    // Clerk'ten gelen bilgileri alalım
    let email = sessionClaims?.email as string | undefined;
    let name = sessionClaims?.fullName as string | undefined;

    // Eğer Token içinde e-posta yoksa (Clerk varsayılanı), API'den çekmeye çalış
    if (!email) {
        try {
            const clerkUser = await clerkClient.users.getUser(userId);
            email = clerkUser.emailAddresses[0]?.emailAddress;
            name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || name;
        } catch (apiError) {
            console.error('Clerk API kullanıcı çekme hatası:', apiError);
        }
    }

    // Hala email yoksa fallback kullan (Sistemin kilitlenmemesi için)
    if (!email) {
        console.warn(`⚠️ Kullanıcı (${userId}) için e-posta bulunamadı.`);
        console.warn('🎫 Token Durumu: VAR fakat email okunamadı. Clerk key/claim ayarlarını kontrol et.');
        return next();
    }

    // Email'i normalize et (Küçük harf)
    const normalizedEmail = email.toLowerCase();

    console.log(`🔍 Auth Kontrolü: ${normalizedEmail} (ClerkID: ${userId})`);

    // Veritabanında kullanıcıyı bulmaya çalış veya oluştur
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: { name }, // İsim güncelse yenile
      create: {
        email: normalizedEmail,
        name: name || 'Kullanıcı',
        // 'admin' kelimesi içeren mailleri otomatik admin yap (Geliştirme kolaylığı)
        role: normalizedEmail.includes('admin') ? UserRole.admin : UserRole.employee,
      },
    });

    // Request nesnesine "currentUser"ı ekle
    (req as any).currentUser = user;
    console.log(`✅ Yetkilendirildi: ${user.name} - Rol: ${user.role}`);

    next();
  } catch (error) {
    console.error('❌ Clerk/DB eşitleme sırasında hata:', error);
    console.error('🎫 Token Durumu: VAR ama 👤 Clerk Auth: Bulunamadı -> Secret Key / Clerk ayarlarını doğrula.');
    next();
  }
};
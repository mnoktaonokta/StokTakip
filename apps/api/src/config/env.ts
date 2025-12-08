// apps/api/src/config/env.ts

// import * as dotenv from 'dotenv';

// Çevre değişkenlerini uygulama başlamadan yüklüyoruz
// dotenv.config();

// --- Gerekli/Önerilen Değişkenler ---
const requiredVars = ['DATABASE_URL', 'CLERK_SECRET_KEY'];

requiredVars.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[env] WARNING: Missing required variable ${key}. Check apps/api/.env file.`);
  }
});

const defaultCsvUploaderUserId = process.env.CSV_UPLOADER_USER_ID ?? 'user_35nxaESVVF7clNFwJgOVcU3xHW2';
const parseList = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const adminEmailsRaw = (process.env.ADMIN_EMAILS ?? '').toLowerCase();

export const env = {
  // --- Ortak Ayarlar ---
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? process.env.PORT ?? 4000),
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  corsAllowedOrigins: parseList(process.env.CORS_ALLOWED_ORIGIN ?? process.env.CORS_ALLOWED_ORIGINS ?? ''),

  // --- Veritabanı (Supabase/Prisma) ---
  databaseUrl: process.env.DATABASE_URL ?? '',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',

  // --- CLERK Ayarları (AUTHENTICATION) ---
  clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY ?? '',
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? '',

  // --- Entegrasyon (FATURA) ---
  bizimHesapApiUrl: process.env.BIZIMHESAP_API_URL ?? 'https://bizimhesap.com/api/b2b',
  bizimHesapApiKey: process.env.BIZIMHESAP_API_KEY ?? '',
  bizimHesapFirmId: process.env.BIZIMHESAP_FIRM_ID ?? '',

  // --- Yetki bypass (DEV) ---
  csvUploaderUserId: defaultCsvUploaderUserId,
  stockManagerUserIds: parseList(process.env.STOCK_MANAGER_USER_IDS ?? defaultCsvUploaderUserId),
  // Admin olarak işaretlenecek e-posta adresleri (virgülle ayrılmış)
  adminEmails: parseList(adminEmailsRaw),
};
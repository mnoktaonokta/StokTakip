import * as dotenv from 'dotenv';

dotenv.config();

const requiredVars = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

requiredVars.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[env] Missing recommended variable ${key}`);
  }
});

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? '',
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? '',
  bizimHesapApiUrl: process.env.BIZIMHESAP_API_URL ?? 'https://api.bizimhesap.com/v2',
  bizimHesapApiKey: process.env.BIZIMHESAP_API_KEY ?? '',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
};

import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppProviders } from './providers';

const assistant = localFont({
  display: 'swap',
  variable: '--font-assistant',
  src: [
    { path: '../../public/fonts/corona/Assistant/Assistant-Light.woff2', weight: '300', style: 'normal' },
    { path: '../../public/fonts/corona/Assistant/Assistant-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/corona/Assistant/Assistant-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/corona/Assistant/Assistant-Bold.woff2', weight: '700', style: 'normal' },
  ],
});

const rubik = localFont({
  display: 'swap',
  variable: '--font-rubik',
  src: [
    { path: '../../public/fonts/corona/Rubik/Rubik-Light.ttf', weight: '300', style: 'normal' },
    { path: '../../public/fonts/corona/Rubik/Rubik-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/corona/Rubik/Rubik-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../../public/fonts/corona/Rubik/Rubik-Bold.ttf', weight: '700', style: 'normal' },
  ],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Stok Takip | Dental İmplant Platformu',
  description:
    'Barkod destekli dental implant stok, transfer, lot ve faturalama yönetimi. Supabase + Prisma + Clerk + PWA.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="bg-background text-foreground">
      <body className={`${assistant.variable} ${rubik.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

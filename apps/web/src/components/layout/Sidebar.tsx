'use client';

import clsx from 'clsx';
import {
  FileText,
  Gauge,
  History,
  Layers,
  PackageCheck,
  Repeat2,
  UploadCloud,
  Users,
  Warehouse,
  Settings2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useApiQuery } from '@/hooks/useApi';
import type { CurrentUser } from '@/types/api';

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const {
    data: currentUser,
    isLoading: loadingUser,
  } = useApiQuery<CurrentUser>(['current-user'], '/api/users/me', {
    retry: 0,
    staleTime: 60_000,
  });
  const showSettings = currentUser?.role === 'admin';

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: Gauge },
    { href: '/products', label: 'Ürünler', icon: PackageCheck },
    { href: '/warehouses', label: 'Depolar', icon: Warehouse },
    { href: '/transfers', label: 'Transfer', icon: Repeat2 },
    { href: '/customers', label: 'Müşteriler', icon: Users },
    { href: '/invoices', label: 'Faturalar', icon: FileText },
    { href: '/logs', label: 'Log Kayıtları', icon: History },
    { href: '/csv-upload', label: 'CSV Import', icon: UploadCloud },
    ...(showSettings ? [{ href: '/settings', label: 'Ayarlar', icon: Settings2 } as const] : []),
  ];

  const containerClass = mobile
    ? 'flex h-full w-full flex-col bg-slate-950 px-4 py-6'
    : 'hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950/40 px-4 py-6 lg:flex';

  return (
    <aside className={containerClass}>
      <div className="flex items-center gap-2 pb-8 text-lg font-semibold tracking-tight">
        <Layers className="size-6 text-cyan-400" />
        Stok Takip
      </div>

      <nav className="space-y-1">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive
                  ? 'bg-cyan-500/10 text-cyan-300'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-white',
              )}
              onClick={onNavigate}
            >
              <Icon className="size-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

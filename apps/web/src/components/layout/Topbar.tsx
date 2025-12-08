'use client';

import { Menu, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ClerkLoaded } from '@clerk/nextjs';

import { Sidebar } from './Sidebar';

export function Topbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-md border border-slate-800 p-2 text-slate-100"
        >
          <Menu className="size-4" />
        </button>
        <span className="text-sm font-semibold text-slate-200">Stok Takip</span>
        <div className="rounded-full border border-slate-800 p-2">
          <UserRound className="size-4 text-slate-300" />
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur">
          <div className="h-full w-72 shadow-2xl">
            <ClerkLoaded>
              <Sidebar mobile onNavigate={() => setOpen(false)} />
            </ClerkLoaded>
          </div>
        </div>
      ) : null}
    </>
  );
}

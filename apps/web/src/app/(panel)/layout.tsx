import { ClerkLoaded } from '@clerk/nextjs';

import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-slate-950 text-slate-100">
      <ClerkLoaded>
        <Sidebar />
      </ClerkLoaded>
      <div className="flex w-full flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

import { InvoicesScreen } from '@/components/invoices/InvoicesScreen';
import { apiFetch as apiFetchServer } from '@/lib/api-client/server';
import type { Invoice } from '@/types/api';

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function InvoicesPage({ searchParams }: PageProps) {
  const invoices = await apiFetchServer<Invoice[]>('/api/invoices');
  const params = await searchParams;
  const initialMode = params?.mode === 'builder' ? 'builder' : 'list';
  return <InvoicesScreen invoices={invoices} initialMode={initialMode} />;
}

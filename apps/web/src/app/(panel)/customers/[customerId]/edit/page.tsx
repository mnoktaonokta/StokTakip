import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ customerId: string }>;
}

export default async function CustomerEditRedirect({ params }: PageProps) {
  const { customerId } = await params;
  redirect(`/customers/${customerId}`);
}


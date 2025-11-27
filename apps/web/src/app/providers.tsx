'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useEffect, useState } from 'react';
import { Toaster } from 'sonner';

import { setClientTokenGetter } from '@/lib/clerk-client';

function ProvidersWithAuth({ children }: PropsWithChildren) {
  const { getToken } = useAuth();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            gcTime: 1000 * 60 * 60,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
          },
        },
      }),
  );

  // DEBUG: Anahtarı konsola yazdırıp kontrol edelim
  useEffect(() => {
    setClientTokenGetter(() => getToken());
    return () => setClientTokenGetter(null);
  }, [getToken]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors theme="dark" />
    </QueryClientProvider>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  console.log('🔑 Clerk Key:', clerkKey); 

  return (
    // publishableKey prop'unu eğer env'den gelmiyorsa manuel string olarak da deneyebilirsin
    <ClerkProvider publishableKey={clerkKey}>
      <ProvidersWithAuth>{children}</ProvidersWithAuth>
    </ClerkProvider>
  );
}
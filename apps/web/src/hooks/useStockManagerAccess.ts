'use client';

import { useApiQuery } from '@/hooks/useApi';
import type { CurrentUser } from '@/types/api';

export const useStockManagerAccess = () => {
  const { data } = useApiQuery<CurrentUser>(['current-user'], '/api/users/me', {
    // Eğer hata alırsak (ör. oturum yoksa) sessizce false dönelim
    retry: 0,
  });

  const canEditStock = Boolean(data && (data.role === 'admin' || data.canManageStock));

  return {
    canEditStock,
    userId: data?.id,
  };
};

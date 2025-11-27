'use client';

import { useAuth } from '@clerk/nextjs';

import { DEV_USER_ID, hasStockManagerAccess } from '@/lib/api-client';

export const useStockManagerAccess = () => {
  const { userId } = useAuth();
  const effectiveUserId = userId ?? DEV_USER_ID;
  const canEditStock = hasStockManagerAccess(effectiveUserId);

  return {
    canEditStock,
    userId: effectiveUserId,
  };
};




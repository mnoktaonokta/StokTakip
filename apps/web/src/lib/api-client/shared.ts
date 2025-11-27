export const API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? 'http://localhost:4000';
export const DEV_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID ?? 'user_35nxaESVVF7clNFwJgOVcU3xHW2';
const rawStockManagers =
  process.env.NEXT_PUBLIC_STOCK_MANAGER_USER_IDS ?? process.env.NEXT_PUBLIC_DEV_USER_ID ?? DEV_USER_ID;
export const STOCK_MANAGER_USER_IDS = rawStockManagers
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

export const hasStockManagerAccess = (userId?: string) => {
  const id = userId ?? DEV_USER_ID;
  return STOCK_MANAGER_USER_IDS.includes(id);
};

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  query?: Record<string, string | number | boolean | undefined>;
  body?: RequestInit['body'] | Record<string, unknown>;
}


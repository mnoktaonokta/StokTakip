'use client';

import { getClientToken } from '@/lib/clerk-client';

import type { ApiOptions } from './shared';
import { API_URL, DEV_USER_ID } from './shared';

export async function apiFetch<TResponse>(path: string, options: ApiOptions = {}): Promise<TResponse> {
  const url = new URL(path, API_URL);
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  const { headers: customHeaders = {}, body: rawBody, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && rawBody instanceof FormData;

  const defaultHeaders: Record<string, string> = {};
  const authToken = await getClientToken();
  if (authToken) {
    defaultHeaders.Authorization = `Bearer ${authToken}`;
  }

  if (!isFormData) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const headers = {
    ...defaultHeaders,
    ...customHeaders,
  };

  const body =
    rawBody === undefined
      ? undefined
      : isFormData
        ? rawBody
        : typeof rawBody === 'string'
          ? rawBody
          : JSON.stringify(rawBody);

  const response = await fetch(url.toString(), {
    ...rest,
    headers,
    body,
    cache: 'no-store',
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'API isteği başarısız');
  }

  return response.json() as Promise<TResponse>;
}



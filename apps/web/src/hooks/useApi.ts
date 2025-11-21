'use client';

import { useMutation, useQuery, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';

import { apiFetch } from '../lib/api-client';

export const useApiQuery = <TData>(
  key: string[],
  path: string,
  options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>,
) => {
  return useQuery({
    queryKey: key,
    queryFn: () => apiFetch<TData>(path),
    ...options,
  });
};

export const useApiMutation = <TResponse, TVariables = unknown>(
  path: string,
  options?: UseMutationOptions<TResponse, Error, TVariables>,
) => {
  return useMutation<TResponse, Error, TVariables>({
    mutationFn: (variables) =>
      apiFetch<TResponse>(path, {
        method: 'POST',
        body: variables as BodyInit,
      }),
    ...options,
  });
};

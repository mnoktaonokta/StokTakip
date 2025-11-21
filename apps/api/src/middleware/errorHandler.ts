import type { NextFunction, Request, Response } from 'express';

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api:error]', err);
  const message = err instanceof Error ? err.message : 'Beklenmeyen bir hata oluştu';
  return res.status(500).json({ message });
};

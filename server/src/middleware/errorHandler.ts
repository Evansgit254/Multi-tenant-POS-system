import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  err: Error & { status?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error(err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'A record with this value already exists.' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Record not found.' });
      return;
    }
  }

  const status = err.status ?? 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
};

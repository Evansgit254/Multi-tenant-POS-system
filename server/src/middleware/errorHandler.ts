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
  // L-12 FIX: In production, replace internal 500 messages with a safe generic string
  // to prevent leaking Prisma internals, table names, or stack traces to clients
  const message = (process.env.NODE_ENV === 'production' && status === 500)
    ? 'An unexpected error occurred. Please try again or contact support.'
    : (err.message || 'Internal server error');
  res.status(status).json({ error: message });
};

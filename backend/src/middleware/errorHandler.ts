import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  logger.error(err.message, { stack: err.stack });
  const status = (err as NodeJS.ErrnoException & { status?: number }).status || 500;
  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'Route not found' });
};

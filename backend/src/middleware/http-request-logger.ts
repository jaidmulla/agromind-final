import { Request, Response, NextFunction } from 'express';
import { persistApplicationLog } from '../utils/log-store';

const SKIP_PATHS = new Set(['/health', '/api/v1/health']);

export function httpRequestLogger(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.has(req.path)) {
    next();
    return;
  }
  if (req.method === 'GET' && (req.path.startsWith('/uploads') || req.path.endsWith('.ico'))) {
    next();
    return;
  }

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    persistApplicationLog({
      source: 'http',
      level,
      message: `${req.method} ${req.originalUrl || req.url} ${status}`,
      meta: {
        query_keys: Object.keys(req.query || {}),
      },
      method: req.method,
      path: req.originalUrl || req.url || '',
      status_code: status,
      duration_ms: duration,
      ip: req.ip || req.socket.remoteAddress || undefined,
      user_agent: req.get('user-agent') || undefined,
    });
  });
  next();
}

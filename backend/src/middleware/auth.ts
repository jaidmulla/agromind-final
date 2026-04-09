import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../utils/database';

export interface AuthRequest extends Request {
  user?: { id: string; email: string; name: string };
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    const result = await query('SELECT id, email, name FROM users WHERE id = $1', [decoded.userId]);
    if (!result.rows.length) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }
    req.user = result.rows[0];
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

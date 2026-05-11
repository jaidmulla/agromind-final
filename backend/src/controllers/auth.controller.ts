import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../utils/database';
import { AuthRequest } from '../middleware/auth';
import { sendAlertToUser } from '../services/alert.service';
import logger from '../utils/logger';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

const signToken = (userId: string) =>
  jwt.sign({ userId }, getJwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
  });

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = req.body as Record<string, unknown>;
    const name = String(raw.name ?? '').trim();
    const email = String(raw.email ?? '').trim().toLowerCase();
    const password = String(raw.password ?? '');
    const phoneRaw = raw.phone != null && raw.phone !== '' ? String(raw.phone).trim() : '';
    const phone = phoneRaw || null;
    const location =
      raw.location != null && raw.location !== '' ? String(raw.location).trim() : null;
    const farm_size =
      raw.farm_size !== undefined && raw.farm_size !== null && raw.farm_size !== ''
        ? Number(raw.farm_size)
        : null;
    const latitude = raw.latitude !== undefined && raw.latitude !== null ? Number(raw.latitude) : null;
    const longitude = raw.longitude !== undefined && raw.longitude !== null ? Number(raw.longitude) : null;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, message: 'Name, email and password are required' });
      return;
    }
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }
    const hash = await bcrypt.hash(password, 12);
    const r = await query(
      `INSERT INTO users (name,email,password_hash,phone,location,latitude,longitude,farm_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id,name,email,phone,location,farm_size,latitude,longitude`,
      [name, email, hash, phone, location, latitude, longitude, farm_size]
    );
    const user = r.rows[0];
    await query(`INSERT INTO notification_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [user.id]);

    logger.info('User registered', {
      userId: user.id,
      email: user.email,
      hasPhone: !!phone,
      hasLocation: !!location,
    });

    // Send welcome alerts (SMS + Email + Push)
    const welcomeMessage = {
      title: 'Welcome to AgroMind AI+',
      body: `Hi ${user.name || 'Farmer'}, your AgroMind AI+ account is ready. Start by scanning a leaf image for instant disease detection.`,
      subject: 'Welcome to AgroMind AI+',
      phone: phone ?? undefined,
      email,
      pushTitle: 'Welcome to AgroMind AI+',
    };
    sendAlertToUser(welcomeMessage, user.id).catch(() => null);

    res.status(201).json({ success: true, data: { user, token: signToken(user.id) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = String((req.body as { email?: string })?.email ?? '').trim().toLowerCase();
    const password = String((req.body as { password?: string })?.password ?? '');
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password required' });
      return;
    }
    const r = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (!r.rows.length || !(await bcrypt.compare(password, r.rows[0].password_hash))) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }
    const { password_hash, ...user } = r.rows[0];
    logger.info('User login', { userId: user.id, email: user.email });
    res.json({ success: true, data: { user, token: signToken(user.id) } });
  } catch {
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query(
      `SELECT u.*, np.critical_alerts, np.warning_alerts, np.email_notifications, np.sms_notifications, np.nearby_farmer_alerts
       FROM users u LEFT JOIN notification_preferences np ON np.user_id = u.id
       WHERE u.id = $1`, [req.user!.id]
    );
    const { password_hash, ...user } = r.rows[0];
    res.json({ success: true, data: user });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const b = req.body as Record<string, unknown>;
    const name = b.name !== undefined ? String(b.name).trim() || null : null;
    const phone = b.phone !== undefined ? String(b.phone).trim() || null : null;
    const location = b.location !== undefined ? String(b.location).trim() || null : null;
    const language = b.language !== undefined ? String(b.language).trim() || null : null;
    const farm_size =
      b.farm_size !== undefined && b.farm_size !== null && b.farm_size !== ''
        ? Number(b.farm_size)
        : null;
    const latitude =
      b.latitude !== undefined && b.latitude !== null ? Number(b.latitude) : null;
    const longitude =
      b.longitude !== undefined && b.longitude !== null ? Number(b.longitude) : null;

    const r = await query(
      `UPDATE users SET name=COALESCE($1,name), phone=COALESCE($2,phone), location=COALESCE($3,location),
       farm_size=COALESCE($4,farm_size), language=COALESCE($5,language),
       latitude=COALESCE($6,latitude), longitude=COALESCE($7,longitude)
       WHERE id=$8 RETURNING id,name,email,phone,location,farm_size,language,latitude,longitude`,
      [name, phone, location, farm_size, language, latitude, longitude, req.user!.id]
    );
    logger.info('Profile updated', { userId: req.user!.id });
    res.json({ success: true, data: r.rows[0] });
  } catch {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { current_password, new_password } = req.body;
    const r = await query('SELECT password_hash FROM users WHERE id=$1', [req.user!.id]);
    const valid = await bcrypt.compare(current_password, r.rows[0].password_hash);
    if (!valid) { res.status(400).json({ success: false, message: 'Current password incorrect' }); return; }
    const hash = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user!.id]);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch {
    res.status(500).json({ success: false, message: 'Password change failed' });
  }
};

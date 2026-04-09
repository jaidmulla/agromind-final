import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../utils/database';
import otpService from '../services/otp.service';
import msg91 from '../integrations/msg91';
import logger from '../utils/logger';

// ────────────────────────────────────────────────────────────────────────────
// OTP Controller — Handle OTP send/verify endpoints
// ────────────────────────────────────────────────────────────────────────────

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

const generateToken = (userId: string) =>
  jwt.sign({ userId }, getJwtSecret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
  });

// ────────────────────────────────────────────────────────────────────────────
// OTP Controller — Handle OTP send/verify endpoints
// ────────────────────────────────────────────────────────────────────────────

export const sendOTP = async (req: Request, res: Response) => {
  try {
    const { phone, language = 'en' } = req.body;
    const phoneStr = typeof phone === 'string' ? phone : String(phone);

    // Validate phone number (10 digits)
    if (!phoneStr || !/^\d{10}$/.test(phoneStr)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit phone number.',
      });
    }

    // Validate language code
    const validLanguages = ['en', 'hi', 'mr', 'ta', 'te', 'kn', 'gu', 'bn', 'pa'];
    const selectedLanguage = validLanguages.includes(language) ? language : 'en';

    // Check rate limiting (1 OTP per 60 seconds)
    if (await otpService.isRateLimited(phoneStr)) {
      return res.status(429).json({
        success: false,
        message: 'Please wait 60 seconds before requesting another OTP.',
      });
    }

    // Check if blocked due to multiple attempts
    if (await otpService.isBlocked(phoneStr)) {
      const remaining = await otpService.getBlockedTimeRemaining(phoneStr);
      return res.status(429).json({
        success: false,
        message: `Too many attempts. Try again in ${Math.ceil(remaining / 60)} minutes.`,
      });
    }

    // Generate and send OTP
    const { otp, success, message } = await otpService.sendOTP(phoneStr);

    if (!success) {
      return res.status(400).json({ success: false, message });
    }

    // Send OTP via MSG91 SMS
    const smsResult = await msg91.sendOTPViaMSG91(phoneStr, otp, selectedLanguage);

    if (!smsResult.success) {
      logger.warn(`Failed to send SMS for phone ${phoneStr}, but OTP is stored in Redis`);
    }

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${phoneStr}. Valid for 5 minutes.`,
      expiresIn: 300, // 5 minutes in seconds
    });
  } catch (error) {
    logger.error('Error in sendOTP controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.',
    });
  }
};

/**
 * POST /api/otp/verify
 * Verify OTP and issue JWT token (login or auto-register)
 */
export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const {
      phone,
      otp,
      fullName = null,
      village = null,
      state = null,
      latitude = null,
      longitude = null,
      language = 'en',
    } = req.body;

    const phoneStr = typeof phone === 'string' ? phone : String(phone);
    const otpStr = typeof otp === 'string' ? otp : String(otp);

    // Validate inputs
    if (!phoneStr || !/^\d{10}$/.test(phoneStr)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit phone number.',
      });
    }

    if (!otpStr || !/^\d{6}$/.test(otpStr)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit OTP.',
      });
    }

    // Verify OTP against Redis hash
    const otpResult = await otpService.verifyOTP(phoneStr, otpStr);

    if (!otpResult.success) {
      const statusCode = otpResult.blocked ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        message: otpResult.message,
      });
    }

    // OTP verified, now check if user exists
    const userQuery = 'SELECT id, name, phone, latitude, longitude, language FROM users WHERE phone = $1 LIMIT 1';
    const userResult = await query(userQuery, [phoneStr]);

    let user;
    if (userResult.rows.length > 0) {
      // User exists, update phone_verified flag
      user = userResult.rows[0];
      await query('UPDATE users SET phone_verified = true, updated_at = NOW() WHERE id = $1', [user.id]);
    } else {
      // New user — auto-register if fullName provided
      if (!fullName) {
        return res.status(400).json({
          success: false,
          message: 'Full name is required for new registration.',
        });
      }

      // Validate name (min 2 chars, letters + spaces only)
      const nameRegex = /^[a-zA-Z\s]{2,}$/;
      if (!nameRegex.test(fullName)) {
        return res.status(400).json({
          success: false,
          message: 'Name must be at least 2 characters and contain only letters and spaces.',
        });
      }

      // Create new user
      const insertQuery = `
        INSERT INTO users (name, phone, village, state, latitude, longitude, language, phone_verified, email, password_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)
        RETURNING id, name, phone, village, state, latitude, longitude, language
      `;

      // Generate dummy email and password hash (not used for OTP auth, but required by schema)
      const dummyEmail = `user_${phoneStr}@krishiseva.local`;
      const dummyHash = 'otp_auth_no_password'; // Dummy value

      const insertResult = await query(insertQuery, [
        fullName,
        phoneStr,
        village || null,
        state || null,
        latitude || null,
        longitude || null,
        language || 'en',
        dummyEmail,
        dummyHash,
      ]);

      user = insertResult.rows[0];
      logger.info(`New user created via OTP auth: ${user.id}`);
    }

    // Generate JWT token
    const token = generateToken(user.id);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        language: user.language || 'en',
        latitude: user.latitude,
        longitude: user.longitude,
      },
    });
  } catch (error) {
    logger.error('Error in verifyOTP controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP. Please try again.',
    });
  }
};

/**
 * GET /api/otp/status/:phone
 * Get OTP status (for development/debugging)
 */
export const getOTPStatus = async (req: Request, res: Response) => {
  try {
    const phone = String(req.params.phone || '');

    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format.',
      });
    }

    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'This endpoint is not available in production.',
      });
    }

    const status = await otpService.getOTPStatus(phone);

    return res.status(200).json({
      success: true,
      phone,
      ...status,
    });
  } catch (error) {
    logger.error('Error in getOTPStatus controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get OTP status.',
    });
  }
};

export default {
  sendOTP,
  verifyOTP,
  getOTPStatus,
};

import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { sendOTP, verifyOTP, getOTPStatus } from '../controllers/otp.controller';
import logger from '../utils/logger';

export const otpRouter = Router();

// ────────────────────────────────────────────────────────────────────────────
// Rate Limiting Middleware
// ────────────────────────────────────────────────────────────────────────────

// 1 OTP request per 60 seconds per IP
const otpSendLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 requests per windowMs
  message: 'Too many OTP requests. Please wait before requesting again.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const phone = req.body.phone;
    logger.warn(`Rate limit exceeded for phone: ${phone}`);
    res.status(429).json({
      success: false,
      message: 'Too many OTP requests. Please wait 60 seconds.',
    });
  },
});

// 5 verification attempts per 60 seconds per IP
const otpVerifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per windowMs
  message: 'Too many verification attempts.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const phone = req.body.phone;
    logger.warn(`Verification rate limit exceeded for phone: ${phone}`);
    res.status(429).json({
      success: false,
      message: 'Too many verification attempts. Try again in 1 minute.',
    });
  },
});

/**
 * POST /otp/send
 * Send OTP to phone number
 *
 * Request Body:
 * {
 *   "phone": "9876543210",           // 10-digit phone number
 *   "language": "en"                 // optional: en, hi, mr, ta, te, kn, gu, bn, pa
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "OTP sent to 9876543210. Valid for 5 minutes.",
 *   "expiresIn": 300
 * }
 */
otpRouter.post('/send', otpSendLimiter, sendOTP);

/**
 * POST /otp/verify
 * Verify OTP and get JWT token
 *
 * Request Body:
 * {
 *   "phone": "9876543210",           // 10-digit phone number
 *   "otp": "123456"                  // 6-digit OTP
 * }
 *
 * Response on Success:
 * {
 *   "success": true,
 *   "token": "eyJhbGc...",
 *   "user": {
 *     "id": "uuid",
 *     "phone": "9876543210",
 *     "name": "John Doe",
 *     "language": "en",
 *     "latitude": null,
 *     "longitude": null
 *   }
 * }
 *
 * Response on Failure:
 * {
 *   "success": false,
 *   "message": "Wrong OTP. 2 attempts remaining."
 * }
 */
otpRouter.post('/verify', otpVerifyLimiter, verifyOTP);

/**
 * GET /otp/status/:phone
 * Get OTP status for debugging (development only)
 */
otpRouter.get('/status/:phone', getOTPStatus);

export default otpRouter;

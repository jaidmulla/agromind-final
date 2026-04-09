import Redis from 'ioredis';
import bcryptjs from 'bcryptjs';
import logger from '../utils/logger';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ────────────────────────────────────────────────────────────────────────────
// OTP Service — Handle generation, hashing, storage, and verification
// ────────────────────────────────────────────────────────────────────────────

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const OTP_MAX_ATTEMPTS = 3;
const OTP_BLOCK_DURATION = 600; // 10 minutes
const OTP_RATE_LIMIT_COOLDOWN = 60; // 1 minute between sends
const OTP_LENGTH = 6;

/**
 * Generate a 6-digit OTP
 */
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Hash OTP using bcrypt (never store plain OTP)
 */
export const hashOTP = async (otp: string): Promise<string> => {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(otp, salt);
};

/**
 * Compare OTP with hash
 */
export const compareOTP = async (otp: string, hash: string): Promise<boolean> => {
  return bcryptjs.compare(otp, hash);
};

/**
 * Check if user is rate limited (1 OTP per 60 seconds)
 */
export const isRateLimited = async (phone: string): Promise<boolean> => {
  const key = `otp:rate:${phone}`;
  const exists = await redis.exists(key);
  return exists === 1;
};

/**
 * Check if user is blocked due to multiple wrong attempts
 */
export const isBlocked = async (phone: string): Promise<boolean> => {
  const blockKey = `otp:blocked:${phone}`;
  const blockedUntil = await redis.get(blockKey);
  if (!blockedUntil) return false;

  const blockedTime = parseInt(blockedUntil, 10);
  const now = Date.now();

  if (now > blockedTime) {
    // Block expired, remove key
    await redis.del(blockKey);
    return false;
  }
  return true;
};

/**
 * Get remaining block time in seconds
 */
export const getBlockedTimeRemaining = async (phone: string): Promise<number> => {
  const blockKey = `otp:blocked:${phone}`;
  const ttl = await redis.ttl(blockKey);
  return Math.max(0, ttl);
};

/**
 * Send OTP — Generate, hash, store in Redis, and set rate limit
 */
export const sendOTP = async (phone: string): Promise<{ otp: string; success: boolean; message: string }> => {
  try {
    // Check if rate limited
    if (await isRateLimited(phone)) {
      return {
        otp: '',
        success: false,
        message: 'Too many OTP requests. Please wait 60 seconds before requesting again.',
      };
    }

    // Check if blocked due to wrong attempts
    if (await isBlocked(phone)) {
      const remaining = await getBlockedTimeRemaining(phone);
      return {
        otp: '',
        success: false,
        message: `Too many wrong attempts. Try again in ${Math.ceil(remaining / 60)} minutes.`,
      };
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);

    // Store hashed OTP in Redis with expiry (5 minutes)
    const otpKey = `otp:${phone}`;
    await redis.setex(otpKey, OTP_EXPIRY_SECONDS, otpHash);

    // Reset attempts counter
    const attemptsKey = `otp:attempts:${phone}`;
    await redis.del(attemptsKey);

    // Set rate limit (1 OTP per 60 seconds)
    const rateKey = `otp:rate:${phone}`;
    await redis.setex(rateKey, OTP_RATE_LIMIT_COOLDOWN, '1');

    logger.info(`OTP generated for phone: ${phone}`);

    return {
      otp,
      success: true,
      message: `OTP sent to ${phone}. Valid for 5 minutes.`,
    };
  } catch (error) {
    logger.error('Error in sendOTP:', error);
    return {
      otp: '',
      success: false,
      message: 'Failed to send OTP. Please try again.',
    };
  }
};

/**
 * Verify OTP — Check hash, track attempts, block after 3 fails
 */
export const verifyOTP = async (
  phone: string,
  otp: string,
): Promise<{ success: boolean; message: string; blocked?: boolean }> => {
  try {
    // Check if blocked
    if (await isBlocked(phone)) {
      const remaining = await getBlockedTimeRemaining(phone);
      return {
        success: false,
        message: `Account locked. Try again in ${Math.ceil(remaining / 60)} minutes.`,
        blocked: true,
      };
    }

    // Get OTP hash from Redis
    const otpKey = `otp:${phone}`;
    const otpHash = await redis.get(otpKey);

    if (!otpHash) {
      return {
        success: false,
        message: 'OTP expired or not found. Request a new one.',
      };
    }

    // Compare OTP with hash
    const isValid = await compareOTP(otp, otpHash);

    if (!isValid) {
      // Increment attempt counter
      const attemptsKey = `otp:attempts:${phone}`;
      const attempts = await redis.incr(attemptsKey);
      await redis.expire(attemptsKey, OTP_BLOCK_DURATION);

      if (attempts >= OTP_MAX_ATTEMPTS) {
        // Block user for 10 minutes
        const blockKey = `otp:blocked:${phone}`;
        const blockedUntil = Date.now() + OTP_BLOCK_DURATION * 1000;
        await redis.setex(blockKey, OTP_BLOCK_DURATION, blockedUntil.toString());

        logger.warn(`OTP verification failed max attempts for phone: ${phone}`);

        return {
          success: false,
          message: 'Too many wrong attempts. Account locked for 10 minutes.',
          blocked: true,
        };
      }

      const remaining = OTP_MAX_ATTEMPTS - attempts;
      return {
        success: false,
        message: `Wrong OTP. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`,
      };
    }

    // OTP is valid, clean up Redis keys
    await redis.del(otpKey);
    await redis.del(`otp:attempts:${phone}`);
    await redis.del(`otp:rate:${phone}`);

    logger.info(`OTP verified successfully for phone: ${phone}`);

    return {
      success: true,
      message: 'OTP verified successfully.',
    };
  } catch (error) {
    logger.error('Error in verifyOTP:', error);
    return {
      success: false,
      message: 'An error occurred while verifying OTP. Please try again.',
    };
  }
};

/**
 * Get OTP status for a phone number (for debugging/testing)
 */
export const getOTPStatus = async (phone: string): Promise<{
  otpExists: boolean;
  isRateLimited: boolean;
  isBlocked: boolean;
  attempts: number;
  ttl: number;
}> => {
  const otpKey = `otp:${phone}`;
  const attemptsKey = `otp:attempts:${phone}`;
  const rateKey = `otp:rate:${phone}`;

  const otpTtl = await redis.ttl(otpKey);
  const attempts = parseInt((await redis.get(attemptsKey)) || '0', 10);
  const rateLimitTtl = await redis.ttl(rateKey);

  return {
    otpExists: otpTtl > 0,
    isRateLimited: rateLimitTtl > 0,
    isBlocked: await isBlocked(phone),
    attempts,
    ttl: Math.max(0, otpTtl),
  };
};

export default {
  generateOTP,
  hashOTP,
  compareOTP,
  isRateLimited,
  isBlocked,
  getBlockedTimeRemaining,
  sendOTP,
  verifyOTP,
  getOTPStatus,
};

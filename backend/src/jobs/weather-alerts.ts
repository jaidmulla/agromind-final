import cron from 'node-cron';
import { query } from '../utils/database';
import { sendAlertToUser } from '../services/alert.service';
import { getWeatherRisk } from '../services/weather.service';
import logger from '../utils/logger';

// ── Configuration ────────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds between retries
const FALLBACK_THRESHOLD = 5; // Days to wait before skipping user with consistent failures

interface UserWeatherRetry {
  userId: string;
  attemptCount: number;
  lastError?: string;
}

const userRetryMap = new Map<string, UserWeatherRetry>();

// ── Utility: Retry Logic with Exponential Backoff ───────────────────────────

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY_MS
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      logger.warn(`Attempt ${attempt}/${maxRetries} failed: ${errorMsg}`);

      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(2, attempt - 1); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  return null;
}

// ── Weather Alert Trigger (runs every hour at :00) ──────────────────────────

async function checkWeatherAlerts(): Promise<void> {
  try {
    logger.info('🌦️ Running weather alert check with retry logic...');

    // Get all users with coordinates and weather alerts enabled
    const usersRes = await query(
      `SELECT u.id, u.name, u.latitude, u.longitude, u.phone, u.email,
              np.email_notifications, np.sms_notifications, np.push_notifications
       FROM users u
       LEFT JOIN notification_preferences np ON u.id = np.user_id
       WHERE u.latitude IS NOT NULL AND u.longitude IS NOT NULL
         AND np.push_notifications IS NOT FALSE
         AND u.notification_enabled = true
       LIMIT 100`
    );

    if (!usersRes.rows.length) {
      logger.info('No users with location data found for weather alerts');
      return;
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const user of usersRes.rows) {
      try {
        // Check if user has too many recent failures  
        const retryInfo = userRetryMap.get(user.id);
        if (retryInfo && retryInfo.attemptCount > FALLBACK_THRESHOLD) {
          logger.warn(`Skipping user ${user.id} due to consistent failures (${retryInfo.attemptCount} attempts)`);
          failedCount++;
          continue;
        }

        // Fetch weather with retry logic
        const weather = await retryWithBackoff(() => getWeatherRisk(user.latitude, user.longitude));

        if (!weather) {
          // Update retry tracking
          const current = userRetryMap.get(user.id) || { userId: user.id, attemptCount: 0, lastError: undefined };
          current.attemptCount++;
          current.lastError = 'Weather service unavailable after retries';
          userRetryMap.set(user.id, current);
          
          logger.error(`Failed to fetch weather for user ${user.id} after ${MAX_RETRIES} retries`);
          failedCount++;
          continue;
        }

        // Reset retry counter on success
        userRetryMap.delete(user.id);

        // Check danger thresholds
        const rainAlert = weather.rainfall > 5 || weather.rain_probability > 70;
        const tempAlert = weather.temperature < 5 || weather.temperature > 45;
        const windAlert = weather.wind_speed > 40;

        if (!rainAlert && !tempAlert && !windAlert) {
          continue; // No alert needed
        }

        // Build alert message based on conditions
        let alertTitle = '🌦️ Weather Alert';
        let alertBody = '';
        const alertReasons: string[] = [];

        if (rainAlert) {
          alertReasons.push(`heavy rain (${weather.rainfall}mm forecast, ${weather.rain_probability}% chance)`);
        }
        if (tempAlert) {
          alertReasons.push(`extreme temperature (${weather.temperature}°C)`);
        }
        if (windAlert) {
          alertReasons.push(`strong wind (${weather.wind_speed} km/h)`);
        }

        alertBody = `Weather in your area: ${alertReasons.join(', ')}. Recommended: Cover crops, secure loose equipment, inspect plants after weather clears.`;

        const message = {
          title: alertTitle,
          body: alertBody,
          subject: `⚠️ Weather Alert: ${alertReasons.map(r => r.split('(')[0]).join(', ')}`,
          phone: user.phone,
          email: user.email,
          pushTitle: alertTitle,
        };

        // Send with retry logic
        const sendSuccess = await retryWithBackoff(
          () => Promise.resolve(sendAlertToUser(message, user.id) as any),
          2 // 2 retries for sending (less critical than fetching)
        );

        if (sendSuccess !== null) {
          sentCount++;
          logger.info(`Weather alert sent to user ${user.id}`);
        } else {
          failedCount++;
          logger.error(`Failed to send weather alert to user ${user.id} after retries`);
        }

        // Rate limit: sleep between messages
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        logger.error(`Unexpected error checking weather for user ${user.id}:`, err);
        failedCount++;
      }
    }

    logger.info(`✅ Weather alert check complete. Sent: ${sentCount}, Failed: ${failedCount}, Users processed: ${usersRes.rows.length}`);
  } catch (err) {
    logger.error('Weather alert check failed:', err);
  }
}

// ── Initialize Weather Alert Cron (every hour at :00) ────────────────────────

export function startWeatherAlertJob(): any {
  logger.info('Starting weather alert scheduler...');

  // Run at :00 every hour
  const job = cron.schedule('0 * * * *', checkWeatherAlerts);

  // Also run once at startup after 30 seconds
  setTimeout(checkWeatherAlerts, 30000);

  return job;
}

export { checkWeatherAlerts };

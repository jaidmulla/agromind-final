import cron from 'node-cron';
import { query } from '../utils/database';
import { sendAlertToUser } from '../services/alert.service';
import { calculateRegret } from '../services/regret.service';
import logger from '../utils/logger';

// ── Daily Regret Alert (7 AM) ──────────────────────────────────────────────

async function sendDailyRegretAlerts(): Promise<void> {
  try {
    logger.info('💰 Running daily regret alerts at 7 AM...');

    // Get all critical/warning alerts created in the last 7 days for users with regret scores
    const alertsRes = await query(
      `SELECT DISTINCT a.id, a.user_id, a.title, a.severity, a.potential_loss,
              u.name, u.phone, u.email, u.language,
              np.email_notifications, np.sms_notifications, np.push_notifications
       FROM alerts a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN notification_preferences np ON u.id = np.user_id
       WHERE a.severity IN ('critical', 'warning')
         AND a.type = 'disease'
         AND a.is_resolved = false
         AND a.created_at >= NOW() - INTERVAL '7 days'
         AND np.push_notifications IS NOT FALSE
         AND u.notification_enabled = true
       LIMIT 100`
    );

    if (!alertsRes.rows.length) {
      logger.info('No regret alerts to send');
      return;
    }

    let sentCount = 0;

    for (const alert of alertsRes.rows) {
      try {
        // Calculate regret based on current loss amount
        const regretAnalysis = calculateRegret({
          severity: alert.severity,
          potential_loss_inr: parseFloat(alert.potential_loss) || 0,
          confidence: 85,
          disease_name: alert.title,
        });

        // Days since alert was created
        const createdAt = new Date(alert.created_at);
        const now = new Date();
        const daysSince = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        // Escalate message for older, unresolved alerts
        let urgencyPhrase = 'Take action today to prevent losses.';
        if (daysSince >= 3) {
          urgencyPhrase = '⚠️ URGENT: This disease has been spreading for 3+ days. Act now!';
        } else if (daysSince >= 1) {
          urgencyPhrase = 'One day passed. Immediate action required to save your crop.';
        }

        const message = {
          title: `💰 Regret Alert: ${alert.title}`,
          body: `Daily reminder: Potential loss ₹${Math.round(parseFloat(alert.potential_loss) || 0)} if not treated. ${urgencyPhrase} Regret score: ${regretAnalysis.regret_score}%. Treat now to save ₹${Math.round((parseFloat(alert.potential_loss) || 0) * 0.85)}.`,
          subject: `💰 Daily Regret Reminder: ${alert.title}`,
          phone: alert.phone,
          email: alert.email,
          pushTitle: `💰 Regret Alert Day ${daysSince + 1}`,
        };

        await sendAlertToUser(message, alert.user_id);
        sentCount++;

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        logger.error(`Failed to send regret alert for user ${alert.user_id}:`, err);
      }
    }

    logger.info(`✅ Daily regret alerts sent: ${sentCount}`);
  } catch (err) {
    logger.error('Daily regret alert job failed:', err);
  }
}

// ── Daily Crop Check Reminder (9 AM) ───────────────────────────────────────

async function sendDailyCropReminders(): Promise<void> {
  try {
    logger.info('📋 Running daily crop check reminders at 9 AM...');

    // Get users who haven't scanned in 24 hours
    const usersRes = await query(
      `SELECT u.id, u.name, u.phone, u.email, u.language,
              np.email_notifications, np.sms_notifications, np.push_notifications,
              COUNT(c.id) as crop_count,
              MAX(s.created_at) as last_scan,
              (NOW() - MAX(s.created_at)) as time_since_scan
       FROM users u
       LEFT JOIN notification_preferences np ON u.id = np.user_id
       LEFT JOIN crops c ON u.id = c.user_id
       LEFT JOIN scans s ON u.id = s.user_id
       WHERE np.push_notifications IS NOT FALSE
         AND u.notification_enabled = true
         AND u.created_at < NOW() - INTERVAL '7 days'
       GROUP BY u.id, np.push_notifications, u.phone, u.email, u.language
       HAVING COUNT(c.id) > 0
         AND (MAX(s.created_at) IS NULL OR NOW() - MAX(s.created_at) > INTERVAL '24 hours')
       LIMIT 100`
    );

    if (!usersRes.rows.length) {
      logger.info('No crop reminders to send');
      return;
    }

    let sentCount = 0;

    for (const user of usersRes.rows) {
      try {
        const cropNames = await query(
          `SELECT name FROM crops WHERE user_id = $1 LIMIT 3`,
          [user.id]
        );

        const crops = cropNames.rows.map((r: any) => r.name).join(', ');
        const timeSince = user.time_since_scan ? Math.floor(user.time_since_scan / 1000 / 60 / 60 / 24) : 999;

        let reminderText = 'It\'s time to check your crops for disease symptoms.';
        if (timeSince > 3) {
          reminderText = `It's been ${timeSince} days since your last scan. Check your crops now!`;
        }

        const message = {
          title: '📋 Daily Crop Check Reminder',
          body: `${reminderText} Crops: ${crops}. Use AgroMind to scan a leaf for early disease detection.`,
          subject: '📋 Time to Check Your Crops',
          phone: user.phone,
          email: user.email,
          pushTitle: '📋 Crop Check Reminder',
        };

        await sendAlertToUser(message, user.id);
        sentCount++;

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        logger.error(`Failed to send crop reminder to user ${user.id}:`, err);
      }
    }

    logger.info(`✅ Daily crop reminders sent: ${sentCount}`);
  } catch (err) {
    logger.error('Daily crop reminder job failed:', err);
  }
}

// ── Initialize Daily Alert Cron Jobs ───────────────────────────────────────

export function startDailyRegretAlertJob(): any {
  logger.info('Starting daily regret alert scheduler (7 AM)...');

  // Run at 7:00 AM every day (IST timezone)
  const job = cron.schedule('0 7 * * *', sendDailyRegretAlerts, {
    timezone: 'Asia/Kolkata',
  });

  return job;
}

export function startDailyCropReminderJob(): any {
  logger.info('Starting daily crop check reminder scheduler (9 AM)...');

  // Run at 9:00 AM every day (IST timezone)
  const job = cron.schedule('0 9 * * *', sendDailyCropReminders, {
    timezone: 'Asia/Kolkata',
  });

  return job;
}

export { sendDailyRegretAlerts, sendDailyCropReminders };

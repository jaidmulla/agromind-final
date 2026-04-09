import * as nodemailer from 'nodemailer';
import twilio from 'twilio';
import * as admin from 'firebase-admin';
import { query } from '../utils/database';
import logger from '../utils/logger';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface SendAlertOptions {
  userId: string;
  alertId?: string;
  channels?: ('sms' | 'email' | 'push')[];
}

export interface AlertMessage {
  title: string;
  body: string;
  subject?: string;
  phone?: string;
  email?: string;
  pushTitle?: string;
}

// ── Validate Environment Variables ────────────────────────────────────────────

function getTwilioClient(): twilio.Twilio | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken || accountSid === 'your_account_sid') {
    logger.warn('Twilio credentials not configured; SMS alerts disabled');
    return null;
  }

  return twilio(accountSid, authToken);
}

function getEmailTransporter(): nodemailer.Transporter | null {
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  const emailService = process.env.EMAIL_SERVICE || 'gmail';

  if (!emailUser || !emailPassword) {
    logger.warn('Email credentials not configured; email alerts disabled');
    return null;
  }

  return nodemailer.createTransport({
    service: emailService,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
}

function getFirebaseApp(): admin.app.App | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    logger.warn('Firebase credentials not configured; push notifications disabled');
    return null;
  }

  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        } as any),
      });
    }
    return admin.app();
  } catch (err) {
    logger.error('Failed to initialize Firebase:', err);
    return null;
  }
}

// ── Log Notification to Database ──────────────────────────────────────────────

export async function logNotification(
  userId: string,
  type: 'sms' | 'email' | 'push',
  options: {
    alertId?: string;
    channel?: string;
    subject?: string;
    message?: string;
    status?: 'pending' | 'sent' | 'failed' | 'bounced';
    errorMessage?: string;
  }
): Promise<void> {
  try {
    await query(
      `INSERT INTO notification_logs (user_id, alert_id, type, channel, subject, message, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        options.alertId || null,
        type,
        options.channel || null,
        options.subject || null,
        options.message || null,
        options.status || 'pending',
        options.errorMessage || null,
      ]
    );
  } catch (err) {
    logger.error(`Failed to log notification for user ${userId}:`, err);
  }
}

export async function updateNotificationStatus(
  userId: string,
  type: 'sms' | 'email' | 'push',
  status: 'sent' | 'failed' | 'bounced',
  errorMessage?: string
): Promise<void> {
  try {
    await query(
      `UPDATE notification_logs 
       SET status = $1, error_message = $2, sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE sent_at END
       WHERE user_id = $3 AND type = $4 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [status, errorMessage || null, userId, type]
    );
  } catch (err) {
    logger.error(`Failed to update notification status for user ${userId}:`, err);
  }
}

// ── SMS Delivery (Twilio) ──────────────────────────────────────────────────────

export async function sendSMS(phone: string, message: string, userId: string, alertId?: string): Promise<boolean> {
  try {
    if (!phone) {
      logger.warn(`No phone number for user ${userId}; skipping SMS`);
      await logNotification(userId, 'sms', {
        alertId,
        status: 'failed',
        errorMessage: 'No phone number on file',
      });
      return false;
    }

    await logNotification(userId, 'sms', {
      alertId,
      channel: phone,
      message,
      status: 'pending',
    });

    const client = getTwilioClient();
    if (!client) {
      await updateNotificationStatus(userId, 'sms', 'failed', 'Twilio not configured');
      return false;
    }

    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!twilioPhoneNumber) {
      await updateNotificationStatus(userId, 'sms', 'failed', 'TWILIO_PHONE_NUMBER not configured');
      return false;
    }

    await client.messages.create({
      from: twilioPhoneNumber,
      to: phone.startsWith('+') ? phone : `+91${phone.replace(/^91/, '')}`,
      body: message,
    });

    logger.info(`SMS sent to ${phone} for user ${userId}`);
    await updateNotificationStatus(userId, 'sms', 'sent');
    return true;
  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown error';
    logger.error(`Failed to send SMS to ${phone}:`, err);
    await updateNotificationStatus(userId, 'sms', 'failed', errorMsg);
    return false;
  }
}

// ── Email Delivery (Nodemailer) ────────────────────────────────────────────────

export async function sendEmail(
  email: string,
  subject: string,
  html: string,
  userId: string,
  alertId?: string
): Promise<boolean> {
  try {
    if (!email) {
      logger.warn(`No email for user ${userId}; skipping email`);
      await logNotification(userId, 'email', {
        alertId,
        status: 'failed',
        errorMessage: 'No email on file',
      });
      return false;
    }

    await logNotification(userId, 'email', {
      alertId,
      channel: email,
      subject,
      message: html,
      status: 'pending',
    });

    const transporter = getEmailTransporter();
    if (!transporter) {
      await updateNotificationStatus(userId, 'email', 'failed', 'Email service not configured');
      return false;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      html,
    });

    logger.info(`Email sent to ${email} for user ${userId}`);
    await updateNotificationStatus(userId, 'email', 'sent');
    return true;
  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown error';
    logger.error(`Failed to send email to ${email}:`, err);
    await updateNotificationStatus(userId, 'email', 'failed', errorMsg);
    return false;
  }
}

// ── Push Notification (Firebase Cloud Messaging) ──────────────────────────────

export async function sendPush(title: string, body: string, userId: string, alertId?: string): Promise<boolean> {
  try {
    // Fetch user's push token and settings
    const res = await query(
      `SELECT u.push_token, np.push_notifications 
       FROM users u 
       LEFT JOIN notification_preferences np ON u.id = np.user_id 
       WHERE u.id = $1`,
      [userId]
    );

    if (!res.rows.length) {
      logger.warn(`User ${userId} not found`);
      await logNotification(userId, 'push', {
        alertId,
        status: 'failed',
        errorMessage: 'User not found',
      });
      return false;
    }

    const { push_token: pushToken, push_notifications: pushEnabled } = res.rows[0];

    if (!pushToken) {
      logger.warn(`No push token for user ${userId}`);
      await logNotification(userId, 'push', {
        alertId,
        status: 'failed',
        errorMessage: 'No push token registered',
      });
      return false;
    }

    if (pushEnabled === false) {
      logger.info(`Push notifications disabled for user ${userId}`);
      return false;
    }

    await logNotification(userId, 'push', {
      alertId,
      channel: pushToken,
      subject: title,
      message: body,
      status: 'pending',
    });

    const app = getFirebaseApp();
    if (!app) {
      await updateNotificationStatus(userId, 'push', 'failed', 'Firebase not configured');
      return false;
    }

    const messaging = admin.messaging(app);
    await messaging.send({
      notification: {
        title,
        body,
      },
      token: pushToken,
      webpush: {
        notification: {
          title,
          body,
          icon: '/agromind-icon-192x192.png',
          badge: '/agromind-badge-72x72.png',
        },
      },
    });

    logger.info(`Push notification sent to user ${userId}`);
    await updateNotificationStatus(userId, 'push', 'sent');
    return true;
  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown error';
    logger.error(`Failed to send push notification to user ${userId}:`, err);
    await updateNotificationStatus(userId, 'push', 'failed', errorMsg);
    return false;
  }
}

// ── Send Alert Via Multiple Channels ───────────────────────────────────────────

export async function sendAlertToUser(
  message: AlertMessage,
  userId: string,
  alertId?: string,
  channels?: ('sms' | 'email' | 'push')[]
): Promise<{ sms: boolean; email: boolean; push: boolean }> {
  // Fetch user preferences and contact info
  const res = await query(
    `SELECT 
       u.phone, u.email,
       np.sms_notifications, np.email_notifications, np.push_notifications
     FROM users u 
     LEFT JOIN notification_preferences np ON u.id = np.user_id 
     WHERE u.id = $1`,
    [userId]
  );

  if (!res.rows.length) {
    logger.error(`User ${userId} not found`);
    return { sms: false, email: false, push: false };
  }

  const user = res.rows[0];
  const defaultChannels = channels || (
    (user.sms_notifications !== false || user.email_notifications !== false || user.push_notifications !== false)
      ? ['sms', 'email', 'push']
      : []
  );

  const results = {
    sms: false,
    email: false,
    push: false,
  };

  // Send via requested channels
  if (defaultChannels.includes('sms') && user.sms_notifications !== false && message.phone) {
    results.sms = await sendSMS(message.phone || user.phone, message.body, userId, alertId);
  }

  if (defaultChannels.includes('email') && user.email_notifications !== false && message.email) {
    results.email = await sendEmail(message.email || user.email, message.subject || 'AgroMind Alert', message.body, userId, alertId);
  }

  if (defaultChannels.includes('push')) {
    results.push = await sendPush(message.pushTitle || message.title, message.body, userId, alertId);
  }

  return results;
}

// ── Fetch Notification History ─────────────────────────────────────────────────

export async function getNotificationHistory(userId: string, limit = 20): Promise<any[]> {
  try {
    const res = await query(
      `SELECT id, type, channel, subject, message, status, error_message, sent_at, created_at
       FROM notification_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return res.rows;
  } catch (err) {
    logger.error(`Failed to fetch notification history for user ${userId}:`, err);
    return [];
  }
}

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { sendAlertToUser, getNotificationHistory } from '../services/alert.service';
import logger from '../utils/logger';

// ── Get Notification Preferences ───────────────────────────────────────────────

export const getNotificationPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT 
        id, user_id, critical_alerts, warning_alerts, info_alerts,
        email_notifications, sms_notifications, push_notifications,
        nearby_farmer_alerts, weekly_report, community_updates
       FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      // Create default preferences if not exists
      const createResult = await query(
        `INSERT INTO notification_preferences (user_id, critical_alerts, warning_alerts, email_notifications, sms_notifications, push_notifications)
         VALUES ($1, true, true, true, false, true)
         RETURNING *`,
        [userId]
      );

      res.json({
        success: true,
        data: createResult.rows[0],
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    logger.error('Failed to fetch notification preferences:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch preferences' });
  }
};

// ── Update Notification Preferences ────────────────────────────────────────────

export const updateNotificationPreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const {
      critical_alerts,
      warning_alerts,
      info_alerts,
      email_notifications,
      sms_notifications,
      push_notifications,
      nearby_farmer_alerts,
      weekly_report,
      community_updates,
    } = req.body;

    // Validate that at least one channel is enabled
    const channelsEnabled = email_notifications || sms_notifications || push_notifications;
    if (channelsEnabled === false) {
      res.status(400).json({
        success: false,
        message: 'At least one notification channel must be enabled',
      });
      return;
    }

    // Check if preferences exist; create if not
    let result = await query(
      `SELECT id FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      // Create default preferences first
      await query(
        `INSERT INTO notification_preferences (user_id) VALUES ($1)`,
        [userId]
      );
    }

    // Update preferences
    result = await query(
      `UPDATE notification_preferences 
       SET critical_alerts = COALESCE($2, critical_alerts),
           warning_alerts = COALESCE($3, warning_alerts),
           info_alerts = COALESCE($4, info_alerts),
           email_notifications = COALESCE($5, email_notifications),
           sms_notifications = COALESCE($6, sms_notifications),
           push_notifications = COALESCE($7, push_notifications),
           nearby_farmer_alerts = COALESCE($8, nearby_farmer_alerts),
           weekly_report = COALESCE($9, weekly_report),
           community_updates = COALESCE($10, community_updates),
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        critical_alerts,
        warning_alerts,
        info_alerts,
        email_notifications,
        sms_notifications,
        push_notifications,
        nearby_farmer_alerts,
        weekly_report,
        community_updates,
      ]
    );

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: result.rows[0],
    });
  } catch (err) {
    logger.error('Failed to update notification preferences:', err);
    res.status(500).json({ success: false, message: 'Failed to update preferences' });
  }
};

// ── Register FCM Push Token ────────────────────────────────────────────────────

export const registerPushToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ success: false, message: 'Push token is required' });
      return;
    }

    await query(
      `UPDATE users SET push_token = $1 WHERE id = $2`,
      [token, userId]
    );

    // Ensure push preference is enabled
    await query(
      `INSERT INTO notification_preferences (user_id, push_notifications)
       VALUES ($1, true)
       ON CONFLICT (user_id) DO UPDATE SET push_notifications = true`,
      [userId]
    );

    res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (err) {
    logger.error('Failed to register push token:', err);
    res.status(500).json({ success: false, message: 'Failed to register push token' });
  }
};

// ── Send Test Notification ────────────────────────────────────────────────────

export const sendTestNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { channel = 'all' } = req.body; // 'sms', 'email', 'push', or 'all'

    // Fetch user info
    const userRes = await query(
      `SELECT name, email, phone FROM users WHERE id = $1`,
      [userId]
    );

    if (!userRes.rows.length) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const user = userRes.rows[0];

    const channels = channel === 'all' ? ['sms', 'email', 'push'] : [channel];

    const testMessage = {
      title: '✅ AgroMind Test Notification',
      body: `Hello ${user.name || 'Farmer'}, this is a test notification from AgroMind AI+. Your alerts are working correctly!`,
      subject: '✅ AgroMind Test Notification',
      phone: user.phone,
      email: user.email,
      pushTitle: '✅ Test Notification',
    };

    const results = await sendAlertToUser(testMessage, userId, undefined, channels);

    const sentVia: string[] = [];
    if (results.sms) sentVia.push('SMS');
    if (results.email) sentVia.push('Email');
    if (results.push) sentVia.push('Push Notification');

    res.json({
      success: true,
      message: `Test notification sent via ${sentVia.length > 0 ? sentVia.join(', ') : 'no channels (check configuration)'}`,
      results,
    });
  } catch (err) {
    logger.error('Failed to send test notification:', err);
    res.status(500).json({ success: false, message: 'Failed to send test notification' });
  }
};

// ── Get Notification History ───────────────────────────────────────────────────

export const getNotificationLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { limit = 50, type, status } = req.query;

    let sql = `SELECT id, type, channel, subject, message, status, error_message, sent_at, created_at
               FROM notification_logs WHERE user_id = $1`;
    const params: any[] = [userId];

    if (type && typeof type === 'string') {
      sql += ` AND type = $${params.length + 1}`;
      params.push(type);
    }

    if (status && typeof status === 'string') {
      sql += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit as string) || 50);

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err) {
    logger.error('Failed to fetch notification logs:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
};

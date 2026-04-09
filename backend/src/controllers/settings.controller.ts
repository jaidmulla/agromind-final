import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';

export const getNotificationPrefs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query('SELECT * FROM notification_preferences WHERE user_id=$1', [req.user!.id]);
    if (!r.rows.length) {
      await query('INSERT INTO notification_preferences (user_id) VALUES ($1)', [req.user!.id]);
      const r2 = await query('SELECT * FROM notification_preferences WHERE user_id=$1', [req.user!.id]);
      res.json({ success: true, data: r2.rows[0] });
      return;
    }
    res.json({ success: true, data: r.rows[0] });
  } catch { res.status(500).json({ success: false, message: 'Failed to fetch preferences' }); }
};

export const updateNotificationPrefs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const fields = ['critical_alerts','warning_alerts','info_alerts','email_notifications',
                    'sms_notifications','push_notifications','nearby_farmer_alerts','weekly_report','community_updates'];
    const updates: string[] = [];
    const params: unknown[] = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        params.push(req.body[f]);
        updates.push(`${f}=$${params.length}`);
      }
    });
    if (!updates.length) { res.status(400).json({ success: false, message: 'No fields to update' }); return; }
    params.push(req.user!.id);
    const r = await query(
      `UPDATE notification_preferences SET ${updates.join(',')} WHERE user_id=$${params.length} RETURNING *`,
      params
    );
    res.json({ success: true, data: r.rows[0] });
  } catch { res.status(500).json({ success: false, message: 'Failed to update preferences' }); }
};

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';

export const getAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { severity, is_resolved = 'false', limit = '20', offset = '0' } = req.query;
    let sql = `SELECT a.*, c.name as crop_name, f.name as farm_name
               FROM alerts a
               LEFT JOIN crops c ON c.id = a.crop_id
               LEFT JOIN farms f ON f.id = a.farm_id
               WHERE a.user_id = $1 AND a.is_resolved = $2`;
    const params: unknown[] = [req.user!.id, is_resolved === 'true'];
    if (severity) { sql += ` AND a.severity = $${params.length + 1}`; params.push(severity); }
    sql += ` ORDER BY CASE a.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, a.created_at DESC`;
    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const r = await query(sql, params);
    res.json({ success: true, data: r.rows });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
  }
};

export const getAlertStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [alertStats, lossStats, reportStats] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE NOT is_resolved) as total,
           COUNT(*) FILTER (WHERE severity='critical' AND NOT is_resolved) as critical,
           COUNT(*) FILTER (WHERE severity='warning' AND NOT is_resolved) as warning,
           COUNT(*) FILTER (WHERE severity='info' AND NOT is_resolved) as info,
           COUNT(*) FILTER (WHERE is_resolved) as resolved
         FROM alerts WHERE user_id = $1`,
        [req.user!.id]
      ),
      query(
        `SELECT COALESCE(SUM(amount_prevented),0) as total_loss_prevented,
                COALESCE(SUM(amount_prevented) FILTER (WHERE recorded_at >= NOW() - INTERVAL '1 day'),0) as today_prevented
         FROM loss_prevention_records WHERE user_id = $1`,
        [req.user!.id]
      ),
      query(
        `SELECT COUNT(*)::INT AS total_reports,
                COUNT(*) FILTER (WHERE disease_name = 'Healthy')::INT AS healthy_reports
         FROM scans
         WHERE user_id = $1`,
        [req.user!.id]
      ),
    ]);

    const crops = await query('SELECT COUNT(*) as count FROM crops WHERE user_id=$1', [req.user!.id]);
    const totalReports = reportStats.rows[0]?.total_reports || 0;
    const healthyReports = reportStats.rows[0]?.healthy_reports || 0;
    const protectionRate = totalReports > 0
      ? Math.round((healthyReports / totalReports) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        ...alertStats.rows[0],
        total_loss_prevented: parseFloat(lossStats.rows[0].total_loss_prevented),
        today_prevented: parseFloat(lossStats.rows[0].today_prevented),
        crops_monitored: parseInt(crops.rows[0].count),
        protection_rate: protectionRate,
        currency: 'INR',
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch alert stats' });
  }
};

export const markAlertRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await query('UPDATE alerts SET is_read=true WHERE id=$1 AND user_id=$2', [req.params.id, req.user!.id]);
    res.json({ success: true, message: 'Marked as read' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed' });
  }
};

export const resolveAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action_taken, amount_prevented } = req.body;
    const r = await query(
      `UPDATE alerts SET is_resolved=true, is_active=false, is_read=true, resolved_at=NOW()
       WHERE id=$1 AND user_id=$2 RETURNING *`,
      [req.params.id, req.user!.id]
    );
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'Alert not found' }); return; }

    const alert = r.rows[0];
    const prevented = amount_prevented || alert.preventable_loss || 0;
    if (prevented > 0) {
      await query(
        `INSERT INTO loss_prevention_records (user_id, alert_id, crop_id, amount_prevented, action_taken)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.user!.id, alert.id, alert.crop_id, prevented, action_taken || 'Alert resolved']
      );
    }
    res.json({ success: true, message: 'Alert resolved', data: { amount_prevented: prevented } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to resolve alert' });
  }
};

export const getNearbyAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lat, lon, radius = '10' } = req.query;
    const radiusKm = Number(radius || 10);
    
    // If lat/lon provided, use those; otherwise use user's location
    let centerLat, centerLon;
    
    if (lat && lon) {
      centerLat = Number(lat);
      centerLon = Number(lon);
    } else {
      const userR = await query('SELECT latitude, longitude FROM users WHERE id=$1', [req.user!.id]);
      const user = userR.rows[0];
      if (!user?.latitude || !user?.longitude) {
        res.json({ success: true, data: [] });
        return;
      }
      centerLat = Number(user.latitude);
      centerLon = Number(user.longitude);
    }

    const r = await query(
      `SELECT a.*, u.name as farmer_name, u.location as farmer_location,
              COALESCE(a.latitude, u.latitude) as latitude,
              COALESCE(a.longitude, u.longitude) as longitude,
              (6371 * acos(cos(radians($1)) * cos(radians(COALESCE(a.latitude, u.latitude))) *
               cos(radians(COALESCE(a.longitude, u.longitude)) - radians($2)) + sin(radians($1)) * sin(radians(COALESCE(a.latitude, u.latitude))))) AS distance_km
       FROM alerts a
       JOIN users u ON u.id = a.user_id
       WHERE NOT a.is_resolved
         AND COALESCE(a.latitude, u.latitude) IS NOT NULL
         AND COALESCE(a.longitude, u.longitude) IS NOT NULL
         AND (6371 * acos(cos(radians($1)) * cos(radians(COALESCE(a.latitude, u.latitude))) *
              cos(radians(COALESCE(a.longitude, u.longitude)) - radians($2)) + sin(radians($1)) * sin(radians(COALESCE(a.latitude, u.latitude))))) <= $3
       ORDER BY distance_km ASC
       LIMIT 20`,
      [centerLat, centerLon, radiusKm]
    );
    res.json({ success: true, data: r.rows });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch nearby alerts' });
  }
};

export const getAlertsHeatmap = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query(
      `SELECT ROUND(CAST(COALESCE(a.latitude, u.latitude) AS NUMERIC), 2) AS latitude,
              ROUND(CAST(COALESCE(a.longitude, u.longitude) AS NUMERIC), 2) AS longitude,
              COUNT(*)::INT AS alert_count,
              MAX(a.severity) AS severity
       FROM alerts a
       JOIN users u ON u.id = a.user_id
       WHERE COALESCE(a.latitude, u.latitude) IS NOT NULL
         AND COALESCE(a.longitude, u.longitude) IS NOT NULL
         AND NOT a.is_resolved
       GROUP BY ROUND(CAST(COALESCE(a.latitude, u.latitude) AS NUMERIC), 2),
                ROUND(CAST(COALESCE(a.longitude, u.longitude) AS NUMERIC), 2)
       ORDER BY alert_count DESC
       LIMIT 250`
    );
    res.json({ success: true, data: r.rows });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch alerts heatmap' });
  }
};

export const deleteAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await query('DELETE FROM alerts WHERE id=$1 AND user_id=$2', [req.params.id, req.user!.id]);
    res.json({ success: true, message: 'Alert deleted' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete alert' });
  }
};

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { getCoordinatesByCity, getWeatherRisk, saveWeatherSnapshot } from '../services/weather.service';

export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user!.id;
    const [lossR, alertR, cropsR, scansR, recentR] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(amount_prevented),0) as total,
                COALESCE(SUM(amount_prevented) FILTER (WHERE recorded_at >= CURRENT_DATE),0) as today
         FROM loss_prevention_records WHERE user_id=$1`, [uid]
      ),
      query(
        `SELECT COUNT(*) FILTER (WHERE NOT is_resolved) as active,
                COUNT(*) FILTER (WHERE severity='critical' AND NOT is_resolved) as critical
         FROM alerts WHERE user_id=$1`, [uid]
      ),
      query(`SELECT COUNT(*) as count FROM crops WHERE user_id=$1`, [uid]),
      query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE disease_name = 'Healthy') as healthy
         FROM scans WHERE user_id=$1`, [uid]
      ),
      query(
        `SELECT s.id, s.disease_name, s.plant_name, s.confidence, s.severity,
                s.image_url, s.status, s.created_at
         FROM scans s WHERE s.user_id=$1
         ORDER BY s.created_at DESC LIMIT 10`, [uid]
      ),
    ]);

    const activeAlerts = parseInt(alertR.rows[0].active) || 0;
    const criticalAlerts = parseInt(alertR.rows[0].critical) || 0;
    const totalScans = parseInt(scansR.rows[0].total) || 0;
    const healthyScans = parseInt(scansR.rows[0].healthy) || 0;
    // Spec: protection_rate = (reports where disease = "Healthy" / total reports) * 100
    const protectionRate = totalScans > 0
      ? Math.round((healthyScans / totalScans) * 100)
      : 100;

    res.json({
      success: true,
      data: {
        total_loss_prevented: parseFloat(lossR.rows[0].total) || 0,
        today_prevented: parseFloat(lossR.rows[0].today) || 0,
        active_alerts: activeAlerts,
        critical_alerts: criticalAlerts,
        crops_monitored: parseInt(cropsR.rows[0].count) || 0,
        protection_rate: protectionRate,
        recent_scans: recentR.rows,
        currency: 'INR',
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
};

export const getLossPrevention = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { range = 'month' } = req.query;
    let interval = "6 months";
    let groupBy = "to_char(snapshot_date, 'Mon')";
    if (range === 'week') { interval = '4 weeks'; groupBy = "to_char(snapshot_date, 'Mon DD')"; }
    if (range === 'year') { interval = '12 months'; groupBy = "to_char(snapshot_date, 'Mon')"; }

    const r = await query(
      `SELECT ${groupBy} as label,
              COALESCE(SUM(loss_prevented),0) as prevented,
              COALESCE(SUM(potential_loss),0) as potential
       FROM analytics_snapshots
       WHERE user_id=$1 AND snapshot_date >= NOW() - INTERVAL '${interval}'
       GROUP BY snapshot_date, ${groupBy}
       ORDER BY snapshot_date ASC`,
      [req.user!.id]
    );

    res.json({ success: true, data: r.rows });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch loss prevention data' });
  }
};

export const getAlertTypes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query(
      `SELECT type as name, COUNT(*) as value
       FROM alerts WHERE user_id=$1
       GROUP BY type ORDER BY value DESC`,
      [req.user!.id]
    );
    const colors: Record<string, string> = {
      disease: '#D32F2F', pest: '#FF6F00', nutrient: '#1565C0',
      irrigation: '#2E7D32', weather: '#6A1B9A', system: '#546E7A',
    };
    const data = r.rows.map(row => ({ ...row, value: parseInt(row.value), color: colors[row.name] || '#546E7A' }));
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch alert types' });
  }
};

export const getCropPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query(
      `SELECT c.name as crop,
              AVG(c.health_score) as health,
              COUNT(DISTINCT s.id) as alerts
       FROM crops c
       LEFT JOIN alerts a ON a.crop_id = c.id
       LEFT JOIN scans s ON s.crop_id = c.id
       WHERE c.user_id=$1
       GROUP BY c.id, c.name`,
      [req.user!.id]
    );
    const data = r.rows.map(row => ({
      crop: row.crop,
      yield: Math.round(parseFloat(row.health) * 0.95),
      health: Math.round(parseFloat(row.health)),
      alerts: parseInt(row.alerts),
    }));
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch crop performance' });
  }
};

export const getResponseTimes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query(
      `SELECT
         to_char(DATE_TRUNC('week', created_at), 'Mon DD') as week,
         AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_hours,
         COUNT(*) FILTER (WHERE is_resolved) as resolved
       FROM alerts
       WHERE user_id=$1 AND created_at >= NOW() - INTERVAL '4 weeks'
       GROUP BY DATE_TRUNC('week', created_at)
       ORDER BY DATE_TRUNC('week', created_at) ASC`,
      [req.user!.id]
    );
    const data = r.rows.map((row, i) => ({
      week: `W${i + 1}`,
      avgTime: Math.round((parseFloat(row.avg_hours) || 3) * 10) / 10,
      resolved: parseInt(row.resolved) || 0,
    }));
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch response times' });
  }
};

export const getWeatherRiskData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lat, lon, city } = req.query;
    let latitude = parseFloat(lat as string);
    let longitude = parseFloat(lon as string);

    if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && typeof city === 'string' && city.trim()) {
      try {
        const coordinates = await getCoordinatesByCity(city.trim());
        latitude = coordinates.lat;
        longitude = coordinates.lon;
      } catch {
        // If location resolution fails, try user profile location
      }
    }

    if ((!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
      const userR = await query('SELECT latitude, longitude FROM users WHERE id=$1', [req.user!.id]);
      latitude = Number(userR.rows[0]?.latitude);
      longitude = Number(userR.rows[0]?.longitude);
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      // Debug: provide a helpful message with example
      res.status(400).json({ 
        success: false, 
        message: 'Please provide location: ?city=CityName OR ?lat=X&lon=Y, or set your profile location in settings.',
        example: 'GET /api/v1/analytics/weather-risk?city=Ichalkaranji'
      });
      return;
    }

    const data = await getWeatherRisk(latitude, longitude);
    // Store last weather snapshot (non-blocking)
    saveWeatherSnapshot(req.user!.id, data).catch(() => null);
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch weather risk';
    res.status(502).json({ success: false, message });
  }
};

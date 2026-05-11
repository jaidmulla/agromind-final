import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';

type ContractSeverity = 'low' | 'medium' | 'high';

function toContractSeverity(value: string | null | undefined): ContractSeverity {
  const severity = (value || '').toLowerCase();
  if (severity === 'critical' || severity === 'high') return 'high';
  if (severity === 'warning' || severity === 'medium') return 'medium';
  return 'low';
}

export const getReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user!.id;
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const severity = req.query.severity ? String(req.query.severity).toLowerCase() : undefined;
    const disease = req.query.disease ? String(req.query.disease) : undefined;
    const cropId = req.query.crop_id ? String(req.query.crop_id) : undefined;

    let where = 'WHERE dr.user_id = $1';
    const params: Array<string | number> = [uid];

    if (severity) {
      where += ` AND dr.severity = $${params.length + 1}`;
      params.push(severity);
    }
    if (disease) {
      where += ` AND dr.disease_name ILIKE $${params.length + 1}`;
      params.push(`%${disease}%`);
    }
    if (cropId) {
      where += ` AND dr.crop_id = $${params.length + 1}`;
      params.push(cropId);
    }

    const [rowsResult, countResult] = await Promise.all([
      query(
        `SELECT dr.id, dr.user_id, dr.crop_id, dr.scan_id, dr.image_path,
                COALESCE(s.disease_name, dr.disease_name) AS disease_name,
                COALESCE(s.confidence, dr.confidence) AS confidence,
                COALESCE(s.recommendation, dr.treatment) AS treatment,
                dr.severity, dr.created_at,
                COALESCE(s.plant_name, c.name) AS crop_name,
                s.plant_name, s.potential_loss, s.disease_info, s.treatment_steps,
                s.regret_insight, s.status, s.image_url
         FROM disease_reports dr
         LEFT JOIN scans s ON s.id = dr.scan_id
         LEFT JOIN crops c ON c.id = dr.crop_id
         ${where}
         ORDER BY dr.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      query(`SELECT COUNT(*)::INT AS total FROM disease_reports dr ${where}`, params),
    ]);

    res.json({
      success: true,
      data: rowsResult.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0]?.total || 0,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch reports' });
  }
};

export const getReportById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user!.id;
    const reportId = req.params.id;

    const reportResult = await query(
      `SELECT dr.id, dr.user_id, dr.crop_id, dr.scan_id, dr.image_path,
              COALESCE(s.disease_name, dr.disease_name) AS disease_name,
              COALESCE(s.confidence, dr.confidence) AS confidence,
              COALESCE(s.recommendation, dr.treatment) AS treatment,
              dr.severity, dr.created_at,
              COALESCE(s.plant_name, c.name) AS crop_name,
              s.plant_name, s.potential_loss, s.disease_info, s.treatment_steps,
              s.regret_insight, s.status, s.image_url
       FROM disease_reports dr
       LEFT JOIN scans s ON s.id = dr.scan_id
       LEFT JOIN crops c ON c.id = dr.crop_id
       WHERE dr.id = $1 AND dr.user_id = $2
       LIMIT 1`,
      [reportId, uid]
    );

    if (!reportResult.rows.length) {
      res.status(404).json({ success: false, message: 'Report not found' });
      return;
    }

    res.json({ success: true, data: reportResult.rows[0] });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch report details' });
  }
};

export const getContractDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user!.id;

    const [totalsR, activeAlertsR, cropsR, recentR] = await Promise.all([
      query(
        `SELECT COUNT(*)::INT AS total_reports,
                COUNT(*) FILTER (WHERE disease_name = 'Healthy')::INT AS healthy_reports
         FROM disease_reports
         WHERE user_id = $1`,
        [uid]
      ),
      query(
        `SELECT COUNT(*)::INT AS active_alerts
         FROM alerts
         WHERE user_id = $1 AND NOT is_resolved`,
        [uid]
      ),
      query(
        `SELECT COUNT(DISTINCT COALESCE(s.plant_name, c.name))::INT AS crops_monitored
         FROM disease_reports dr
         LEFT JOIN scans s ON s.id = dr.scan_id
         LEFT JOIN crops c ON c.id = dr.crop_id
         WHERE dr.user_id = $1
           AND COALESCE(s.plant_name, c.name) IS NOT NULL
           AND COALESCE(s.plant_name, c.name) <> 'Unknown crop'`,
        [uid]
      ),
      query(
        `SELECT dr.id AS report_id, dr.scan_id,
                COALESCE(s.disease_name, dr.disease_name) AS disease_name,
                COALESCE(s.confidence, dr.confidence) AS confidence,
                dr.severity,
                COALESCE(s.image_url, dr.image_path) AS image_path,
                COALESCE(s.plant_name, c.name) AS plant_name,
                dr.created_at
         FROM disease_reports dr
         LEFT JOIN scans s ON s.id = dr.scan_id
         LEFT JOIN crops c ON c.id = dr.crop_id
         WHERE dr.user_id = $1
         ORDER BY dr.created_at DESC
         LIMIT 10`,
        [uid]
      ),
    ]);

    const totalReports = totalsR.rows[0]?.total_reports || 0;
    const healthyReports = totalsR.rows[0]?.healthy_reports || 0;
    const protectionRate = totalReports > 0
      ? Math.round((healthyReports / totalReports) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        active_alerts: activeAlertsR.rows[0]?.active_alerts || 0,
        crops_monitored: cropsR.rows[0]?.crops_monitored || 0,
        protection_rate: protectionRate,
        recent_scans: recentR.rows,
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard' });
  }
};

export const getContractAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user!.id;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);

    let where = 'WHERE a.user_id = $1 AND NOT a.is_resolved';
    const params: Array<string | number> = [uid];

    if (req.query.severity) {
      where += ` AND a.severity = $${params.length + 1}`;
      params.push(String(req.query.severity));
    }

    const alertsR = await query(
      `SELECT a.id,
              a.user_id,
              a.scan_id AS report_id,
              a.scan_id,
              COALESCE(a.description, a.title) AS message,
              a.severity,
              COALESCE(a.is_active, NOT a.is_resolved) AS is_active,
              a.created_at
       FROM alerts a
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const data = alertsR.rows.map((row) => ({
      ...row,
      severity: toContractSeverity(row.severity),
    }));

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
  }
};

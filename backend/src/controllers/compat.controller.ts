import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { calculateRegret, buildRegretTimeline } from '../services/regret.service';
import { getSchemes } from './schemes.controller';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const getHealthTrend = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query(
      `SELECT snapshot_date,
              COALESCE(loss_prevented, 0) AS loss_prevented,
              COALESCE(potential_loss, 0) AS potential_loss,
              COALESCE(crop_health_avg, 0) AS crop_health_avg
       FROM analytics_snapshots
       WHERE user_id=$1
       ORDER BY snapshot_date DESC
       LIMIT 30`,
      [req.user!.id]
    );
    res.json({ success: true, data: r.rows.reverse() });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch health trend' });
  }
};

export const getScansHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query(
      `SELECT id, disease_name, plant_name, confidence, severity, potential_loss, status, source, created_at
       FROM scans
       WHERE user_id=$1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user!.id]
    );
    res.json({ success: true, data: r.rows });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch scans history' });
  }
};

export const getImpactSaved = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query(
      `SELECT COALESCE(SUM(amount_prevented), 0) AS total_saved,
              COUNT(*) AS interventions
       FROM loss_prevention_records
       WHERE user_id=$1`,
      [req.user!.id]
    );
    res.json({ success: true, data: { ...r.rows[0], currency: 'INR' } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch saved impact' });
  }
};

export const predictImpact = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const potentialLoss = Number(req.body?.potential_loss_inr || req.body?.potential_loss || 0);
    const area = Number(req.body?.affected_area_acres || 1);
    const preventableRatio = Math.min(1, Math.max(0, Number(req.body?.preventable_ratio || 0.85)));
    const projectedLoss = Math.max(0, potentialLoss * area);
    const preventable = projectedLoss * preventableRatio;
    const treatmentCost = Math.round(projectedLoss * 0.12);
    const netSaved = Math.max(0, preventable - treatmentCost);

    res.json({
      success: true,
      data: {
        projected_loss_inr: Math.round(projectedLoss),
        preventable_loss_inr: Math.round(preventable),
        estimated_treatment_cost_inr: treatmentCost,
        net_saved_inr: Math.round(netSaved),
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to calculate impact' });
  }
};

export const generateRegret = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const potentialLoss = Number(req.body?.potential_loss_inr || 0);
    const confidence = Number(req.body?.confidence || 70);
    const severity = (req.body?.severity || 'warning') as 'critical' | 'warning' | 'info' | 'healthy';
    const disease = req.body?.disease_name || 'Unknown disease';
    const crop = req.body?.crop_name || 'Unknown crop';

    const result = calculateRegret({
      severity,
      potential_loss_inr: potentialLoss,
      confidence,
      disease_name: disease,
      crop_name: crop,
      urgency_days: Number(req.body?.urgency_days || 7),
    });

    res.json({
      success: true,
      data: {
        ...result,
        timeline: buildRegretTimeline(potentialLoss, Number(req.body?.urgency_days || 7)),
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to generate regret output' });
  }
};

export const getAlertsHeatmap = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query(
      `SELECT ROUND(CAST(u.latitude AS NUMERIC), 2) AS latitude,
              ROUND(CAST(u.longitude AS NUMERIC), 2) AS longitude,
              COUNT(*)::INT AS alert_count,
              MAX(a.severity) AS severity
       FROM alerts a
       JOIN users u ON u.id = a.user_id
       WHERE u.latitude IS NOT NULL
         AND u.longitude IS NOT NULL
         AND NOT a.is_resolved
       GROUP BY ROUND(CAST(u.latitude AS NUMERIC), 2), ROUND(CAST(u.longitude AS NUMERIC), 2)
       ORDER BY alert_count DESC
       LIMIT 200`
    );
    res.json({ success: true, data: r.rows });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch alerts heatmap' });
  }
};

export const getSimulationById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const simulationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!UUID_REGEX.test(simulationId)) {
      res.status(404).json({ success: false, message: 'Simulation not found' });
      return;
    }

    const r = await query(
      `SELECT id, disease_name, severity, potential_loss, confidence, created_at
       FROM scans WHERE id=$1 AND user_id=$2`,
      [simulationId, req.user!.id]
    );
    if (!r.rows.length) {
      res.status(404).json({ success: false, message: 'Simulation not found' });
      return;
    }
    const scan = r.rows[0];
    const urgencyDays = scan.severity === 'critical' ? 2 : scan.severity === 'warning' ? 7 : 14;
    res.json({
      success: true,
      data: {
        ...scan,
        timeline: buildRegretTimeline(Number(scan.potential_loss || 0), urgencyDays),
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch simulation' });
  }
};

export const getRecommendationsById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const recommendationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!UUID_REGEX.test(recommendationId)) {
      res.status(404).json({ success: false, message: 'Recommendations not found' });
      return;
    }

    const r = await query(
      `SELECT id, disease_name, recommendation, treatment_steps, disease_info
       FROM scans WHERE id=$1 AND user_id=$2`,
      [recommendationId, req.user!.id]
    );
    if (!r.rows.length) {
      res.status(404).json({ success: false, message: 'Recommendations not found' });
      return;
    }
    const scan = r.rows[0];
    res.json({
      success: true,
      data: {
        scan_id: scan.id,
        disease_name: scan.disease_name,
        recommendation: scan.recommendation,
        treatment_steps: scan.treatment_steps || [],
        disease_info: scan.disease_info || {},
      },
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch recommendations' });
  }
};

export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const externalRef = req.body?.task_id || req.body?.id;
    const status = req.body?.status || 'pending';
    const title = req.body?.title || 'Task Update';
    const note = req.body?.note || req.body?.description || null;

    if (!externalRef) {
      res.status(400).json({ success: false, message: 'task_id is required' });
      return;
    }

    const r = await query(
      `INSERT INTO tasks (user_id, external_ref, title, status, note)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, external_ref)
       DO UPDATE SET status=EXCLUDED.status, note=EXCLUDED.note, updated_at=NOW()
       RETURNING *`,
      [req.user!.id, String(externalRef), title, status, note]
    );

    res.json({ success: true, data: r.rows[0] });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
};

export const getSchemesCompat = async (req: AuthRequest, res: Response): Promise<void> => {
  await getSchemes(req, res);
};

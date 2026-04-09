/**
 * Loss Prevention Records Controller
 * Handles saving, retrieval, and analytics of loss prevention actions
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import logger from '../utils/logger';

/**
 * Save a loss prevention record when farmer takes action
 * POST /api/v1/losses
 */
export const recordLossPrevention = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { scan_id, alert_id, crop_id, farm_id, amount_prevented, action_taken, notes } = req.body;
    const userId = req.user!.id;

    // Validate input
    if (!amount_prevented || amount_prevented <= 0) {
      res.status(400).json({ success: false, message: 'amount_prevented must be a positive number' });
      return;
    }

    if (!action_taken || action_taken.trim().length === 0) {
      res.status(400).json({ success: false, message: 'action_taken is required' });
      return;
    }

    // Insert loss prevention record
    const result = await query(
      `INSERT INTO loss_prevention_records
        (user_id, scan_id, alert_id, crop_id, amount_prevented, action_taken, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, user_id, amount_prevented, action_taken, recorded_at`,
      [userId, scan_id || null, alert_id || null, crop_id || null, amount_prevented, action_taken]
    );

    if (!result.rows.length) {
      res.status(500).json({ success: false, message: 'Failed to record loss prevention' });
      return;
    }

    const record = result.rows[0];

    // Update crop health score if crop_id provided
    if (crop_id) {
      try {
        await query(
          `UPDATE crops 
           SET health_score = LEAST(100, COALESCE(health_score, 70) + 10),
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2`,
          [crop_id, userId]
        );
      } catch (err) {
        logger.warn(`Could not update crop health for crop ${crop_id}:`, err);
      }
    }

    // Update scan status to 'treated' if scan_id provided
    if (scan_id) {
      try {
        await query(
          `UPDATE scans 
           SET status = 'treated',
               updated_at = NOW()
           WHERE id = $1 AND user_id = $2`,
          [scan_id, userId]
        );
      } catch (err) {
        logger.warn(`Could not update scan status for scan ${scan_id}:`, err);
      }
    }

    // Mark alert as resolved if alert_id provided
    if (alert_id) {
      try {
        await query(
          `UPDATE alerts 
           SET is_resolved = true,
               resolved_at = NOW(),
               resolution_notes = $1
           WHERE id = $2 AND user_id = $3`,
          [action_taken, alert_id, userId]
        );
      } catch (err) {
        logger.warn(`Could not resolve alert ${alert_id}:`, err);
      }
    }

    logger.info(`Loss prevention recorded: ₹${amount_prevented} for user ${userId}`);

    res.json({
      success: true,
      message: 'Loss prevention recorded successfully',
      data: {
        id: record.id,
        amount_prevented: record.amount_prevented,
        action_taken: record.action_taken,
        recorded_at: record.recorded_at,
        status: 'saved',
      },
    });
  } catch (err) {
    logger.error('Error recording loss prevention:', err);
    res.status(500).json({ success: false, message: 'Failed to record loss prevention' });
  }
};

/**
 * Get all loss prevention records for user
 * GET /api/v1/losses
 */
export const getLossRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = '20', offset = '0', crop_id, scan_id } = req.query;
    const userId = req.user!.id;

    let whereClause = 'lpr.user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (crop_id) {
      whereClause += ` AND lpr.crop_id = $${paramIndex}`;
      params.push(crop_id);
      paramIndex++;
    }

    if (scan_id) {
      whereClause += ` AND lpr.scan_id = $${paramIndex}`;
      params.push(scan_id);
      paramIndex++;
    }

    const limitIndex = paramIndex;
    const offsetIndex = paramIndex + 1;
    params.push(parseInt(limit as string, 10));
    params.push(parseInt(offset as string, 10));

    const result = await query(
      `SELECT 
        lpr.id, lpr.scan_id, lpr.alert_id, lpr.crop_id,
        lpr.amount_prevented, lpr.action_taken, lpr.recorded_at,
        s.disease_name, s.plant_name, s.severity,
        c.name as crop_name
       FROM loss_prevention_records lpr
       LEFT JOIN scans s ON lpr.scan_id = s.id
       LEFT JOIN crops c ON lpr.crop_id = c.id
       WHERE ${whereClause}
       ORDER BY lpr.recorded_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM loss_prevention_records lpr WHERE ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({
      success: true,
      data: {
        records: result.rows,
        total: parseInt(countResult.rows[0]?.total || '0'),
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      },
    });
  } catch (err) {
    logger.error('Error fetching loss prevention records:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch loss prevention records' });
  }
};

/**
 * Get loss prevention summary for user
 * GET /api/v1/losses/summary
 */
export const getLossSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period = '30' } = req.query;
    const userId = req.user!.id;
    const days = parseInt(period as string, 10) || 30;

    const result = await query(
      `SELECT 
        COUNT(*) as total_actions,
        COALESCE(SUM(amount_prevented), 0) as total_prevented,
        COALESCE(AVG(amount_prevented), 0) as avg_prevented,
        COALESCE(MAX(amount_prevented), 0) as max_prevented,
        COALESCE(MIN(amount_prevented), 0) as min_prevented
       FROM loss_prevention_records
       WHERE user_id = $1 
         AND recorded_at >= NOW() - INTERVAL '${days} days'`,
      [userId]
    );

    const summary = result.rows[0];

    res.json({
      success: true,
      data: {
        period_days: days,
        total_actions: parseInt(summary.total_actions || '0'),
        total_amount_prevented_inr: Math.round(parseFloat(summary.total_prevented || '0')),
        average_prevention_inr: Math.round(parseFloat(summary.avg_prevented || '0')),
        max_single_prevention_inr: Math.round(parseFloat(summary.max_prevented || '0')),
        min_single_prevention_inr: Math.round(parseFloat(summary.min_prevented || '0')),
      },
    });
  } catch (err) {
    logger.error('Error fetching loss summary:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch loss summary' });
  }
};

/**
 * Delete a loss prevention record
 * DELETE /api/v1/losses/:id
 */
export const deleteLossRecord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await query(
      `DELETE FROM loss_prevention_records 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (!result.rows.length) {
      res.status(404).json({ success: false, message: 'Loss prevention record not found' });
      return;
    }

    logger.info(`Deleted loss prevention record ${id} for user ${userId}`);

    res.json({ success: true, message: 'Loss prevention record deleted' });
  } catch (err) {
    logger.error('Error deleting loss prevention record:', err);
    res.status(500).json({ success: false, message: 'Failed to delete loss prevention record' });
  }
};

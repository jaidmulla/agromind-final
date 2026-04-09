import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import logger from '../utils/logger';

/**
 * Loss Prevention UI Component API
 * Provides comprehensive losses tracking and visualization
 */

export const getLossPreventionStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { period = '30' } = req.query;
    const days = parseInt(period as string, 10) || 30;

    // Get aggregated stats
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_actions,
        COALESCE(SUM(amount_prevented), 0) as total_prevented,
        COALESCE(AVG(amount_prevented), 0) as avg_prevented,
        COALESCE(MAX(amount_prevented), 0) as max_prevented,
        COALESCE(MIN(amount_prevented), 0) as min_prevented,
        MAX(recorded_at) as last_action_date
       FROM loss_prevention_records lpr
       WHERE lpr.user_id = $1 
         AND lpr.recorded_at >= NOW() - INTERVAL '${days} days'`,
      [userId]
    );

    // Get by action type
    const byTypeResult = await query(
      `SELECT 
        action_taken,
        COUNT(*) as count,
        SUM(amount_prevented) as total,
        AVG(amount_prevented) as avg
       FROM loss_prevention_records lpr
       WHERE lpr.user_id = $1 
         AND lpr.recorded_at >= NOW() - INTERVAL '${days} days'
       GROUP BY action_taken
       ORDER BY total DESC`,
      [userId]
    );

    // Get by crop
    const byCropResult = await query(
      `SELECT 
        c.name as crop_name,
        COUNT(*) as actions_count,
        COALESCE(SUM(lpr.amount_prevented), 0) as total_prevented
       FROM loss_prevention_records lpr
       LEFT JOIN crops c ON lpr.crop_id = c.id
       WHERE lpr.user_id = $1 
         AND lpr.recorded_at >= NOW() - INTERVAL '${days} days'
       GROUP BY c.id, c.name
       ORDER BY total_prevented DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        period_days: days,
        summary: statsResult.rows[0],
        by_action_type: byTypeResult.rows,
        by_crop: byCropResult.rows,
      },
    });
  } catch (err) {
    logger.error('Error fetching loss prevention stats:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch loss stats' });
  }
};

/**
 * Advanced Loss Prevention Search & Filter
 * Returns records with detailed filtering
 */
export const searchLossRecords = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { crop_name, action_type, min_amount, max_amount, startDate, endDate } = req.query;
    const userId = req.user!.id;
    
    let whereClause = 'lpr.user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (crop_name) {
      whereClause += ` AND LOWER(c.name) LIKE LOWER($${paramIndex})`;
      params.push(`%${crop_name}%`);
      paramIndex++;
    }

    if (action_type) {
      whereClause += ` AND LOWER(lpr.action_taken) LIKE LOWER($${paramIndex})`;
      params.push(`%${action_type}%`);
      paramIndex++;
    }

    if (min_amount) {
      whereClause += ` AND lpr.amount_prevented >= $${paramIndex}`;
      params.push(parseFloat(min_amount as string));
      paramIndex++;
    }

    if (max_amount) {
      whereClause += ` AND lpr.amount_prevented <= $${paramIndex}`;
      params.push(parseFloat(max_amount as string));
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND lpr.recorded_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND lpr.recorded_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const result = await query(
      `SELECT 
        lpr.id, lpr.crop_id, lpr.amount_prevented, lpr.action_taken,
        lpr.recorded_at, c.name as crop_name,
        s.disease_name, s.severity
       FROM loss_prevention_records lpr
       LEFT JOIN crops c ON lpr.crop_id = c.id
       LEFT JOIN scans s ON lpr.scan_id = s.id
       WHERE ${whereClause}
       ORDER BY lpr.recorded_at DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        records: result.rows,
        count: result.rows.length,
      },
    });
  } catch (err) {
    logger.error('Error searching loss records:', err);
    res.status(500).json({ success: false, message: 'Failed to search records' });
  }
};

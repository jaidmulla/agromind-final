/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { generateAIDoctorRecommendations, completeTask, getTasks } from '../services/ai-doctor.service';
import logger from '../utils/logger';

/**
 * GET /api/v1/ai-doctor/recommendations/:scanId
 * Get AI Doctor recommendations for a specific scan
 */
// Helper: safely extract string from query params
function getStringQueryParam(value: any, defaultValue: string = ''): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return String(value[0] || defaultValue);
  return defaultValue;
}

// Cast query string to non-array string type
function castStringParam(value: any): string {
  return typeof value === 'string' ? value : (Array.isArray(value) ? value[0] || '' : '');
}

export const getRecommendationsByScán = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const scanId = String(req.params.scanId);
    const language = getStringQueryParam(req.query.language, 'en');

    // Verify scan belongs to user
    const scanResult = await query(
      `SELECT id, user_id, crop_id, plant_name, disease_name, severity, 
              confidence, potential_loss, latitude, longitude, location
       FROM scans WHERE id = $1 AND user_id = $2`,
      [scanId, userId]
    );

    if (!scanResult.rows.length) {
      res.status(404).json({ success: false, message: 'Scan not found' });
      return;
    }

    const scan = scanResult.rows[0];

    // Generate AI Doctor recommendations
    const recommendations = await generateAIDoctorRecommendations({
      id: scan.id,
      user_id: scan.user_id,
      crop_id: scan.crop_id,
      plant_name: scan.plant_name,
      disease_name: scan.disease_name,
      severity: scan.severity,
      confidence: scan.confidence,
      potential_loss: scan.potential_loss,
      latitude: scan.latitude,
      longitude: scan.longitude,
      location: scan.location,
    });

    // Apply language transformation if needed (hi/mr)
    const langParam = castStringParam(req.query.language) || 'en';
    const translated = langParam !== 'en' 
      ? translateRecommendations(recommendations, langParam)
      : recommendations;

    res.json({
      success: true,
      data: translated,
    });
  } catch (err) {
    logger.error('Error fetching AI Doctor recommendations', err);
    res.status(500).json({ success: false, message: 'Failed to fetch recommendations' });
  }
};

/**
 * GET /api/v1/ai-doctor/tasks/:scanId
 * Get tasks for a specific scan
 */
export const getTasksByScan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const scanId = String(req.params.scanId);

    // Verify scan belongs to user
    const scanResult = await query(
      `SELECT id FROM scans WHERE id = $1 AND user_id = $2`,
      [scanId, userId]
    );

    if (!scanResult.rows.length) {
      res.status(404).json({ success: false, message: 'Scan not found' });
      return;
    }

    const tasks = await getTasks(userId, scanId);

    res.json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (err) {
    logger.error('Error fetching AI Doctor tasks', err);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
};

/**
 * PUT /api/v1/ai-doctor/tasks/:taskId/complete
 * Mark a task as completed
 */
export const completeAITask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const taskId = String(req.params.taskId);

    // Verify task belongs to user
    const taskResult = await query(
      `SELECT id FROM ai_doctor_tasks WHERE id = $1 AND user_id = $2`,
      [taskId, userId]
    );

    if (!taskResult.rows.length) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    await completeTask(taskId);

    res.json({
      success: true,
      message: 'Task completed successfully',
      data: { task_id: taskId, status: 'completed' },
    });
  } catch (err) {
    logger.error('Error completing AI Doctor task', err);
    res.status(500).json({ success: false, message: 'Failed to complete task' });
  }
};

/**
 * GET /api/v1/ai-doctor/all-tasks
 * Get all AI Doctor tasks for the logged-in user
 */
function getStringParam(value: any): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0) return String(value[0]);
  return undefined;
}

export const getAllUserTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const status = getStringParam(req.query.status);
    const priority = getStringParam(req.query.priority);
    const limitStr = getStringParam(req.query.limit) || '50';
    const offsetStr = getStringParam(req.query.offset) || '0';
    const limit = parseInt(limitStr);
    const offset = parseInt(offsetStr);

    let sql = `SELECT * FROM ai_doctor_tasks WHERE user_id = $1`;
    const params: any[] = [userId];

    if (status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (priority && !Array.isArray(priority)) {
      sql += ` AND priority = $${params.length + 1}`;
      params.push(priority);
    }

    sql += ` ORDER BY day ASC, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit);
    params.push(offset);

    const result = await query(sql, params);

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM ai_doctor_tasks WHERE user_id = $1`;
    const countParams: any[] = [userId];
    
    if (status) {
      countSql += ` AND status = $${countParams.length + 1}`;
      countParams.push(status);
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0]?.total || 0);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (err) {
    logger.error('Error fetching user AI Doctor tasks', err);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
};

/**
 * GET /api/v1/ai-doctor/dashboard
 * Get AI Doctor dashboard with summary
 */
export const getAIDoctorDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Get pending tasks count
    const pendingResult = await query(
      `SELECT COUNT(*) as count FROM ai_doctor_tasks 
       WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );

    // Get urgent tasks
    const urgentResult = await query(
      `SELECT * FROM ai_doctor_tasks 
       WHERE user_id = $1 AND status = 'pending' AND priority = 'urgent'
       ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );

    // Get total cost of pending tasks
    const costResult = await query(
      `SELECT COALESCE(SUM(cost_inr), 0) as total_cost FROM ai_doctor_tasks 
       WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );

    // Get disease breakdown
    const diseaseResult = await query(
      `SELECT disease_name, COUNT(*) as count FROM ai_doctor_tasks 
       WHERE user_id = $1 AND status = 'pending'
       GROUP BY disease_name
       ORDER BY count DESC LIMIT 5`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        pending_tasks: parseInt(pendingResult.rows[0]?.count || 0),
        urgent_tasks: urgentResult.rows,
        total_pending_cost_inr: parseFloat(costResult.rows[0]?.total_cost || 0),
        disease_breakdown: diseaseResult.rows,
      },
    });
  } catch (err) {
    logger.error('Error fetching AI Doctor dashboard', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
};

// ── LANGUAGE SUPPORT ────────────────────────────────────────────────────────

const HINDI_TRANSLATIONS: Record<string, string> = {
  'Scout & Remove Lower Leaves': 'खेत की निगरानी करें और निचली पत्तियों को हटाएं',
  'First Spray - Mancozeb': 'पहली बार स्प्रे - मैंकोजेब',
  'Monitor Crop': 'फसल की निगरानी करें',
  'Early Blight': 'अर्ली ब्लाइट (शुरुआती सड़न)',
  'summary': 'सारांश',
  'urgent': 'तत्काल',
  'recommended': 'अनुशंसित',
  'optional': 'वैकल्पिक',
  'high': 'उच्च',
  'medium': 'मध्यम',
  'low': 'कम',
  'CRITICAL - Act TODAY': 'गंभीर - आज कार्रवाई करें',
  'HIGH - Act within 24 hours': 'उच्च - 24 घंटे में कार्रवाई करें',
  'MODERATE - Act within 48 hours': 'मध्यम - 48 घंटे में कार्रवाई करें',
};

const MARATHI_TRANSLATIONS: Record<string, string> = {
  'Scout & Remove Lower Leaves': 'शेतात पाहणी करा आणि खालच्या पानांना हटवा',
  'First Spray - Mancozeb': 'पहिली फवारणी - मॅनकोजेब',
  'Monitor Crop': 'पिकांचे निरीक्षण करा',
  'Early Blight': 'आर्ली ब्लाइट (प्रारंभिक सड़न)',
  'summary': 'सारांश',
  'urgent': 'जरुरी',
  'recommended': 'अनुशंसित',
  'optional': 'वैकल्पिक',
  'high': 'उच्च',
  'medium': 'माध्यम',
  'low': 'कमी',
  'CRITICAL - Act TODAY': 'गंभीर - आज कार्य करा',
};

function translateRecommendations(recommendations: any, language: string | undefined): any {
  if (!language || (language !== 'hi' && language !== 'mr')) return recommendations;

  const translations = language === 'hi' ? HINDI_TRANSLATIONS : MARATHI_TRANSLATIONS;
  
  const translate = (text: string): string => {
    return translations[text] || text;
  };

  return {
    ...recommendations,
    summary: translate(recommendations.summary),
    disease_name: translate(recommendations.disease_name),
    tasks: recommendations.tasks.map((task: any) => ({
      ...task,
      title: translate(task.title),
      priority: translate(task.priority),
      urgency_level: translate(task.urgency_level),
    })),
    urgency: translate(recommendations.urgency),
  };
}

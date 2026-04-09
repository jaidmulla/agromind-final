import cron from 'node-cron';
import { query } from '../utils/database';
import logger from '../utils/logger';

// ── Analytics Snapshot Scheduler (hourly) ──────────────────────────────────

async function createAnalyticsSnapshots(): Promise<void> {
  try {
    logger.info('📊 Creating hourly analytics snapshots...');

    // Get all active users
    const usersRes = await query(
      `SELECT DISTINCT user_id FROM scans
       WHERE created_at >= NOW() - INTERVAL '30 days'
       UNION ALL
       SELECT DISTINCT user_id FROM alerts
       WHERE created_at >= NOW() - INTERVAL '30 days'`,
      []
    );

    if (!usersRes.rows.length) {
      logger.info('No users with recent activity');
      return;
    }

    let createdCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const row of usersRes.rows) {
      try {
        const userId = row.user_id;

        // Check if snapshot exists for today
        const existingRes = await query(
          `SELECT id FROM analytics_snapshots
           WHERE user_id = $1 AND snapshot_date = CURRENT_DATE`,
          [userId]
        );

        if (existingRes.rows.length > 0) {
          continue; // Already created for today
        }

        // Calculate metrics
        const metricsRes = await query(
          `SELECT 
            COUNT(CASE WHEN severity = 'critical' AND NOT is_resolved THEN 1 END) as critical_count,
            COUNT(CASE WHEN NOT is_resolved THEN 1 END) as total_unresolved,
            COUNT(CASE WHEN is_resolved THEN 1 END) as resolved_count,
            COUNT(DISTINCT type) as alert_types,
            COALESCE(SUM(potential_loss), 0) as total_potential_loss
           FROM alerts WHERE user_id = $1
             AND created_at >= NOW() - INTERVAL '24 hours'`,
          [userId]
        );

        const preventionRes = await query(
          `SELECT 
            COUNT(*) as scans_count,
            COALESCE(SUM(amount_prevented), 0) as total_prevented,
            AVG(CAST(health_score AS FLOAT)) as avg_health
           FROM (
             SELECT s.id, COALESCE(lp.amount_prevented, 0) as amount_prevented, c.health_score
             FROM scans s
             LEFT JOIN loss_prevention_records lp ON s.id = lp.scan_id
             LEFT JOIN crops c ON s.crop_id = c.id
             WHERE s.user_id = $1
               AND s.created_at >= NOW() - INTERVAL '24 hours'
           ) subquery`,
          [userId]
        );

        if (metricsRes.rows.length === 0 || preventionRes.rows.length === 0) {
          continue;
        }

        const metrics = metricsRes.rows[0];
        const prevention = preventionRes.rows[0];

        // Create snapshot
        await query(
          `INSERT INTO analytics_snapshots 
            (user_id, snapshot_date, total_alerts, resolved_alerts, loss_prevented, potential_loss, scans_count, crop_health_avg)
           VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
            total_alerts = EXCLUDED.total_alerts,
            resolved_alerts = EXCLUDED.resolved_alerts,
            loss_prevented = EXCLUDED.loss_prevented,
            potential_loss = EXCLUDED.potential_loss,
            scans_count = EXCLUDED.scans_count,
            crop_health_avg = EXCLUDED.crop_health_avg`,
          [
            userId,
            metrics.total_unresolved || 0,
            metrics.resolved_count || 0,
            prevention.total_prevented || 0,
            metrics.total_potential_loss || 0,
            prevention.scans_count || 0,
            prevention.avg_health || 100,
          ]
        );

        createdCount++;
      } catch (err) {
        logger.error(`Failed to create snapshot for user ${row.user_id}:`, err);
      }
    }

    // Cleanup old snapshots (older than 90 days)
    await query(
      `DELETE FROM analytics_snapshots
       WHERE snapshot_date < CURRENT_DATE - INTERVAL '90 days'`,
      []
    );

    logger.info(`✅ Analytics snapshots created: ${createdCount}`);
  } catch (err) {
    logger.error('Analytics snapshot job failed:', err);
  }
}

// ── Initialize Analytics Snapshot Cron Job ────────────────────────────────

export function startAnalyticsSnapshotJob(): any {
  logger.info('Starting analytics snapshot scheduler...');

  // Run at :05 every hour (5 minutes after the top of the hour)
  const job = cron.schedule('5 * * * *', createAnalyticsSnapshots);

  // Run once at startup after 60 seconds
  setTimeout(createAnalyticsSnapshots, 60000);

  return job;
}

export { createAnalyticsSnapshots };

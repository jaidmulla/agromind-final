import { query } from '../utils/database';
import { sendAlertToUser } from '../services/alert.service';
import logger from '../utils/logger';

// ── Haversine Distance Calculator ──────────────────────────────────────────

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Nearby Disease Alert Trigger (event-based) ─────────────────────────────

export async function triggerNearbyDiseaseAlerts(scanData: {
  userId: string;
  diseaseName: string;
  plantName: string;
  latitude: number;
  longitude: number;
  confidence: number;
  potential_loss: number;
}): Promise<void> {
  try {
    logger.info(`🔴 Checking for nearby farmers to alert about ${scanData.diseaseName}...`);

    // Find farmers within 10 km with the same or similar crops (using Haversine formula in app)
    const nearbyFarmersRes = await query(
      `SELECT u.id, u.name, u.phone, u.email, u.latitude, u.longitude
       FROM users u
       LEFT JOIN notification_preferences np ON u.id = np.user_id
       WHERE u.id != $1
         AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL
         AND u.latitude >= $2 - 0.15 AND u.latitude <= $2 + 0.15
         AND u.longitude >= $3 - 0.15 AND u.longitude <= $3 + 0.15
         AND np.nearby_farmer_alerts = true
         AND u.notification_enabled = true
       LIMIT 20`,
      [scanData.userId, scanData.latitude, scanData.longitude]
    );

    // Filter by actual distance (Haversine formula)
    const nearbyFarmers = nearbyFarmersRes.rows
      .map(farmer => ({
        ...farmer,
        distance_km: calculateDistance(
          scanData.latitude,
          scanData.longitude,
          farmer.latitude,
          farmer.longitude
        ),
      }))
      .filter(farmer => farmer.distance_km <= 10)
      .sort((a, b) => a.distance_km - b.distance_km);

    if (!nearbyFarmers || nearbyFarmers.length === 0) {
      logger.info('No nearby farmers found within 10 km');
      return;
    }

    let alertCount = 0;

    for (const farmer of nearbyFarmers) {
      try {
        // Check if farmer grows the same crop (by checking their crops table)
        const cropRes = await query(
          `SELECT COUNT(*) as count FROM crops
           WHERE user_id = $1
           AND LOWER(name) LIKE LOWER($2)
           LIMIT 1`,
          [farmer.id, `%${scanData.plantName}%`]
        );

        const farmerGrowsSameCrop = cropRes.rows[0]?.count > 0;

        if (!farmerGrowsSameCrop) {
          continue; // Skip if crop doesn't match
        }

        // Save to nearby_alerts table (for tracking)
        const alertRes = await query(
          `SELECT id FROM alerts WHERE user_id = $1 AND type = 'disease'
           ORDER BY created_at DESC LIMIT 1`,
          [scanData.userId]
        );

        if (alertRes.rows.length > 0) {
          const alertId = alertRes.rows[0].id;

          await query(
            `INSERT INTO nearby_alerts (alert_id, notified_user_id, distance_km)
             VALUES ($1, $2, $3)
             ON CONFLICT (alert_id, notified_user_id) DO NOTHING`,
            [alertId, farmer.id, farmer.distance_km]
          );
        }

        // Send notification
        const message = {
          title: `🔴 Disease Spread Alert`,
          body: `Urgent: ${scanData.diseaseName} detected ${Math.round(farmer.distance_km)}km away on ${scanData.plantName} (${Math.round(scanData.confidence)}% confidence). Potential loss: ₹${Math.round(scanData.potential_loss)}. Inspect your farm immediately!`,
          subject: `🔴 Disease Alert: ${scanData.diseaseName} Detected Nearby`,
          phone: farmer.phone,
          email: farmer.email,
          pushTitle: `Disease Spread: ${scanData.diseaseName} ${Math.round(farmer.distance_km)}km away`,
        };

        await sendAlertToUser(message, farmer.id);
        alertCount++;

        // Rate limit: sleep between messages
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        logger.error(`Failed to send nearby alert to farmer ${farmer.id}:`, err);
      }
    }

    logger.info(`✅ Sent ${alertCount} nearby disease spread alerts`);
  } catch (err) {
    logger.error('Nearby disease alert trigger failed:', err);
  }
}

export async function logNearbyDiseaseCount(scanId: string): Promise<number> {
  try {
    const res = await query(
      `SELECT COUNT(DISTINCT notified_user_id) as count
       FROM nearby_alerts na
       WHERE na.alert_id IN (
         SELECT id FROM alerts WHERE scan_id = $1
       )`,
      [scanId]
    );
    return parseInt(res.rows[0]?.count || 0);
  } catch (err) {
    logger.error('Failed to get nearby alert count:', err);
    return 0;
  }
}

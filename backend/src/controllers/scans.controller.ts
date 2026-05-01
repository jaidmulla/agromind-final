import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { analyzeImageWithAI } from '../services/ai.service';
import { predictWithML } from '../services/ml.service';
import { calculateRegret, buildRegretTimeline } from '../services/regret.service';
import { sendAlertToUser } from '../services/alert.service';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

function normalizeCropName(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z]/g, '');
}

// ✅ FIX: Clean disease names that include plant names (e.g., "Healthy Tomato" → "Healthy")
function cleanDiseaseName(rawDiseaseName: string): string {
  if (!rawDiseaseName) return 'Healthy';

  // Remove common plant names that might be appended to disease names
  const plantNamesToRemove = [
    'tomato', 'potato', 'pepper', 'chilli', 'onion', 'garlic', 'brinjal',
    'cucumber', 'pumpkin', 'melon', 'watermelon', 'carrot', 'beet',
    'spinach', 'cabbage', 'cauliflower', 'bean', 'pea', 'maize', 'corn',
    'wheat', 'rice', 'sugarcane', 'cotton', 'apple', 'mango', 'banana',
    'grape', 'citrus', 'lemon', 'orange', 'coconut', 'palm', 'sugarbeet'
  ];

  let cleaned = rawDiseaseName.trim();

  // If it starts with "Healthy", extract just "Healthy"
  if (cleaned.toLowerCase().startsWith('healthy')) {
    // Check if there's a plant name after "Healthy"
    const afterHealthy = cleaned.substring(7).trim();
    if (afterHealthy && plantNamesToRemove.includes(afterHealthy.toLowerCase())) {
      return 'Healthy';
    }
    return 'Healthy';
  }

  // Remove trailing plant names
  for (const plantName of plantNamesToRemove) {
    const plantRegex = new RegExp(`\\b${plantName}\\s*$`, 'i');
    if (plantRegex.test(cleaned)) {
      cleaned = cleaned.replace(plantRegex, '').trim();
    }
  }

  return cleaned || 'Healthy';
}


function buildFallbackAnalysisFromML(ml: NonNullable<Awaited<ReturnType<typeof predictWithML>>>) {
  const isHealthy = ml.is_healthy || /healthy/i.test(ml.disease || '');
  const severity: 'critical' | 'warning' | 'info' | 'healthy' =
    (ml.severity as 'critical' | 'warning' | 'info' | 'healthy' | undefined)
    || (isHealthy ? 'healthy' : 'info');

  const projectedLoss = isHealthy
    ? 0
    : Math.round((ml.loss_per_acre_inr || 0) * Math.max(0.2, ml.confidence / 100));

  const treatment = ml.disease_info?.treatment
    || ml.disease_info?.prevention
    || 'Consult local agronomy expert for treatment plan.';
  const spread = ml.disease_info?.spread_mechanism || '';
  const symptoms = ml.disease_info?.symptoms || [];
  const lowConfidence = ml.confidence < 25;
  const lowConfidenceNote = 'Model confidence is low. Re-upload a clear, close-up leaf image in natural light for better accuracy.';

  // Generate realistic treatment steps based on disease
  const generateTreatmentSteps = () => {
    if (isHealthy) {
      return [
        { step: 1, title: 'Continue Monitoring', description: 'Maintain regular crop health checks every 7-10 days.', duration: 'Ongoing' },
        { step: 2, title: 'Preventive Care', description: 'Ensure proper drainage, adequate sunlight, and crop rotation in subsequent seasons.', duration: 'Ongoing' },
      ];
    }
    
    return [
      { step: 1, title: 'Isolate Affected Area', description: `Isolate the affected ${ml.plant} plant(s) to prevent spread to adjacent plants. Use gloves and clean tools after handling.`, duration: '30 min', product: 'Heavy-duty gloves' },
      { step: 2, title: 'Prune Infected Leaves', description: 'Carefully prune and remove all diseased leaves using sterilized pruning shears. Dispose in a sealed bag (do not compost).', duration: '45 min', product: 'Sterilized pruning shears' },
      { step: 3, title: 'Apply Fungicide/Treatment', description: `Apply prescribed treatment: ${treatment}. Spray thoroughly on all leaf surfaces and stem.`, duration: '30-45 min', product: ml.disease_info?.product_name || 'Fungicide/Pesticide as recommended', dosage: ml.disease_info?.dosage || 'As per product label' },
      { step: 4, title: 'Environmental Control', description: `Reduce humidity by improving air circulation. Water at soil level, not foliage. Maintain ${ml.disease_info?.optimal_temp || '18-25'}°C temperature if possible.`, duration: 'Daily' },
      { step: 5, title: 'Monitor & Re-apply', description: 'Re-scan affected area after 3-7 days. If symptoms persist, apply treatment again and consult local agronomist.', duration: 'Every 3-7 days' },
      { step: 6, title: 'Prevention for Future', description: `Implement crop rotation, maintain field hygiene, use disease-resistant varieties next season, and remove crop debris immediately after harvest.`, duration: 'Ongoing' },
    ];
  };

  return {
    disease_name: ml.disease,
    plant_name: ml.plant,
    confidence: ml.confidence || 0,
    severity,
    potential_loss_inr: projectedLoss,
    recommendation: lowConfidence ? lowConfidenceNote : treatment,
    regret_insight: lowConfidence
      ? 'Detection uncertain due to low confidence. Capture a better image to avoid wrong treatment decisions.'
      : (ml.regret_ai?.message || (isHealthy ? 'No immediate threat detected. Continue routine monitoring.' : `Potential spread risk within ${ml.urgency_days || 7} days.`)),
    treatment_steps: generateTreatmentSteps(),
    disease_info: {
      scientific_name: ml.disease_info?.scientific_name || '',
      affected_crops: ml.plant ? [ml.plant] : [],
      spread_mechanism: spread,
      prevention: treatment,
      symptoms,
    },
    behavioral_triggers: {
      ...(ml.behavioral_triggers || {}),
      loss_framing: `Estimated preventable loss: ₹${projectedLoss.toLocaleString('en-IN')}`,
      urgency_statement: lowConfidence ? 'Retake image first for accurate recommendation.' : (isHealthy ? 'No urgent action needed.' : 'Treat within the next 24-72 hours for best recovery.'),
      social_proof: 'Farmers who act in the first 48 hours usually prevent larger losses.',
      action_cta: lowConfidence ? 'Retake photo in daylight and scan again.' : (isHealthy ? 'Continue weekly scanning.' : 'Start treatment today and re-scan in 2 days.'),
    },
  };
}

function normalizeTreatmentSteps(
  steps: Array<Record<string, unknown>> | undefined,
  severity: 'critical' | 'warning' | 'info' | 'healthy',
  treatmentCostInr: number
) {
  const safeSteps = Array.isArray(steps) && steps.length > 0
    ? steps
    : [{ title: 'Immediate field inspection', description: 'Inspect affected area and start treatment as soon as possible.', duration: '30 min' }];

  const perStepBaseCost = safeSteps.length > 0
    ? Math.max(0, Math.round(treatmentCostInr / safeSteps.length))
    : 0;

  return safeSteps.map((raw, index) => {
    const stepNum = index + 1;
    const title = String(raw.title || `Step ${stepNum}`);
    const description = String(raw.description || 'Follow agronomy best practices for this step.');
    const duration = String(raw.duration || '30 min');
    const product = raw.product ? String(raw.product) : undefined;
    const dosage = raw.dosage ? String(raw.dosage) : undefined;

    const urgency = severity === 'critical'
      ? (stepNum <= 2 ? 'high' : 'medium')
      : severity === 'warning'
      ? (stepNum <= 2 ? 'medium' : 'low')
      : 'low';

    return {
      step: stepNum,
      title,
      description,
      duration,
      product,
      dosage,
      urgency,
      estimated_cost_inr: perStepBaseCost,
      checklist_id: `step-${stepNum}`,
    };
  });
}

export const createScan = async (req: AuthRequest, res: Response): Promise<void> => {
  const imagePath = req.file?.path;
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'Image file is required' });
      return;
    }

    const { crop_id, farm_id, crop_name } = req.body;
    const imageUrl = `/uploads/${req.file.filename}`;

    // ✅ FIX: Validate crop_id belongs to user
    let linkedCropName = '';
    if (crop_id) {
      const linkedCrop = await query('SELECT name FROM crops WHERE id = $1 AND user_id = $2 LIMIT 1', [crop_id, req.user!.id]);
      if (!linkedCrop.rows.length) {
        res.status(403).json({ success: false, message: 'Crop not found or does not belong to this user' });
        return;
      }
      linkedCropName = linkedCrop.rows[0]?.name || '';
    }

    // ✅ FIX: Validate farm_id belongs to user
    if (farm_id) {
      const linkedFarm = await query('SELECT id FROM farms WHERE id = $1 AND user_id = $2 LIMIT 1', [farm_id, req.user!.id]);
      if (!linkedFarm.rows.length) {
        res.status(403).json({ success: false, message: 'Farm not found or does not belong to this user' });
        return;
      }
    }

    // Run ML + AI in parallel for speed
    const [mlResult, aiResult] = await Promise.allSettled([
      predictWithML(imagePath!),
      analyzeImageWithAI(imagePath!),
    ]);

    const ai = aiResult.status === 'fulfilled' ? aiResult.value : null;
    const ml = mlResult.status === 'fulfilled' ? mlResult.value : null;

    if (!ml && !ai) {
      res.status(503).json({ success: false, message: 'Disease detection services are temporarily unavailable. Please retry shortly.' });
      return;
    }

    const analysis = ai || (ml ? buildFallbackAnalysisFromML(ml) : null);
    if (!analysis) {
      res.status(503).json({ success: false, message: 'Unable to analyze scan at the moment. Please retry shortly.' });
      return;
    }

    // Merge ML confidence (more precise) with AI analysis (richer context)
    const finalConfidence = ai && ml
      ? Math.round((analysis.confidence * 0.55 + ml.confidence * 0.45) * 10) / 10
      : analysis.confidence;
    const source = ai && ml ? 'combined' : ai ? 'ai' : 'ml';

    // Use ML disease name if available and confidence is high
    const diseaseName = cleanDiseaseName(
      (ml && ml.confidence > 75) ? ml.disease : analysis.disease_name
    );
    let plantName = (ml && ml.plant) ? ml.plant : (analysis.plant_name || crop_name || 'Unknown');

    const expectedCrop = linkedCropName || crop_name || '';
    const expectedNorm = normalizeCropName(expectedCrop);
    const detectedNorm = normalizeCropName(plantName);
    
    // ✅ NEW FIX: If farmer explicitly provided crop_name or crop_id, TRUST IT (for low confidence)
    // This solves: "I uploaded potato leaf but it says tomato"
    if (expectedNorm && detectedNorm && expectedNorm !== detectedNorm) {
      if (finalConfidence < 70) {
        // Low confidence - trust the explicitly provided crop name
        logger.warn('Crop mismatch with low confidence: using provided crop name', {
          detected: plantName,
          provided: expectedCrop,
          confidence: finalConfidence,
          user_id: req.user!.id
        });
        plantName = expectedCrop;
      }
    }

    // Merge symptoms from both sources
    const symptoms = [
      ...(analysis.disease_info?.symptoms || []),
      ...(ml?.disease_info?.symptoms || []),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);

    const mergedDiseaseInfo = {
      scientific_name: analysis.disease_info?.scientific_name || ml?.disease_info?.scientific_name || '',
      affected_crops: analysis.disease_info?.affected_crops || [],
      spread_mechanism: analysis.disease_info?.spread_mechanism || ml?.disease_info?.spread_mechanism || '',
      prevention: analysis.disease_info?.prevention || ml?.disease_info?.prevention || '',
      symptoms,
    };

    // Calculate Regret AI score
    const regretAnalysis = calculateRegret({
      severity: analysis.severity,
      potential_loss_inr: analysis.potential_loss_inr,
      confidence: finalConfidence,
      urgency_days: ml?.urgency_days,
      disease_name: diseaseName,
      crop_name: plantName,
    });

    const regretTimeline = buildRegretTimeline(analysis.potential_loss_inr, ml?.urgency_days || 7);

    // Build enriched behavioral triggers
    const behavioralTriggers = {
      ...(analysis.behavioral_triggers || {}),
      ...(ml?.behavioral_triggers || {}),
      regret_score: regretAnalysis.regret_score,
      urgency_level: regretAnalysis.urgency_level,
      emotional_message: regretAnalysis.emotional_message,
      financial_message: regretAnalysis.financial_message,
      social_proof: regretAnalysis.social_proof,
      countdown_message: regretAnalysis.countdown_message,
      daily_loss_inr: regretAnalysis.daily_loss_inr,
      weekly_loss_inr: regretAnalysis.weekly_loss_inr,
      treatment_cost_inr: regretAnalysis.treatment_cost_inr,
      roi_multiplier: regretAnalysis.roi_multiplier,
      loss_timeline: regretTimeline,
    };

    const normalizedTreatmentSteps = normalizeTreatmentSteps(
      (analysis.treatment_steps as Array<Record<string, unknown>> | undefined),
      analysis.severity,
      regretAnalysis.treatment_cost_inr
    );

    const r = await query(
      `INSERT INTO scans
         (user_id, crop_id, farm_id, image_url, image_filename, disease_name, plant_name,
          confidence, severity, potential_loss, recommendation, regret_insight,
          treatment_steps, disease_info, ml_raw_result, ai_response, source, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'analyzed')
       RETURNING *`,
      [
        req.user!.id,
        crop_id || null,
        farm_id || null,
        imageUrl,
        req.file.filename,
        diseaseName,
        plantName,
        finalConfidence,
        analysis.severity,
        analysis.potential_loss_inr,
        analysis.recommendation,
        analysis.regret_insight,
        JSON.stringify(normalizedTreatmentSteps),
        JSON.stringify({ ...mergedDiseaseInfo, behavioral_triggers: behavioralTriggers }),
        ml ? JSON.stringify(ml) : null,
        ai ? JSON.stringify({ ...ai, behavioral_triggers: behavioralTriggers }) : null,
        source,
      ]
    );

    const scan = r.rows[0];

    // Auto-create alert for critical/warning
    if (analysis.severity === 'critical' || analysis.severity === 'warning') {
      const timeLeft = analysis.severity === 'critical' ? 7200 : 86400;
      const preventable = Math.round(analysis.potential_loss_inr * 0.85);
      // Resolve alert geo coordinates (farm -> crop -> user fallback)
      let alertLat: number | null = null;
      let alertLon: number | null = null;
      if (farm_id) {
        const farmR = await query(
          `SELECT latitude, longitude FROM farms WHERE id=$1 AND user_id=$2`,
          [farm_id, req.user!.id]
        );
        alertLat = Number(farmR.rows[0]?.latitude);
        alertLon = Number(farmR.rows[0]?.longitude);
      } else if (crop_id) {
        const cropR = await query(
          `SELECT f.latitude, f.longitude
           FROM crops c LEFT JOIN farms f ON f.id=c.farm_id
           WHERE c.id=$1 AND c.user_id=$2`,
          [crop_id, req.user!.id]
        );
        alertLat = Number(cropR.rows[0]?.latitude);
        alertLon = Number(cropR.rows[0]?.longitude);
      }
      if (!Number.isFinite(alertLat) || !Number.isFinite(alertLon)) {
        const userLoc = await query('SELECT latitude, longitude FROM users WHERE id=$1', [req.user!.id]);
        alertLat = Number(userLoc.rows[0]?.latitude);
        alertLon = Number(userLoc.rows[0]?.longitude);
      }
      const alertRes = await query(
        `INSERT INTO alerts
           (user_id, crop_id, farm_id, scan_id, title, description, severity, type,
            potential_loss, preventable_loss, time_left_seconds, confidence, metadata, latitude, longitude)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'disease',$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [
          req.user!.id, crop_id || null, farm_id || null, scan.id,
          `${diseaseName} Detected`,
          analysis.recommendation,
          analysis.severity,
          analysis.potential_loss_inr,
          preventable,
          timeLeft,
          Math.round(finalConfidence),
          JSON.stringify({
            regret_score: regretAnalysis.regret_score,
            urgency_level: regretAnalysis.urgency_level,
            disease_name: diseaseName,
            plant_name: plantName,
          }),
          Number.isFinite(alertLat) ? alertLat : null,
          Number.isFinite(alertLon) ? alertLon : null,
        ]
      );

      const alertId = alertRes.rows[0]?.id;

      if (crop_id) {
        const healthDrop = analysis.severity === 'critical' ? 30 : 15;
        await query(`UPDATE crops SET health_score = GREATEST(0, health_score - $1) WHERE id = $2`, [healthDrop, crop_id]);
      }

      // Send alert notifications (SMS + Email + Push)
      try {
        const userRes = await query(`SELECT name, phone, email FROM users WHERE id = $1`, [req.user!.id]);
        if (userRes.rows.length > 0) {
          const user = userRes.rows[0];
          const alertMessage = {
            title: `🚨 ${diseaseName} Detected`,
            body: `Disease detected on your ${plantName} (${Math.round(finalConfidence)}% confidence). Potential loss: ₹${Math.round(analysis.potential_loss_inr)}. Open app to view treatment.`,
            subject: `⚠️ Disease Alert: ${diseaseName} Detected`,
            phone: user.phone,
            email: user.email,
            pushTitle: `${diseaseName} Detected`,
          };
          
          // Send notifications asynchronously (don't block response)
          sendAlertToUser(alertMessage, req.user!.id, alertId).catch(err => {
            logger.error(`Failed to send alert notifications for scan ${scan.id}:`, err);
          });
        }
      } catch (err) {
        logger.error(`Failed to send alert notifications:`, err);
        // Don't break the scan response if notification fails
      }

      // Notify nearby farmers (within 5–10 km radius)
      if (alertId && Number.isFinite(alertLat) && Number.isFinite(alertLon)) {
        try {
          const radiusKm = Number(process.env.NEARBY_ALERT_RADIUS_KM || 5);
          const nearbyUsers = await query(
            `SELECT u.id, u.phone, u.email, u.location,
                    (6371 * acos(cos(radians($1)) * cos(radians(u.latitude)) *
                     cos(radians(u.longitude) - radians($2)) + sin(radians($1)) * sin(radians(u.latitude)))) AS distance_km
             FROM users u
             LEFT JOIN notification_preferences np ON u.id = np.user_id
             WHERE u.id != $3
               AND u.latitude IS NOT NULL AND u.longitude IS NOT NULL
               AND u.notification_enabled = true
               AND (6371 * acos(cos(radians($1)) * cos(radians(u.latitude)) *
                 cos(radians(u.longitude) - radians($2)) + sin(radians($1)) * sin(radians(u.latitude)))) <= $4
             ORDER BY distance_km ASC
             LIMIT 50`,
            [alertLat, alertLon, req.user!.id, radiusKm]
          );

          for (const u of nearbyUsers.rows) {
            await query(
              `INSERT INTO nearby_alerts (alert_id, notified_user_id, distance_km)
               VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
              [alertId, u.id, Math.round(parseFloat(u.distance_km) * 10) / 10]
            );
            const msg = {
              title: '🚨 Nearby Disease Alert',
              body: `${diseaseName} detected within ${Math.round(u.distance_km)}km of your farm. Open AgroMind to view the map and take precautions.`,
              subject: `Nearby Disease Alert: ${diseaseName}`,
              phone: u.phone,
              email: u.email,
              pushTitle: 'Nearby Disease Alert',
            };
            sendAlertToUser(msg, u.id, alertId).catch(() => null);
          }
        } catch (err) {
          logger.error('Failed to notify nearby farmers:', err);
        }
      }
    }

    // Return scan with full regret analysis attached
    res.status(201).json({
      success: true,
      data: {
        ...scan,
        regret_analysis: regretAnalysis,
        regret_timeline: regretTimeline,
        disease_info: mergedDiseaseInfo,
        treatment_steps: normalizedTreatmentSteps,
        behavioral_triggers: behavioralTriggers,
        ml_confirmation: ml ? { disease: ml.disease, confidence: ml.confidence } : null,
      },
    });

    // ✅ FIX: TRIGGER AI DOCTOR TASK GENERATION IMMEDIATELY (async, non-blocking)
    try {
      const { generateAIDoctorRecommendations } = await import('../services/ai-doctor.service');
      generateAIDoctorRecommendations({
        id: scan.id,
        user_id: req.user!.id,
        crop_id: crop_id || undefined,
        plant_name: plantName,
        disease_name: diseaseName,
        severity: analysis.severity,
        confidence: finalConfidence,
        potential_loss: analysis.potential_loss_inr,
        latitude: undefined, // Will use user's default location
        longitude: undefined,
        location: undefined,
      }).catch(err => {
        logger.error(`Failed to generate AI Doctor recommendations for scan ${scan.id}:`, err);
      });
    } catch (err) {
      logger.warn('AI Doctor generation not queued (non-critical):', err);
    }
  } catch (err) {
    logger.error('Scan error:', err);
    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    res.status(500).json({ success: false, message: 'Scan failed. Please try again.' });
  }
};

export const getScans = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, limit = '20', offset = '0' } = req.query;
    let sql = `SELECT s.*, c.name as crop_name, f.name as farm_name
               FROM scans s
               LEFT JOIN crops c ON c.id = s.crop_id
               LEFT JOIN farms f ON f.id = s.farm_id
               WHERE s.user_id = $1`;
    const params: unknown[] = [req.user!.id];
    if (status) { sql += ` AND s.status = $${params.length + 1}`; params.push(status); }
    sql += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), parseInt(offset as string));
    const r = await query(sql, params);
    res.json({ success: true, data: r.rows });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch scans' });
  }
};

export const getScanById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query(
      `SELECT s.*, c.name as crop_name, f.name as farm_name
       FROM scans s
       LEFT JOIN crops c ON c.id = s.crop_id
       LEFT JOIN farms f ON f.id = s.farm_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [req.params.id, req.user!.id]
    );
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'Scan not found' }); return; }

    const scan = r.rows[0];
    // Recompute regret analysis from stored data
    const regretAnalysis = calculateRegret({
      severity: scan.severity,
      potential_loss_inr: parseFloat(scan.potential_loss) || 0,
      confidence: parseFloat(scan.confidence) || 0,
      disease_name: scan.disease_name,
    });

    res.json({ success: true, data: { ...scan, regret_analysis: regretAnalysis } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch scan' });
  }
};

export const resolveScan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action_taken } = req.body;
    const scanR = await query('SELECT * FROM scans WHERE id=$1 AND user_id=$2', [req.params.id, req.user!.id]);
    if (!scanR.rows.length) { res.status(404).json({ success: false, message: 'Scan not found' }); return; }

    const scan = scanR.rows[0];
    await query(`UPDATE scans SET status='resolved', resolved_at=NOW() WHERE id=$1`, [scan.id]);

    // ✅ FIX: Mark all related AI Doctor tasks as completed when scan is resolved
    await query(
      `UPDATE ai_doctor_tasks SET status='completed', completed_at=NOW() WHERE scan_id=$1 AND status='pending'`,
      [scan.id]
    );

    const prevented = parseFloat(scan.potential_loss) * 0.85;
    if (prevented > 0) {
      await query(
        `INSERT INTO loss_prevention_records (user_id, scan_id, crop_id, amount_prevented, action_taken)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.user!.id, scan.id, scan.crop_id, prevented, action_taken || scan.recommendation]
      );
    }
    if (scan.crop_id) {
      await query(`UPDATE crops SET health_score=LEAST(100, health_score+10) WHERE id=$1`, [scan.crop_id]);
    }
    res.json({ success: true, message: 'Scan resolved', data: { amount_prevented: Math.round(prevented) } });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to resolve scan' });
  }
};

export const deleteScan = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query('DELETE FROM scans WHERE id=$1 AND user_id=$2 RETURNING image_filename', [req.params.id, req.user!.id]);
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'Scan not found' }); return; }
    const fp = path.join(process.env.UPLOAD_DIR || './uploads', r.rows[0].image_filename || '');
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    res.json({ success: true, message: 'Scan deleted' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete scan' });
  }
};

// New endpoint: regret timeline for a scan
export const getScanRegretTimeline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const r = await query('SELECT severity, potential_loss FROM scans WHERE id=$1 AND user_id=$2', [req.params.id, req.user!.id]);
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'Scan not found' }); return; }
    const { severity, potential_loss } = r.rows[0];
    const urgency_days = severity === 'critical' ? 2 : severity === 'warning' ? 7 : 14;
    const timeline = buildRegretTimeline(parseFloat(potential_loss) || 0, urgency_days);
    res.json({ success: true, data: timeline });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to get timeline' });
  }
};

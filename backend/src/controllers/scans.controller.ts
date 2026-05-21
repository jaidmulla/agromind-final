import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { generateScanAnalysisWithAI, type AIAnalysisResult } from '../services/ai.service';
import { generateAIDoctorRecommendations } from '../services/ai-doctor.service';
import { predictWithML } from '../services/ml.service';
import { getWeatherRisk, saveWeatherSnapshot } from '../services/weather.service';
import type { WeatherData } from '../services/weather.service';
import { calculateRegret, buildRegretTimeline } from '../services/regret.service';
import { sendAlertToUser } from '../services/alert.service';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from '../utils/logger';

const inFlightScanHashes = new Set<string>();

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

async function resolveScanCoordinates(
  userId: string,
  farmId: string | undefined | null,
  cropId: string | undefined | null
): Promise<{ latitude: number | undefined; longitude: number | undefined }> {
  let lat: number | null = null;
  let lon: number | null = null;
  if (farmId) {
    const farmR = await query(
      `SELECT latitude, longitude FROM farms WHERE id=$1 AND user_id=$2`,
      [farmId, userId]
    );
    lat = Number(farmR.rows[0]?.latitude);
    lon = Number(farmR.rows[0]?.longitude);
  } else if (cropId) {
    const cropR = await query(
      `SELECT f.latitude, f.longitude
       FROM crops c LEFT JOIN farms f ON f.id=c.farm_id
       WHERE c.id=$1 AND c.user_id=$2`,
      [cropId, userId]
    );
    lat = Number(cropR.rows[0]?.latitude);
    lon = Number(cropR.rows[0]?.longitude);
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const userLoc = await query('SELECT latitude, longitude FROM users WHERE id=$1', [userId]);
    lat = Number(userLoc.rows[0]?.latitude);
    lon = Number(userLoc.rows[0]?.longitude);
  }
  return {
    latitude: typeof lat === 'number' && Number.isFinite(lat) ? lat : undefined,
    longitude: typeof lon === 'number' && Number.isFinite(lon) ? lon : undefined,
  };
}

function buildFallbackAnalysisFromML(ml: NonNullable<Awaited<ReturnType<typeof predictWithML>>>) {
  const isHealthy = ml.is_healthy || /healthy/i.test(ml.disease || '');
  const severity: 'critical' | 'warning' | 'info' | 'healthy' =
    (ml.severity as 'critical' | 'warning' | 'info' | 'healthy' | undefined)
    || (isHealthy ? 'healthy' : 'info');

  const projectedLoss = isHealthy
    ? 0
    : Math.round((ml.loss_per_acre_inr || 0) * Math.max(0.2, ml.confidence / 100));
  const yieldLossPercent = isHealthy
    ? 0
    : Math.round(Math.min(85, Math.max(1, Number((ml as typeof ml & { yield_loss_percent?: number }).yield_loss_percent) || (severity === 'critical' ? 42 : severity === 'warning' ? 22 : 8))));

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
    yield_loss_percent: yieldLossPercent,
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
      causes: spread ? [spread] : [],
      organic_treatment: isHealthy ? 'No treatment needed. Keep field hygiene and balanced nutrition.' : 'Use approved bio-control or neem-based spray where locally recommended.',
      chemical_treatment: isHealthy ? 'No chemical treatment needed.' : treatment,
      prevention_tips: ml.disease_info?.prevention ? [ml.disease_info.prevention] : [],
      recovery_chances: isHealthy ? 'Excellent with routine monitoring.' : 'Good if treatment starts early and infected leaves are removed.',
      recommended_fertilizer: 'Use soil-test-based balanced NPK and avoid excess nitrogen during disease pressure.',
      irrigation_suggestions: 'Water at soil level and avoid wet foliage overnight.',
      weather_risk_analysis: {
        humidity_risk: 'Live weather analysis unavailable for this fallback report.',
        temperature_risk: 'Live weather analysis unavailable for this fallback report.',
        rainfall_impact: 'Live weather analysis unavailable for this fallback report.',
        disease_spread_probability: 'Not calculated without live weather.',
        recommendation: 'Add farm coordinates to enable weather-aware recommendations.',
      },
      next_monitoring_time: isHealthy ? 'Scan again in 7 days' : 'Re-scan in 48 hours',
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
  let scanHashKey: string | null = null;
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'Image file is required' });
      return;
    }

    const farm_id = typeof req.body.farm_id === 'string' && req.body.farm_id.trim()
      ? req.body.farm_id.trim()
      : null;
    const crop_id = typeof req.body.crop_id === 'string' && req.body.crop_id.trim()
      ? req.body.crop_id.trim()
      : null;
    const imageUrl = `/uploads/${req.file.filename}`;

    if (farm_id) {
      const linkedFarm = await query('SELECT id FROM farms WHERE id = $1 AND user_id = $2 LIMIT 1', [farm_id, req.user!.id]);
      if (!linkedFarm.rows.length) {
        res.status(403).json({ success: false, message: 'Farm not found or does not belong to this user' });
        return;
      }
    }

    if (crop_id) {
      const linkedCrop = await query('SELECT id FROM crops WHERE id = $1 AND user_id = $2 LIMIT 1', [crop_id, req.user!.id]);
      if (!linkedCrop.rows.length) {
        res.status(403).json({ success: false, message: 'Crop not found or does not belong to this user' });
        return;
      }
    }

    const imageHash = crypto.createHash('sha256').update(fs.readFileSync(imagePath!)).digest('hex');
    scanHashKey = `${req.user!.id}:${imageHash}`;
    if (inFlightScanHashes.has(scanHashKey)) {
      res.status(409).json({ success: false, message: 'This image is already being processed. Please wait for the current scan to finish.' });
      return;
    }
    inFlightScanHashes.add(scanHashKey);

    const duplicate = await query(
      `SELECT id FROM scans
       WHERE user_id = $1
         AND disease_info->>'image_sha256' = $2
         AND created_at >= NOW() - INTERVAL '2 minutes'
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user!.id, imageHash]
    );
    if (duplicate.rows.length > 0) {
      if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      res.status(409).json({
        success: false,
        message: 'Duplicate scan detected. Open the existing report instead of processing the same image again.',
        data: { existing_scan_id: duplicate.rows[0].id },
      });
      return;
    }

    const ml = await predictWithML(imagePath!);
    if (!ml) {
      res.status(503).json({ success: false, message: 'ML disease detection is temporarily unavailable. Please retry shortly.' });
      return;
    }

    const geo = await resolveScanCoordinates(req.user!.id, farm_id, crop_id);
    let weather: WeatherData | null = null;
    if (typeof geo.latitude === 'number' && typeof geo.longitude === 'number') {
      try {
        weather = await getWeatherRisk(geo.latitude, geo.longitude);
        saveWeatherSnapshot(req.user!.id, weather).catch(() => null);
      } catch (weatherErr) {
        logger.warn('Live weather unavailable for scan analysis', {
          error: weatherErr instanceof Error ? weatherErr.message : String(weatherErr),
          user_id: req.user!.id,
        });
      }
    }

    const uncertain = Boolean(
      ml.requires_clearer_image
      || ml.class_label === 'unknown'
      || /unclear|unknown/i.test(ml.disease || '')
    );

    let analysis: AIAnalysisResult = buildFallbackAnalysisFromML(ml) as AIAnalysisResult;
    if (uncertain) {
      analysis = {
        ...analysis,
        disease_name: 'Image unclear',
        plant_name: 'Unknown crop',
        severity: 'info',
        potential_loss_inr: 0,
        yield_loss_percent: 0,
        recommendation: ml.message || 'Image unclear. Upload a sharper close-up leaf photo in natural daylight.',
        regret_insight: 'The scan was saved, but diagnosis is uncertain. Retake the photo before applying any treatment.',
        treatment_steps: [
          { step: 1, title: 'Retake leaf photo', description: 'Capture one leaf close-up in natural light with the diseased area in focus.', duration: 'Now' },
        ],
        disease_info: {
          ...analysis.disease_info,
          scientific_name: 'Unknown',
          affected_crops: [],
          spread_mechanism: 'Unknown',
          prevention: 'No treatment recommended until a clearer image is uploaded.',
          symptoms: [],
          causes: ['Image confidence below production threshold'],
          organic_treatment: 'Do not apply treatment from this unclear scan.',
          chemical_treatment: 'Do not apply chemical treatment from this unclear scan.',
          prevention_tips: ['Retake a clear close-up leaf image before treatment decisions.'],
          recovery_chances: 'Unknown until disease is confidently detected.',
          recommended_fertilizer: 'Not recommended from an unclear image.',
          irrigation_suggestions: 'Maintain normal crop irrigation until a reliable diagnosis is available.',
          weather_risk_analysis: weather ? {
            humidity_risk: `${weather.humidity}% humidity from live weather.`,
            temperature_risk: `${weather.temperature}°C from live weather.`,
            rainfall_impact: `${weather.rainfall}mm rainfall, ${weather.rain_probability}% rain probability.`,
            disease_spread_probability: `${weather.disease_risk_score}/100 weather risk, diagnosis still unclear.`,
            recommendation: weather.risk_factors.join('; '),
          } : analysis.disease_info.weather_risk_analysis,
          next_monitoring_time: 'Retake image now',
        },
      };
    } else {
      try {
        analysis = await generateScanAnalysisWithAI(ml, weather);
      } catch (aiErr) {
        logger.warn('AI analysis unavailable; using model-backed ML report', {
          error: aiErr instanceof Error ? aiErr.message : String(aiErr),
          user_id: req.user!.id,
        });
      }
    }

    const finalConfidence = Math.round((ml.confidence || analysis.confidence || 0) * 10) / 10;
    const diseaseName = uncertain ? 'Image unclear' : cleanDiseaseName(ml.disease || analysis.disease_name);
    const plantName = uncertain ? 'Unknown crop' : (ml.plant || analysis.plant_name || 'Unknown crop');
    const finalSeverity = ml.is_healthy ? 'healthy' : analysis.severity;
    const potentialLossInr = Math.round(Number(analysis.potential_loss_inr) || 0);
    const yieldLossPercent = Math.round(Number(analysis.yield_loss_percent) || Number((ml as typeof ml & { yield_loss_percent?: number }).yield_loss_percent) || 0);
    const source = uncertain || analysis.ai_provider === 'ml' || !analysis.ai_provider ? 'ml' : 'combined';

    // Merge symptoms from both sources
    const symptoms = [
      ...(analysis.disease_info?.symptoms || []),
      ...(ml.disease_info?.symptoms || []),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);

    const mergedDiseaseInfo = {
      scientific_name: analysis.disease_info?.scientific_name || ml.disease_info?.scientific_name || '',
      affected_crops: analysis.disease_info?.affected_crops || [],
      spread_mechanism: analysis.disease_info?.spread_mechanism || ml.disease_info?.spread_mechanism || '',
      prevention: analysis.disease_info?.prevention || ml.disease_info?.prevention || '',
      symptoms,
      causes: analysis.disease_info?.causes || [],
      organic_treatment: analysis.disease_info?.organic_treatment || '',
      chemical_treatment: analysis.disease_info?.chemical_treatment || '',
      prevention_tips: analysis.disease_info?.prevention_tips || [],
      recovery_chances: analysis.disease_info?.recovery_chances || '',
      recommended_fertilizer: analysis.disease_info?.recommended_fertilizer || '',
      irrigation_suggestions: analysis.disease_info?.irrigation_suggestions || '',
      weather_risk_analysis: analysis.disease_info?.weather_risk_analysis || null,
      next_monitoring_time: analysis.disease_info?.next_monitoring_time || '',
      yield_loss_percent: yieldLossPercent,
      image_sha256: imageHash,
      ai_provider: analysis.ai_provider || 'ml',
      weather,
    };

    // Calculate Regret AI score
    const regretAnalysis = calculateRegret({
      severity: finalSeverity,
      potential_loss_inr: potentialLossInr,
      confidence: finalConfidence,
      urgency_days: ml.urgency_days,
      disease_name: diseaseName,
      crop_name: plantName,
    });

    const regretTimeline = buildRegretTimeline(potentialLossInr, ml.urgency_days || 7);

    // Build enriched behavioral triggers
    const behavioralTriggers = {
      ...(analysis.behavioral_triggers || {}),
      ...(ml.behavioral_triggers || {}),
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
      (analysis.treatment_steps as unknown as Array<Record<string, unknown>> | undefined),
      finalSeverity,
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
        crop_id,
        farm_id || null,
        imageUrl,
        req.file.filename,
        diseaseName,
        plantName,
        finalConfidence,
        finalSeverity,
        potentialLossInr,
        analysis.recommendation,
        analysis.regret_insight,
        JSON.stringify(normalizedTreatmentSteps),
        JSON.stringify({ ...mergedDiseaseInfo, behavioral_triggers: behavioralTriggers }),
        JSON.stringify(ml),
        analysis.ai_provider && analysis.ai_provider !== 'ml'
          ? JSON.stringify({ ...analysis, behavioral_triggers: behavioralTriggers })
          : null,
        source,
      ]
    );

    const scan = r.rows[0];

    const reportSeverity = finalSeverity === 'critical'
      ? 'high'
      : finalSeverity === 'warning'
      ? 'medium'
      : 'low';

    // Keep contract table in sync: every scan creates one disease report row.
    let reportId: string | null = null;
    try {
      const reportInsert = await query(
        `INSERT INTO disease_reports
          (user_id, crop_id, image_path, disease_name, confidence, treatment, severity, scan_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          req.user!.id,
          crop_id,
          imageUrl,
          diseaseName,
          finalConfidence,
          analysis.recommendation,
          reportSeverity,
          scan.id,
        ]
      );
      reportId = reportInsert.rows[0]?.id || null;
    } catch (reportErr) {
      logger.warn('Failed to mirror scan into disease_reports table', {
        error: reportErr instanceof Error ? reportErr.message : String(reportErr),
        scan_id: scan.id,
      });
    }

    const alertLat = geo.latitude ?? null;
    const alertLon = geo.longitude ?? null;

    // Auto-create alert for critical/warning
    if (!uncertain && (finalSeverity === 'critical' || finalSeverity === 'warning')) {
      const timeLeft = finalSeverity === 'critical' ? 7200 : 86400;
      const preventable = Math.round(potentialLossInr * 0.85);
      const alertRes = await query(
        `INSERT INTO alerts
           (user_id, crop_id, farm_id, scan_id, report_id, title, description, message, severity, type,
            potential_loss, preventable_loss, time_left_seconds, confidence, metadata, latitude, longitude)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'disease',$10,$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [
          req.user!.id, crop_id, farm_id || null, scan.id, reportId,
          `${diseaseName} Detected`,
          analysis.recommendation,
          analysis.recommendation,
          finalSeverity,
          potentialLossInr,
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

      // Send alert notifications (SMS + Email + Push)
      try {
        const userRes = await query(`SELECT name, phone, email FROM users WHERE id = $1`, [req.user!.id]);
        if (userRes.rows.length > 0) {
          const user = userRes.rows[0];
          const alertMessage = {
            title: `${diseaseName} Detected`,
            body: `Disease detected on your ${plantName} (${Math.round(finalConfidence)}% confidence). Potential loss: ₹${potentialLossInr}. Open app to view treatment.`,
            subject: `Disease Alert: ${diseaseName} Detected`,
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
              title: 'Nearby Disease Alert',
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
        report_id: reportId,
        regret_analysis: regretAnalysis,
        regret_timeline: regretTimeline,
        disease_info: mergedDiseaseInfo,
        treatment_steps: normalizedTreatmentSteps,
        behavioral_triggers: behavioralTriggers,
        ml_confirmation: { disease: ml.disease, confidence: ml.confidence, crop: ml.plant },
        needs_clearer_image: uncertain,
        weather,
      },
    });

    if (!uncertain) {
      generateAIDoctorRecommendations({
        id: scan.id,
        user_id: req.user!.id,
        plant_name: plantName,
        disease_name: diseaseName,
        severity: finalSeverity,
        confidence: finalConfidence,
        potential_loss: potentialLossInr,
        latitude: geo.latitude,
        longitude: geo.longitude,
        location: undefined,
      }).catch(err => {
        logger.error(`Failed to generate AI Doctor recommendations for scan ${scan.id}:`, err);
      });
    }
  } catch (err) {
    logger.error('Scan error:', err);
    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    res.status(500).json({ success: false, message: 'Scan failed. Please try again.' });
  } finally {
    if (scanHashKey) inFlightScanHashes.delete(scanHashKey);
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
    const reportR = await query(
      `SELECT id FROM disease_reports WHERE scan_id = $1 AND user_id = $2 LIMIT 1`,
      [scan.id, req.user!.id]
    );
    const diseaseInfo = scan.disease_info || {};
    const behavioralTriggers = diseaseInfo.behavioral_triggers || {};
    // Recompute regret analysis from stored data
    const regretAnalysis = calculateRegret({
      severity: scan.severity,
      potential_loss_inr: parseFloat(scan.potential_loss) || 0,
      confidence: parseFloat(scan.confidence) || 0,
      disease_name: scan.disease_name,
      crop_name: scan.plant_name,
    });
    const regretTimeline = Array.isArray(behavioralTriggers.loss_timeline)
      ? behavioralTriggers.loss_timeline
      : buildRegretTimeline(parseFloat(scan.potential_loss) || 0, scan.severity === 'critical' ? 2 : scan.severity === 'warning' ? 7 : 14);

    res.json({
      success: true,
      data: {
        ...scan,
        report_id: reportR.rows[0]?.id || null,
        regret_analysis: regretAnalysis,
        regret_timeline: regretTimeline,
        behavioral_triggers: behavioralTriggers,
      },
    });
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

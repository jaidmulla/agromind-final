import { Request, Response } from 'express';
import { query } from '../utils/database';
import plantid from '../integrations/plantid';
import claude from '../integrations/claude';
import logger from '../utils/logger';
import crypto from 'crypto';

// ────────────────────────────────────────────────────────────────────────────
// Leaf Analysis Controller — Orchestrate Plant.id + Claude for dynamic treatment
// ────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/leaf/analyze
 * Main endpoint: Analyze leaf image → Plant.id → Claude → Return treatment
 * CRITICAL: NEVER hardcode treatment steps. Always call Plant.id + Claude.
 */
export const analyze = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { imageBase64, language = 'en' } = req.body;

    // Validate inputs
    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'Image is required. Please upload a leaf photo.',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate image format
    const imageValidation = plantid.validateImage(imageBase64);
    if (!imageValidation.valid) {
      return res.status(400).json({
        success: false,
        message: imageValidation.message,
      });
    }

    // Calculate image hash for logging
    const imageHash = plantid.calculateImageHash(imageBase64);

    logger.info(`Leaf analysis requested for user ${userId}`);

    // Step 1: Call Plant.id API to identify plant and disease
    const plantIdResult = await plantid.analyzePlantDisease(imageBase64, userId);

    if (!plantIdResult.success) {
      return res.status(400).json({
        success: false,
        message: plantIdResult.message || 'Failed to analyze image. Please try again with a clearer photo.',
        error: plantIdResult.error,
      });
    }

    const {
      plant_name,
      disease_name,
      probability,
      cause,
      classification,
    } = plantIdResult;

    // Step 2: Check confidence threshold
    if (probability && probability < 40) {
      return res.status(400).json({
        success: false,
        message: 'Image is not clear enough. Please upload a closer photo of the affected leaf.',
        details: {
          plant_name,
          disease_name,
          probability,
          cause: 'Confidence too low for reliable diagnosis',
        },
      });
    }

    // Step 3: Generate dynamic treatment steps using Claude
    let treatmentResponse = { success: true, content: '' };

    if (disease_name !== 'Healthy') {
      treatmentResponse = await claude.generateTreatmentSteps(
        plant_name || 'Unknown Plant',
        disease_name || 'Unknown Disease',
        cause || 'Unknown cause',
        probability || 0,
        language,
      );
    } else {
      // Plant is healthy
      treatmentResponse.content = `Your ${plant_name} plant appears to be healthy! Continue with regular maintenance and monitoring.`;
    }

    // Ensure content is always a string
    const treatmentContent = treatmentResponse.content || 'Unable to generate treatment steps at this time.';

    // Step 4: Log the analysis result (for audit and to enforce uniqueness)
    try {
      const logQuery = `
        INSERT INTO scans (user_id, plant_name, disease_name, confidence, disease_info, ai_response, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'analyzed')
        RETURNING id
      `;

      const diseaseInfo = {
        cause,
        classification,
        imageHash,
        timestamp: new Date().toISOString(),
      };

      const aiResponse = {
        treatment_steps: treatmentContent,
        generated_at: new Date().toISOString(),
        language,
      };

      await query(logQuery, [
        userId,
        plant_name,
        disease_name,
        probability || 0,
        JSON.stringify(diseaseInfo),
        JSON.stringify(aiResponse),
      ]);

      logger.info(`Leaf analysis logged for user ${userId}: ${plant_name} - ${disease_name}`);
    } catch (logError) {
      logger.warn('Failed to log leaf analysis, but returning response anyway', logError);
    }

    // Step 5: Return comprehensive response
    return res.status(200).json({
      success: true,
      analysis: {
        plant_name,
        disease_name,
        probability,
        cause,
        classification,
      },
      treatment: treatmentContent,
      language,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error in leaf analysis:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to analyze leaf. Please try again.',
      error: process.env.NODE_ENV === 'development' ? (error as any).message : undefined,
    });
  }
};

/**
 * GET /api/leaf/history
 * Get user's leaf analysis history (optional endpoint)
 */
export const getHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const historyQuery = `
      SELECT id, plant_name, disease_name, confidence, disease_info, ai_response, created_at
      FROM scans
      WHERE user_id = $1 AND status = 'analyzed'
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const result = await query(historyQuery, [userId]);

    return res.status(200).json({
      success: true,
      history: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Error getting leaf analysis history:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve history',
    });
  }
};

export default {
  analyze,
  getHistory,
};

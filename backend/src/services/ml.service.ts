import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import logger from '../utils/logger';

export interface MLPrediction {
  disease: string;
  plant: string;
  confidence: number;
  severity?: 'critical' | 'warning' | 'info' | 'healthy';
  loss_per_acre_inr?: number;
  regret_ai?: {
    message?: string;
    score?: number;
    level?: string;
    urgency?: string;
  };
  top5_predictions?: Array<{ label: string; confidence: number }>;
  is_healthy: boolean;
  urgency_days?: number;
  disease_info?: {
    scientific_name?: string;
    spread_mechanism?: string;
    prevention?: string;
    treatment?: string;
    symptoms?: string[];
    product_name?: string;
    dosage?: string;
    optimal_temp?: string;
  };
  behavioral_triggers?: Record<string, unknown>;
}

export async function predictWithML(imagePath: string): Promise<MLPrediction | null> {
  try {
    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:5000';
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));

    const res = await axios.post(`${mlUrl}/predict`, form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });

    return res.data as MLPrediction;
  } catch (err) {
    logger.warn('ML service unavailable', { err: String(err) });
    return null;
  }
}

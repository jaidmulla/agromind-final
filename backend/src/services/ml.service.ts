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

const ML_MAX_RETRIES = 3;
const ML_BASE_DELAY_MS = 1000;

function isRetryableError(err: any): boolean {
  const status = err?.response?.status;
  if (status === 503 || status === 429 || status === 502) return true;
  const code = err?.code;
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ECONNRESET') return true;
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function predictWithML(imagePath: string): Promise<MLPrediction | null> {
  const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:5000';

  for (let attempt = 1; attempt <= ML_MAX_RETRIES; attempt++) {
    try {
      const form = new FormData();
      form.append('image', fs.createReadStream(imagePath));

      const res = await axios.post(`${mlUrl}/predict`, form, {
        headers: form.getHeaders(),
        timeout: 30000,
      });

      return res.data as MLPrediction;
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.code;

      if (attempt < ML_MAX_RETRIES && isRetryableError(err)) {
        const delay = ML_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn(`ML service attempt ${attempt}/${ML_MAX_RETRIES} failed (status=${status}, code=${code}), retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }

      logger.warn(`ML service failed after ${attempt} attempt(s)`, { status, code, err: String(err) });
      return null;
    }
  }

  return null;
}

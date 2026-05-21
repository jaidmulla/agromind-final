import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import logger from '../utils/logger';

export interface MLPrediction {
  disease_name?: string;
  treatment?: string;
  severity?: 'critical' | 'warning' | 'info' | 'healthy';
  contract_severity?: 'low' | 'medium' | 'high';
  disease: string;
  plant: string;
  confidence: number;
  class_label?: string;
  loss_per_acre_inr?: number;
  yield_loss_percent?: number;
  requires_clearer_image?: boolean;
  message?: string;
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

function normalizeSeverity(value: unknown): 'critical' | 'warning' | 'info' | 'healthy' {
  const severity = String(value || '').toLowerCase();
  if (severity === 'healthy') return 'healthy';
  if (severity === 'critical' || severity === 'high') return 'critical';
  if (severity === 'warning' || severity === 'medium') return 'warning';
  return 'info';
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

      const data = res.data as Partial<MLPrediction> & Record<string, unknown>;
      const diseaseName = String(data.disease_name || data.disease || 'Unknown');
      const plant = String(data.plant || data.plant_name || 'Unknown crop');
      const confidenceRaw = Number(data.confidence ?? data.confidence_score ?? 0);
      const confidence = confidenceRaw <= 1 ? confidenceRaw * 100 : confidenceRaw;
      const legacySeverity = normalizeSeverity(data.legacy_severity || data.severity || (String(diseaseName).toLowerCase().includes('healthy') ? 'healthy' : 'info'));

      return {
        ...data,
        disease_name: diseaseName,
        disease: diseaseName,
        plant,
        confidence,
        treatment: String(data.treatment || data.disease_info?.treatment || data.message || ''),
        severity: legacySeverity,
        contract_severity: (String(data.severity || '').toLowerCase() === 'low' || String(data.severity || '').toLowerCase() === 'medium' || String(data.severity || '').toLowerCase() === 'high')
          ? (String(data.severity).toLowerCase() as 'low' | 'medium' | 'high')
          : (legacySeverity === 'critical' ? 'high' : legacySeverity === 'warning' ? 'medium' : 'low'),
        is_healthy: Boolean(data.is_healthy || legacySeverity === 'healthy' || /healthy/i.test(diseaseName)),
      } as MLPrediction;
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

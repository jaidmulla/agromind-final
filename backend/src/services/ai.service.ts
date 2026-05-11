import sharp from 'sharp';
import axios from 'axios';
import logger from '../utils/logger';
import { callGeminiWithVision, callGeminiText } from './gemini.service';
import type { MLPrediction } from './ml.service';
import type { WeatherData } from './weather.service';

export interface TreatmentStep {
  step: number;
  title: string;
  description: string;
  duration: string;
  product?: string;
  dosage?: string;
}

export interface AIAnalysisResult {
  disease_name: string;
  plant_name: string;
  confidence: number;
  severity: 'critical' | 'warning' | 'info' | 'healthy';
  potential_loss_inr: number;
  yield_loss_percent: number;
  recommendation: string;
  regret_insight: string;
  treatment_steps: TreatmentStep[];
  disease_info: {
    scientific_name: string;
    affected_crops: string[];
    spread_mechanism: string;
    prevention: string;
    symptoms: string[];
    causes?: string[];
    organic_treatment?: string;
    chemical_treatment?: string;
    prevention_tips?: string[];
    recovery_chances?: string;
    recommended_fertilizer?: string;
    irrigation_suggestions?: string;
    weather_risk_analysis?: {
      humidity_risk: string;
      temperature_risk: string;
      rainfall_impact: string;
      disease_spread_probability: string;
      recommendation: string;
    };
    next_monitoring_time?: string;
  };
  behavioral_triggers: {
    loss_framing: string;
    urgency_statement: string;
    social_proof: string;
    action_cta: string;
  };
  weather_risk_note?: string;
  ai_provider?: 'gemini' | 'ollama' | 'ml';
}

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

function stripJsonFences(text: string): string {
  const cleaned = String(text || '').replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value: unknown, min: number, max: number, fallback = min): number {
  return Math.min(max, Math.max(min, toNumber(value, fallback)));
}

function safeString(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function safeArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeSeverity(value: unknown, fallback: AIAnalysisResult['severity']): AIAnalysisResult['severity'] {
  const text = String(value || '').toLowerCase();
  if (text === 'critical' || text === 'severe' || text === 'high') return 'critical';
  if (text === 'warning' || text === 'moderate' || text === 'medium') return 'warning';
  if (text === 'healthy') return 'healthy';
  return fallback;
}

function deriveYieldLossPercent(ml: MLPrediction, severity: AIAnalysisResult['severity']): number {
  const fromMl = toNumber((ml as MLPrediction & { yield_loss_percent?: number }).yield_loss_percent, NaN);
  if (Number.isFinite(fromMl)) return Math.round(clamp(fromMl, 0, 90, 0));
  if (severity === 'healthy' || ml.is_healthy) return 0;
  const base = severity === 'critical' ? 42 : severity === 'warning' ? 22 : 8;
  return Math.round(clamp(base * Math.max(0.55, ml.confidence / 100), 1, 85, base));
}

function defaultWeatherText(weather?: WeatherData | null): NonNullable<AIAnalysisResult['disease_info']['weather_risk_analysis']> {
  if (!weather) {
    return {
      humidity_risk: 'Weather unavailable because farm coordinates are not configured.',
      temperature_risk: 'Temperature risk could not be calculated without live weather data.',
      rainfall_impact: 'Rainfall impact could not be calculated without live weather data.',
      disease_spread_probability: 'Unknown until live weather is available.',
      recommendation: 'Add farm or profile coordinates to enable weather-aware recommendations.',
    };
  }

  return {
    humidity_risk: `${weather.humidity}% humidity; ${weather.humidity >= 80 ? 'high fungal pressure' : weather.humidity >= 65 ? 'moderate disease pressure' : 'lower humidity pressure'}.`,
    temperature_risk: `${weather.temperature}°C; ${weather.temperature >= 18 && weather.temperature <= 30 ? 'temperature is favorable for common leaf pathogens' : 'temperature is outside the highest-risk range for many fungal diseases'}.`,
    rainfall_impact: `${weather.rainfall}mm rainfall and ${weather.rain_probability}% rain probability; wet leaves can accelerate spread.`,
    disease_spread_probability: `${weather.disease_risk_score}/100 weather disease-risk score.`,
    recommendation: weather.risk_factors.join('; '),
  };
}

function buildScanPrompt(ml: MLPrediction, weather?: WeatherData | null): string {
  const weatherBlock = weather
    ? `Live weather: temperature=${weather.temperature}C, humidity=${weather.humidity}%, rainfall=${weather.rainfall}mm, rain_probability=${weather.rain_probability}%, wind=${weather.wind_speed}km/h, disease_risk_score=${weather.disease_risk_score}/100, risk_factors=${weather.risk_factors.join('; ')}.`
    : 'Live weather is unavailable because no usable farm/user coordinates were available.';

  return `You are AgroMind's agricultural disease analyst. A trained TensorFlow plant-disease classifier has already detected the crop and disease from the uploaded leaf image. Do not invent a different crop or disease.

ML detection:
- Crop/leaf name: ${ml.plant}
- Disease name: ${ml.disease}
- Confidence: ${ml.confidence}%
- Class severity: ${ml.severity || 'info'}
- ML symptoms: ${(ml.disease_info?.symptoms || []).join('; ') || 'not provided'}
- ML spread mechanism: ${ml.disease_info?.spread_mechanism || 'not provided'}
- ML treatment note: ${ml.disease_info?.treatment || 'not provided'}
- ML prevention note: ${ml.disease_info?.prevention || 'not provided'}
- ML estimated loss per acre INR: ${ml.loss_per_acre_inr || 0}
${weatherBlock}

Generate farmer-friendly, realistic, India-aware crop advice. Use the ML crop and disease as authoritative. Estimate severity, yield loss percent, recovery chances, fertilizer, irrigation, and next monitoring time logically from ML confidence, disease severity, and weather risk. If the crop is healthy, keep treatment minimal and preventive.

Respond ONLY as valid JSON:
{
  "disease_name": "same disease from ML unless it is Healthy",
  "plant_name": "same crop from ML",
  "confidence": 0-100,
  "severity": "critical" | "warning" | "info" | "healthy",
  "potential_loss_inr": 0,
  "yield_loss_percent": 0-90,
  "symptoms": ["..."],
  "causes": ["..."],
  "organic_treatment": "...",
  "chemical_treatment": "...",
  "prevention_tips": ["..."],
  "recovery_chances": "...",
  "recommended_fertilizer": "...",
  "irrigation_suggestions": "...",
  "weather_risk_analysis": {
    "humidity_risk": "...",
    "temperature_risk": "...",
    "rainfall_impact": "...",
    "disease_spread_probability": "...",
    "recommendation": "..."
  },
  "next_monitoring_time": "...",
  "recommendation": "2-3 sentence field action summary",
  "regret_insight": "specific consequence of delay using yield/loss estimate",
  "treatment_steps": [
    {"step": 1, "title": "...", "description": "...", "duration": "...", "product": "...", "dosage": "..."}
  ],
  "disease_info": {
    "scientific_name": "...",
    "affected_crops": ["..."],
    "spread_mechanism": "...",
    "prevention": "...",
    "symptoms": ["..."]
  },
  "behavioral_triggers": {
    "loss_framing": "...",
    "urgency_statement": "...",
    "social_proof": "...",
    "action_cta": "..."
  }
}`;
}

async function callOllamaText(prompt: string): Promise<string> {
  const response = await axios.post(
    `${OLLAMA_URL.replace(/\/$/, '')}/api/generate`,
    {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: 'json',
      options: {
        temperature: 0.2,
        num_predict: 1800,
      },
    },
    { timeout: 60000 }
  );

  const text = response.data?.response;
  if (!text) throw new Error('Ollama response missing content');
  return String(text).trim();
}

function normalizeAIAnalysis(raw: Record<string, unknown>, ml: MLPrediction, provider: AIAnalysisResult['ai_provider'], weather?: WeatherData | null): AIAnalysisResult {
  const mlSeverity: AIAnalysisResult['severity'] = ml.is_healthy ? 'healthy' : normalizeSeverity(ml.severity, 'info');
  const severity = normalizeSeverity(raw.severity, mlSeverity);
  const yieldLoss = Math.round(clamp(raw.yield_loss_percent, 0, 90, deriveYieldLossPercent(ml, severity)));
  const symptoms = safeArray(raw.symptoms, safeArray(ml.disease_info?.symptoms));
  const causes = safeArray(raw.causes, ml.disease_info?.spread_mechanism ? [ml.disease_info.spread_mechanism] : []);
  const diseaseInfoRaw = typeof raw.disease_info === 'object' && raw.disease_info ? raw.disease_info as Record<string, unknown> : {};
  const weatherRaw = typeof raw.weather_risk_analysis === 'object' && raw.weather_risk_analysis
    ? raw.weather_risk_analysis as Record<string, unknown>
    : {};
  const defaultWeather = defaultWeatherText(weather);

  const treatmentSteps = Array.isArray(raw.treatment_steps) ? raw.treatment_steps : [];
  const normalizedSteps = treatmentSteps
    .map((step, index) => {
      const value = typeof step === 'object' && step ? step as Record<string, unknown> : {};
      return {
        step: index + 1,
        title: safeString(value.title, index === 0 ? 'Inspect affected leaves' : `Action ${index + 1}`),
        description: safeString(value.description, index === 0 ? 'Inspect nearby plants and confirm symptom spread before applying treatment.' : 'Follow the recommended crop care action.'),
        duration: safeString(value.duration, '30 min'),
        product: safeString(value.product, ''),
        dosage: safeString(value.dosage, ''),
      };
    })
    .filter((step) => step.title && step.description)
    .slice(0, 8);

  const recommendation = safeString(raw.recommendation, ml.disease_info?.treatment || 'Use the ML diagnosis to consult a local agronomist before treatment.');
  const prevention = safeString(diseaseInfoRaw.prevention, safeString(raw.prevention_tips, ml.disease_info?.prevention || 'Monitor crop regularly and maintain field hygiene.'));

  return {
    disease_name: safeString(raw.disease_name, ml.disease),
    plant_name: safeString(raw.plant_name, ml.plant),
    confidence: Math.round(clamp(raw.confidence, 0, 100, ml.confidence) * 10) / 10,
    severity,
    potential_loss_inr: Math.round(clamp(raw.potential_loss_inr, 0, 500000, ml.loss_per_acre_inr || 0)),
    yield_loss_percent: yieldLoss,
    recommendation,
    regret_insight: safeString(raw.regret_insight, ml.regret_ai?.message || 'Early action reduces avoidable crop loss.'),
    treatment_steps: normalizedSteps.length > 0 ? normalizedSteps : [{
      step: 1,
      title: ml.is_healthy ? 'Continue monitoring' : 'Start field verification',
      description: ml.is_healthy ? 'Recheck plants weekly and keep leaves dry.' : recommendation,
      duration: ml.is_healthy ? 'Weekly' : 'Today',
      product: '',
      dosage: '',
    }],
    disease_info: {
      scientific_name: safeString(diseaseInfoRaw.scientific_name, ml.disease_info?.scientific_name || 'Unknown'),
      affected_crops: safeArray(diseaseInfoRaw.affected_crops, ml.plant ? [ml.plant] : []),
      spread_mechanism: safeString(diseaseInfoRaw.spread_mechanism, ml.disease_info?.spread_mechanism || 'Not specified by model'),
      prevention,
      symptoms: safeArray(diseaseInfoRaw.symptoms, symptoms),
      causes,
      organic_treatment: safeString(raw.organic_treatment, ml.is_healthy ? 'No treatment needed; use compost and field sanitation as preventive care.' : 'Use neem-based spray or approved bio-control where locally recommended.'),
      chemical_treatment: safeString(raw.chemical_treatment, ml.disease_info?.treatment || 'Use only locally approved crop protection products after label verification.'),
      prevention_tips: safeArray(raw.prevention_tips, ml.disease_info?.prevention ? [ml.disease_info.prevention] : []),
      recovery_chances: safeString(raw.recovery_chances, ml.is_healthy ? 'Excellent if routine care continues.' : 'Recovery depends on early removal of infected tissue and timely treatment.'),
      recommended_fertilizer: safeString(raw.recommended_fertilizer, 'Use balanced NPK based on soil test and avoid excess nitrogen during disease pressure.'),
      irrigation_suggestions: safeString(raw.irrigation_suggestions, 'Irrigate at soil level and avoid keeping leaves wet overnight.'),
      weather_risk_analysis: {
        humidity_risk: safeString(weatherRaw.humidity_risk, defaultWeather.humidity_risk),
        temperature_risk: safeString(weatherRaw.temperature_risk, defaultWeather.temperature_risk),
        rainfall_impact: safeString(weatherRaw.rainfall_impact, defaultWeather.rainfall_impact),
        disease_spread_probability: safeString(weatherRaw.disease_spread_probability, defaultWeather.disease_spread_probability),
        recommendation: safeString(weatherRaw.recommendation, defaultWeather.recommendation),
      },
      next_monitoring_time: safeString(raw.next_monitoring_time, ml.is_healthy ? 'Scan again in 7 days' : 'Re-scan in 48 hours'),
    },
    behavioral_triggers: {
      loss_framing: safeString((raw.behavioral_triggers as Record<string, unknown> | undefined)?.loss_framing, `Potential yield loss: ${yieldLoss}% if unmanaged.`),
      urgency_statement: safeString((raw.behavioral_triggers as Record<string, unknown> | undefined)?.urgency_statement, ml.is_healthy ? 'No urgent treatment needed.' : 'Act within the model urgency window.'),
      social_proof: safeString((raw.behavioral_triggers as Record<string, unknown> | undefined)?.social_proof, 'Early treatment improves recovery and reduces preventable yield loss.'),
      action_cta: safeString((raw.behavioral_triggers as Record<string, unknown> | undefined)?.action_cta, ml.is_healthy ? 'Continue routine monitoring.' : 'Start treatment and re-scan soon.'),
    },
    weather_risk_note: defaultWeather.recommendation,
    ai_provider: provider,
  };
}

export async function generateScanAnalysisWithAI(ml: MLPrediction, weather?: WeatherData | null): Promise<AIAnalysisResult> {
  const prompt = buildScanPrompt(ml, weather);
  let lastError: Error | null = null;

  try {
    const geminiText = await callGeminiText(
      'Return only valid JSON. Do not include markdown.',
      prompt,
      0.2,
      2200
    );
    return normalizeAIAnalysis(JSON.parse(stripJsonFences(geminiText)), ml, 'gemini', weather);
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    logger.warn('Gemini scan analysis failed; trying Ollama fallback', { error: lastError.message });
  }

  try {
    const ollamaText = await callOllamaText(prompt);
    return normalizeAIAnalysis(JSON.parse(stripJsonFences(ollamaText)), ml, 'ollama', weather);
  } catch (err) {
    lastError = err instanceof Error ? err : new Error(String(err));
    logger.error('Gemini and Ollama scan analysis failed', { error: lastError.message });
    throw lastError;
  }
}

export async function analyzeImageWithAI(imagePath: string, cropHint?: string): Promise<AIAnalysisResult> {
  // Process image: strip EXIF, resize, compress
  const processedBuffer = await sharp(imagePath)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const base64Image = processedBuffer.toString('base64');

  const systemPrompt = `You are AgroMind Regret AI+, the world's most advanced agricultural disease detection system. 
You combine precision disease diagnosis with behavioral psychology to motivate farmers to take immediate action.
Your analysis must include:
1. Precise disease identification
2. Exact financial loss in Indian Rupees (INR)
3. Regret AI messaging — emotional + financial urgency triggers
4. Step-by-step treatment with specific Indian market products
Always respond ONLY with valid JSON. Never include markdown or explanations outside the JSON.`;

  const cropContext = cropHint?.trim();
  const userPrompt = `⚠️ CRITICAL: Plant misidentification causes farmer financial losses. Follow these steps EXACTLY:

${cropContext ? `CROP CONTEXT: The farmer linked this scan to ${cropContext}. Treat ${cropContext} as the canonical crop identity unless the image is unusable. Do NOT relabel it as another crop.` : 'CROP CONTEXT: No linked crop was provided. Infer the plant from the image, but use low confidence if the leaf shape is ambiguous.'}

STEP 1: IDENTIFY LEAF CHARACTERISTICS
List what you observe about the leaf morphology:
- Leaf arrangement (simple, compound, pinnate, palmate, etc.)
- Leaf margins (smooth, serrated, dentate, lobed, etc.)
- Leaf texture (glossy, matte, hairy/trichomes, smooth, waxy)
- Leaf color and venation pattern
- Stem thickness and characteristics
- Any stipules or leaf bases visible
- Overall leaf size and shape

STEP 2: MATCH TO KNOWN PLANTS
Match observed characteristics to these crop profiles:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🥔 POTATO (Solanum tuberosum):
  • Compound pinnate leaves (5-9 leaflets on petiole)
  • Oval/elliptic leaflets with pointed tips
  • SMOOTH leaf margins (KEY: NOT serrated)
  • Dark green, slightly waxy
  • Thin green stems
  • NO visible stipules at base
  • Leaflets arranged alternately

🍅 TOMATO (Solanum lycopersicum):
  • Compound pinnate leaves (7-11 leaflets)
  • SERRATED leaf margins (KEY: distinct saw-tooth edges)
  • Visible trichomes/hairs on stem and leaves
  • Bright green, more matte finish
  • Thicker, more fuzzy stems
  • VISIBLE stipules at base of petiole
  • Leaflets more alternately pinnate

🌶️ PEPPER (Capsicum spp):
  • SIMPLE leaves (not compound)
  • Smooth, glossy surface
  • Alternate leaf arrangement
  • Lanceolate to ovate shape
  • Thicker, woody stem

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 3: DETERMINE PLANT WITH CONFIDENCE
- If characteristics match ONE plant clearly: confidence 85-100%
- If characteristics match TWO plants equally: confidence 50-65% and mention BOTH plants
- If characteristics are ambiguous: confidence ≤50% and REJECT identification

STEP 4: REJECT COMMON MISTAKES
❌ If you see smooth margins and compound leaves → NOT TOMATO (reduce confidence by 30%)
❌ If you see serrated margins and hairy stem → NOT POTATO (reduce confidence by 30%)
❌ If you see simple leaves → NOT POTATO or TOMATO (it's likely PEPPER or other plant)

STEP 5: DIAGNOSE DISEASE
ONLY after confirmed plant identification, diagnose disease.

${cropContext ? `IMPORTANT: If the linked crop is ${cropContext}, the returned "plant_name" must be exactly "${cropContext}".` : ''}

RESPOND ONLY with this JSON (no markdown, no explanations):
{
  "disease_name": "exact disease common name, or 'Healthy' if no disease",
  "plant_name": "EXACT identified plant (Potato | Tomato | Pepper | Other plant name)",
  "confidence": <0-100 — MUST reflect actual certainty. <60% if ambiguous>,
  "severity": "critical" | "warning" | "info" | "healthy",
  "potential_loss_inr": <estimated INR loss per acre if untreated, 0 if healthy>,
  "recommendation": "1-2 sentence specific treatment using Indian market product names",
  "regret_insight": "What happens if farmer delays: exact timeframe, % crop loss, ₹ amount",
  "treatment_steps": [
    {"step": 1, "title": "step title", "description": "detailed instructions", "duration": "time", "product": "product name", "dosage": "dosage"},
    {"step": 2, "title": "...", "description": "...", "duration": "..."},
    {"step": 3, "title": "...", "description": "...", "duration": "..."},
    {"step": 4, "title": "Monitor & Verify", "description": "monitoring", "duration": "Ongoing"}
  ],
  "disease_info": {
    "scientific_name": "Latin name",
    "affected_crops": ["list", "of", "crops"],
    "spread_mechanism": "how disease spreads",
    "prevention": "prevention strategy",
    "symptoms": ["symptom 1", "symptom 2", "symptom 3", "symptom 4", "symptom 5"]
  },
  "behavioral_triggers": {
    "loss_framing": "₹X loss per day if you delay",
    "urgency_statement": "You have N days to act before this becomes irreversible",
    "social_proof": "Farmers who treated within 24h saved X% more yield",
    "action_cta": "Direct action instruction to farmer"
  }
}`;


  const text = await callGeminiWithVision(base64Image, systemPrompt, userPrompt, true);

  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned) as AIAnalysisResult;
  } catch {
    logger.error('Failed to parse AI response', { preview: cleaned.slice(0, 200) });
    throw new Error('AI response parse failure');
  }
}

export async function generateRegretInsight(
  disease: string, cropName: string, daysIgnored: number, potentialLoss: number
): Promise<string> {
  try {
    const reply = await callGeminiText(
      '',
      `A farmer detected ${disease} in their ${cropName} crop and ignored it for ${daysIgnored} days.
The potential loss is ₹${potentialLoss.toLocaleString('en-IN')}.
Write a 2-sentence powerful emotional + financial REGRET message in simple English that motivates immediate action.
Make it personal, urgent, and specific with numbers. Do not use generic language.`,
      0.4,
      250
    );
    return reply;
  } catch {
    throw new Error('Unable to generate regret insight');
  }
}

export async function generateWeatherRiskAnalysis(
  weather: { temperature: number; humidity: number; rainfall: number },
  crops: string[]
): Promise<{ risk_score: number; diseases_to_watch: string[]; advisory: string }> {
  try {
    const text = await callGeminiText(
      '',
      `Weather: ${weather.temperature}°C, ${weather.humidity}% humidity, ${weather.rainfall}mm rain.
Crops: ${crops.join(', ')}.
Respond ONLY with JSON:
{"risk_score": <0-100>, "diseases_to_watch": ["disease1", "disease2", "disease3"], "advisory": "2-sentence advisory for farmer"}`,
      0.3,
      400
    );
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error('Unable to generate weather risk analysis');
  }
}

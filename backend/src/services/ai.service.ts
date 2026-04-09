import sharp from 'sharp';
import logger from '../utils/logger';
import { createChatCompletion } from './openai.service';

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
  recommendation: string;
  regret_insight: string;
  treatment_steps: TreatmentStep[];
  disease_info: {
    scientific_name: string;
    affected_crops: string[];
    spread_mechanism: string;
    prevention: string;
    symptoms: string[];
  };
  behavioral_triggers: {
    loss_framing: string;
    urgency_statement: string;
    social_proof: string;
    action_cta: string;
  };
  weather_risk_note?: string;
}

export async function analyzeImageWithAI(imagePath: string): Promise<AIAnalysisResult> {
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

  const userPrompt = `Analyze this crop leaf image with maximum precision.
Respond ONLY with this exact JSON structure — no markdown, no extra text:
{
  "disease_name": "exact disease common name, or 'Healthy' if no disease",
  "plant_name": "identified crop/plant name",
  "confidence": <0-100 number>,
  "severity": "critical" | "warning" | "info" | "healthy",
  "potential_loss_inr": <estimated INR financial loss per acre if untreated, 0 if healthy>,
  "recommendation": "1-2 sentence specific treatment using Indian market product names",
  "regret_insight": "Powerful behavioral message: what happens if farmer ignores this — include exact timeframe, % crop loss, and ₹ amount",
  "treatment_steps": [
    {"step": 1, "title": "step title", "description": "detailed instructions", "duration": "time required", "product": "product name if applicable", "dosage": "dosage if applicable"},
    {"step": 2, "title": "...", "description": "...", "duration": "..."},
    {"step": 3, "title": "...", "description": "...", "duration": "..."},
    {"step": 4, "title": "Monitor & Verify", "description": "monitoring instructions", "duration": "Ongoing"}
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

  const text = await createChatCompletion({
    model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: 1800,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ],
      },
    ],
  });

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
    const reply = await createChatCompletion({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      maxTokens: 250,
      temperature: 0.4,
      messages: [{
        role: 'user',
        content: `A farmer detected ${disease} in their ${cropName} crop and ignored it for ${daysIgnored} days.
The potential loss is ₹${potentialLoss.toLocaleString('en-IN')}.
Write a 2-sentence powerful emotional + financial REGRET message in simple English that motivates immediate action.
Make it personal, urgent, and specific with numbers. Do not use generic language.`,
      }],
    });
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
    const text = await createChatCompletion({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      maxTokens: 400,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `Weather: ${weather.temperature}°C, ${weather.humidity}% humidity, ${weather.rainfall}mm rain.
Crops: ${crops.join(', ')}.
Respond ONLY with JSON:
{"risk_score": <0-100>, "diseases_to_watch": ["disease1", "disease2", "disease3"], "advisory": "2-sentence advisory for farmer"}`,
      }],
    });
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error('Unable to generate weather risk analysis');
  }
}

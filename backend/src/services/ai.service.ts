import sharp from 'sharp';
import logger from '../utils/logger';
import { callGeminiWithVision, callGeminiText } from './gemini.service';

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

  const userPrompt = `⚠️ CRITICAL: Plant misidentification causes farmer financial losses. Follow these steps EXACTLY:

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

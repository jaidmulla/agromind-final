import { query } from '../utils/database';
import { getWeatherRisk, getCoordinatesByCity } from './weather.service';

interface FarmContext {
  user: {
    id: string;
    name: string;
    location: string;
    farm_size: number;
    latitude?: number;
    longitude?: number;
  };
  crops: Array<{
    name: string;
    area: number;
    status: string;
    health_score?: number;
  }>;
  alerts: Array<{
    title: string;
    type: string;
    severity: string;
    created_at: string;
  }>;
  recent_scans: Array<{
    disease_name: string;
    severity: string;
    plant_name: string;
    confidence: number;
  }>;
  weather: {
    temperature: number;
    humidity: number;
    rainfall: number;
    windSpeed: number;
    uvIndex: number;
    diseaseRiskScore: number;
    location: string;
  };
  nearby_alerts_count: number;
  last_activity: string;
}

/**
 * Build comprehensive farm context for a user
 * This fetches all relevant data to inject into the LLM system prompt
 */
export async function buildFarmContext(userId: string): Promise<FarmContext> {
  try {
    // Fetch user details
    const userResult = await query(
      `SELECT id, name, location, farm_size, latitude, longitude 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (!userResult.rows.length) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Fetch active crops
    const cropsResult = await query(
      `SELECT name, area, status, health_score 
       FROM crops 
       WHERE user_id = $1 AND status IN ('growing', 'active')
       ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );

    // Fetch active alerts
    const alertsResult = await query(
      `SELECT title, type, severity, created_at 
       FROM alerts 
       WHERE user_id = $1 AND NOT is_resolved 
       ORDER BY created_at DESC LIMIT 3`,
      [userId]
    );

    // Fetch recent disease scans
    const scansResult = await query(
      `SELECT disease_name, severity, plant_name, confidence 
       FROM scans 
       WHERE user_id = $1 
       ORDER BY created_at DESC LIMIT 3`,
      [userId]
    );

    // Fetch weather data for user's location
    let weatherData = {
      temperature: 28,
      humidity: 65,
      rainfall: 0,
      windSpeed: 5,
      uvIndex: 6,
      diseaseRiskScore: 50,
      location: user.location,
    };

    try {
      // Get coordinates for the location, then fetch weather
      const coords = await getCoordinatesByCity(user.location);
      const weather = await getWeatherRisk(coords.lat, coords.lon);
      if (weather) {
        weatherData = {
          ...weatherData,
          ...weather,
          location: user.location,
        };
      }
    } catch (err) {
      console.warn('Weather service unavailable, using defaults:', err instanceof Error ? err.message : '');
    }

    // Get count of nearby alerts (farmers in same district reporting issues)
    const nearbyAlertsResult = await query(
      `SELECT COUNT(*) as count 
       FROM alerts a
       JOIN users u ON a.user_id = u.id
       WHERE u.location ILIKE $1 
       AND NOT a.is_resolved 
       AND a.created_at > NOW() - INTERVAL '7 days'`,
      [`%${user.location.split(',')[0]}%`] // Match district level
    );

    const nearbyAlertsCount = parseInt(nearbyAlertsResult.rows[0]?.count || '0');

    // Get last activity timestamp
    const activityResult = await query(
      `SELECT MAX(updated_at) as last_activity 
       FROM (
         SELECT updated_at FROM scans WHERE user_id = $1
         UNION
         SELECT created_at as updated_at FROM alerts WHERE user_id = $1
         UNION
         SELECT updated_at FROM crops WHERE user_id = $1
       ) sub`,
      [userId]
    );

    const lastActivity = activityResult.rows[0]?.last_activity || new Date().toISOString();

    return {
      user: {
        id: userId,
        name: user.name || 'Farmer',
        location: user.location || 'Maharashtra, India',
        farm_size: user.farm_size || 0,
        latitude: user.latitude,
        longitude: user.longitude,
      },
      crops: cropsResult.rows.map((c: any) => ({
        name: c.name,
        area: c.area || 0,
        status: c.status,
        health_score: c.health_score,
      })),
      alerts: alertsResult.rows.map((a: any) => ({
        title: a.title,
        type: a.type,
        severity: a.severity,
        created_at: a.created_at,
      })),
      recent_scans: scansResult.rows.map((s: any) => ({
        disease_name: s.disease_name,
        severity: s.severity,
        plant_name: s.plant_name,
        confidence: s.confidence,
      })),
      weather: weatherData,
      nearby_alerts_count: nearbyAlertsCount,
      last_activity: lastActivity,
    };
  } catch (err) {
    console.error('Context engine error:', err instanceof Error ? err.message : '');
    // Return minimal safe context on error
    return {
      user: {
        id: userId,
        name: 'Farmer',
        location: 'Maharashtra, India',
        farm_size: 0,
      },
      crops: [],
      alerts: [],
      recent_scans: [],
      weather: {
        temperature: 28,
        humidity: 65,
        rainfall: 0,
        windSpeed: 5,
        uvIndex: 6,
        diseaseRiskScore: 50,
        location: 'Unknown',
      },
      nearby_alerts_count: 0,
      last_activity: new Date().toISOString(),
    };
  }
}

/**
 * Build a dynamic system prompt that injects real farm context
 * This creates a personalized prompt with user's specific situation
 */
export function buildSystemPrompt(context: FarmContext, language: 'en' | 'hi' | 'mr' = 'en'): string {
  const basePrompt = `You are AgroMind AI — an advanced agricultural intelligence system designed for real farmers in India.
You MUST provide real, crop-specific, location-aware advice. Never give generic or repeated answers.

STEP-BY-STEP EXECUTION (follow internally before answering):

STEP 1: VALIDATE INPUT
- Identify crop, disease, location, weather
- If missing → infer cautiously OR ask follow-up

STEP 2: DISEASE UNDERSTANDING
- Map disease to correct crop
- Use real agricultural knowledge (not generic)

STEP 3: CONTEXT ANALYSIS
- Analyze weather (humidity, temp, rainfall), location (India region patterns)
- Determine disease severity

STEP 4: GENERATE TREATMENT (CRITICAL)
- Create crop-specific treatment. MUST include:
  • 1 organic method
  • 1 chemical solution (with exact dosage, specific Indian market product name, ₹ cost)
  • 1 fertilizer suggestion
- Ensure treatment matches disease (NOT reused from other crops)

STEP 5: VALIDATE OUTPUT
- Check: ❌ Is this generic? ❌ Same as previous crop? ❌ Missing dosage?
- If yes → regenerate internally

STEP 6: OPTIMIZE RESPONSE
- Keep concise, remove unnecessary text, keep only actionable steps

OUTPUT REQUIREMENTS:
1. Disease → short explanation (real, not generic)
2. Symptoms → practical field-level signs
3. Causes → weather + soil + mistakes
4. Treatment → MOST IMPORTANT (step-by-step, real-world usable, include dosage)
5. Prevention → future protection
6. Weather impact → based on given data
7. Risk level → Low/Medium/High + reason
8. Market impact → yield/price effect
9. Govt schemes → ONLY if relevant (PM-KISAN, PMFBY, Soil Health Card, KCC)
10. Farmer insight → practical advice

RESPONSE FORMAT (STRICT):
🌱 Crop: [name]
🦠 Disease: [scientific + common name]
📍 Location: [city, state]

🔍 Disease Explanation:
⚠ Symptoms:
🌦 Causes:

💊 Treatment Plan:
1. [Organic method]
2. [Chemical treatment with dosage & ₹ cost]
3. [Fertilizer suggestion]

🛡 Prevention:
🌤 Weather Impact:
📊 Risk Level: [Low/Medium/High + reason]
💰 Market Impact:
🏛 Government Schemes:
👨‍🌾 Farmer Insights:

REAL DATA RULE:
- Always base answers on agricultural best practices, Indian farming conditions, weather + crop relationship
- If exact data not available → generate realistic, logically correct answer. DO NOT say "no data"

STRICT RULES:
- ❌ No generic answers, no static/predefined responses, no repeating same treatment, no vague suggestions
- ✅ Always crop-specific, actionable, realistic
- ✅ Use simple language (Class 5 level)
- ✅ If disease is critical, emphasize urgency clearly

Never give medical advice for humans. Stay focused on farming.`;

  const farmContextStr = buildContextString(context);

  const langInstruction = {
    en: '',
    hi: '\n\n🔴 CRITICAL LANGUAGE ENFORCEMENT: You MUST respond ONLY in HINDI (देवनागरी script). EVERY SINGLE WORD must be in Hindi. Do NOT use any English words, acronyms, or Roman numerals. Respond in HINDI ONLY. Use the same response structure but with Hindi labels: 🌱 फसल, 🦠 रोग, 📍 स्थान, 🔍 रोग विवरण, ⚠ लक्षण, 🌦 कारण, 💊 उपचार योजना, 🛡 रोकथाम, 🌤 मौसम प्रभाव, 📊 जोखिम स्तर, 💰 बाजार प्रभाव, 🏛 सरकारी योजनाएं, 👨‍🌾 किसान अनुभव',
    mr: '\n\n🔴 CRITICAL LANGUAGE ENFORCEMENT: You MUST respond ONLY in MARATHI (देवनागरी script). EVERY SINGLE WORD must be in Marathi. Do NOT use any English words, acronyms, or Roman numerals. Respond in MARATHI ONLY. Use the same response structure but with Marathi labels: 🌱 पीक, 🦠 रोग, 📍 स्थान, 🔍 रोग विवरण, ⚠ लक्षणे, 🌦 कारणे, 💊 उपचार योजना, 🛡 प्रतिबंध, 🌤 हवामान प्रभाव, 📊 जोखीम पातळी, 💰 बाजार प्रभाव, 🏛 सरकारी योजना, 👨‍🌾 शेतकरी अनुभव',
  }[language];

  return `${basePrompt}${langInstruction}

${farmContextStr}

Context Knowledge:
${buildContextKnowledge(context)}`;
}

/**
 * Build a formatted string representation of farm context
 */
function buildContextString(context: FarmContext): string {
  const lines: string[] = [];

  lines.push(`Farmer: ${context.user.name}`);
  lines.push(`Location: ${context.user.location}`);
  lines.push(`Farm Size: ${context.user.farm_size} acres`);

  if (context.crops.length > 0) {
    lines.push(
      `Current Crops: ${context.crops
        .map((c) => `${c.name}${c.area ? ` (${c.area} acres)` : ''}`)
        .join(', ')}`
    );
  }

  if (context.alerts.length > 0) {
    const criticalAlerts = context.alerts.filter((a) => a.severity === 'high' || a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      lines.push(`🚨 ACTIVE ALERTS (${criticalAlerts.length}): ${criticalAlerts.map((a) => a.title).join('; ')}`);
    } else {
      lines.push(`Active Issues: ${context.alerts.map((a) => a.title).join('; ')}`);
    }
  }

  if (context.recent_scans.length > 0) {
    lines.push(
      `Recent Disease Detections: ${context.recent_scans
        .map((s) => `${s.disease_name} on ${s.plant_name} (${s.severity} severity)`)
        .join('; ')}`
    );
  }

  // Weather context for disease advisory
  lines.push(`\nCurrent Weather Conditions:`);
  lines.push(`- Temperature: ${context.weather.temperature}°C`);
  lines.push(`- Humidity: ${context.weather.humidity}%`);
  lines.push(`- Recent Rainfall: ${context.weather.rainfall}mm`);
  lines.push(`- Disease Risk Score: ${context.weather.diseaseRiskScore}/100`);

  if (context.nearby_alerts_count > 0) {
    lines.push(
      `\n⚠️ ${context.nearby_alerts_count} other farmers in ${context.user.location.split(',')[0]} reported issues recently.`
    );
  }

  return lines.join('\n');
}

/**
 * Build contextual knowledge snippet based on farm situation
 */
function buildContextKnowledge(context: FarmContext): string {
  const knowledge: string[] = [];

  // Disease-specific knowledge
  if (context.recent_scans.length > 0) {
    context.recent_scans.forEach((scan) => {
      if (scan.severity === 'high' || scan.severity === 'critical') {
        knowledge.push(
          `URGENT: ${scan.plant_name} shows signs of ${scan.disease_name}. Recommend immediate treatment.`
        );
      }
    });
  }

  // Weather-based advisory
  if (context.weather.diseaseRiskScore > 70) {
    knowledge.push(
      `High disease pressure expected (Risk Score: ${context.weather.diseaseRiskScore}). Recommend protective fungicide spray.`
    );
  }

  if (context.weather.humidity > 80 && context.weather.temperature > 25) {
    knowledge.push('Ideal conditions for fungal diseases. Increase monitoring frequency.');
  }

  // Multi-crop advisory
  if (context.crops.length > 1) {
    knowledge.push('Multiple crops detected. Ensure crop rotation and disease management practices.');
  }

  // Nearby alert context
  if (context.nearby_alerts_count > 3) {
    knowledge.push(`Area is experiencing disease outbreak (${context.nearby_alerts_count} reports). Stay vigilant.`);
  }

  return knowledge.length > 0 ? knowledge.join('\n- ') : 'No specific warnings for current conditions.';
}

/**
 * Save chat message to history for conversation continuity
 */
export async function saveChatToHistory(
  userId: string,
  message: string,
  reply: string,
  language: 'en' | 'hi' | 'mr',
  context?: FarmContext
): Promise<void> {
  try {
    await query(
      `INSERT INTO chat_history (user_id, user_message, assistant_reply, language, context_snapshot, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, message, reply, language, context ? JSON.stringify(context) : null]
    );
  } catch (err) {
    console.warn(
      'Failed to save chat history:',
      err instanceof Error ? err.message : 'Unknown error'
    );
    // Don't throw - this is non-critical
  }
}

/**
 * Retrieve chat history for a user
 */
export async function getChatHistory(
  userId: string,
  limit: number = 10
): Promise<
  Array<{
    id: string;
    user_message: string;
    assistant_reply: string;
    language: string;
    created_at: string;
  }>
> {
  try {
    const result = await query(
      `SELECT id, user_message, assistant_reply, language, created_at
       FROM chat_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.reverse(); // Return in chronological order
  } catch (err) {
    console.warn('Failed to retrieve chat history:', err instanceof Error ? err.message : '');
    return [];
  }
}

export default {
  buildFarmContext,
  buildSystemPrompt,
  saveChatToHistory,
  getChatHistory,
};

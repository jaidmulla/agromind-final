import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { createChatCompletion } from '../services/openai.service';
import { getAIResponse } from '../services/local-ai-doctor.service';
import { buildFarmContext, buildSystemPrompt, saveChatToHistory, getChatHistory } from '../services/context-engine.service';

/**
 * Detect the language of a given text using character detection and keywords
 * Returns: 'hi' | 'mr' | 'en'
 */
function detectLanguage(text: string): 'hi' | 'mr' | 'en' {
  // Devanagari script detection for Hindi/Marathi
  const devanagariRegex = /[\u0900-\u097F]/g;
  const devanagariMatches = text.match(devanagariRegex) || [];
  const devanagariDensity = devanagariMatches.length / text.length;

  // If >30% of text is Devanagari, it's Hindi or Marathi
  if (devanagariDensity > 0.3) {
    // Hindi/Marathi keyword detection to differentiate
    const hindiMarkers = /(हूँ|हूं|है|हैं|को|का|में|पर|और|या|नहीं|हाँ|जी|भाई|साहब)/gi;
    const marathiMarkers = /(आहे|आहेत|ला|ने|मध्ये|होते|असे|आणि|किंवा|नाही|होय|भाऊ)/gi;

    const hindiCount = (text.match(hindiMarkers) || []).length;
    const marathiCount = (text.match(marathiMarkers) || []).length;

    return marathiCount > hindiCount ? 'mr' : 'hi';
  }

  // English detection
  return 'en';
}

const AGROMIND_SYSTEM = `You are AgroMind AI — an advanced agricultural intelligence system designed for real farmers in India.
You MUST provide real, crop-specific, location-aware advice. Never give generic or repeated answers.

STEP-BY-STEP EXECUTION (follow internally before answering):

STEP 1: VALIDATE INPUT — Identify crop, disease, location, weather. If missing → infer cautiously OR ask follow-up.
STEP 2: DISEASE UNDERSTANDING — Map disease to correct crop. Use real agricultural knowledge (not generic).
STEP 3: CONTEXT ANALYSIS — Analyze weather (humidity, temp, rainfall), location (India region patterns). Determine severity.
STEP 4: GENERATE TREATMENT (CRITICAL) — Create crop-specific treatment. MUST include: 1 organic method, 1 chemical solution (with exact dosage, Indian market product name, ₹ cost), 1 fertilizer suggestion. Ensure treatment matches disease (NOT reused).
STEP 5: VALIDATE OUTPUT — Check: Is this generic? Same as previous crop? Missing dosage? If yes → regenerate internally.
STEP 6: OPTIMIZE RESPONSE — Keep concise, remove unnecessary text, keep only actionable steps.

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

REAL DATA RULE: Always base answers on agricultural best practices and Indian farming conditions. If exact data not available → generate realistic, logically correct answer. DO NOT say "no data".

STRICT RULES:
- ❌ No generic answers, no static responses, no repeating same treatment, no vague suggestions
- ✅ Always crop-specific, actionable, realistic
- ✅ Use simple language (Class 5 level)
- ✅ If disease is critical, emphasize urgency clearly

Never give medical advice for humans. Stay focused on farming.`;

interface Message { role: 'user' | 'assistant'; content: string }

/**
 * Main chat endpoint with context-aware responses
 * Routes to local AI Doctor for Hindi/Marathi, to OpenAI for English
 */
export const chat = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { message, language = 'en', history = [] } = req.body;
    const userId = req.user!.id;

    if (!message?.trim()) {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    // Build comprehensive farm context (fetches user data, crops, alerts, weather, etc.)
    const farmContext = await buildFarmContext(userId);

    // For Hindi and Marathi, use local AI Doctor which has proven multilingual support
    if (language === 'hi' || language === 'mr') {
      console.log(`[CHAT] Using local AI Doctor for language=${language}, user=${userId}`);

      const aiResponse = getAIResponse(
        message,
        {
          name: farmContext.user.name,
          location: farmContext.user.location,
          farm_size: farmContext.user.farm_size.toString(),
          crops: farmContext.crops.map((c) => c.name),
          alerts: farmContext.alerts.map((a) => a.title),
        },
        language as 'en' | 'hi' | 'mr'
      );

      // Save to chat history
      await saveChatToHistory(userId, message, aiResponse.message, language as 'en' | 'hi' | 'mr', farmContext).catch(
        (err) => console.warn('Failed to save chat history:', err)
      );

      const elapsedMs = Date.now() - startTime;
      res.json({
        success: true,
        data: {
          reply: aiResponse.message,
          language,
          context: {
            location: farmContext.user.location,
            crops_count: farmContext.crops.length,
            active_alerts: farmContext.alerts.length,
            disease_risk_score: farmContext.weather.diseaseRiskScore,
          },
          performance: {
            response_time_ms: elapsedMs,
            ai_service: 'local',
          },
        },
      });
      return;
    }

    // For English, use OpenAI with context-injected system prompt
    console.log(`[CHAT] Building context for language=en, user=${userId}`);

    const systemPrompt = buildSystemPrompt(farmContext, 'en');

    // Build messages array: append to history
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...((history as Message[]).slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))),
      { role: 'user', content: message },
    ];

    let reply: string;
    let aiService = 'openai';

    try {
      reply = await createChatCompletion({
        model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        maxTokens: 650,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      });

      // 🔴 CRITICAL: Language Validation & Fallback
      // Detect if response is in wrong language (only for non-English)
      if (language !== 'en') {
        const detectedLang = detectLanguage(reply);
        if (detectedLang !== language) {
          console.warn(
            `[CHAT] Language mismatch detected! Requested=${language}, Got=${detectedLang}. Attempting re-call with translation.`
          );

          // Re-call OpenAI with explicit translation instruction
          const translationPrompt = language === 'hi'
            ? `\n\n🔴 CRITICAL FIX: Your previous response was in ${detectedLang}. Now respond EXACTLY the same content but ONLY in HINDI (देवनागरी script). Every single word must be Hindi. Do NOT use any English words. Respond in HINDI ONLY.`
            : `\n\n🔴 CRITICAL FIX: Your previous response was in ${detectedLang}. Now respond EXACTLY the same content but ONLY in MARATHI (देवनागरी script). Every single word must be Marathi. Do NOT use any English words. Respond in MARATHI ONLY.`;

          const translationMessages = [
            ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            { role: 'assistant' as const, content: reply },
            { role: 'user' as const, content: translationPrompt },
          ];

          try {
            reply = await createChatCompletion({
              model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
              maxTokens: 650,
              temperature: 0.2,
              messages: [
                { role: 'system', content: `${systemPrompt}\n\nIMPERATIVE: You must respond in ${language === 'hi' ? 'HINDI' : 'MARATHI'} ONLY. No English words allowed.` },
                ...translationMessages,
              ],
            });
            console.log(`[CHAT] Translation successful for language=${language}`);
          } catch (translationErr) {
            // If translation fails, use original reply and log warning
            console.warn(
              `[CHAT] Translation failed, using original response. Error:`,
              translationErr instanceof Error ? translationErr.message : 'Unknown error'
            );
          }
        }
      }
    } catch (err) {
      // Fallback to local AI Doctor if OpenAI fails
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[CHAT] OpenAI failed (${errMsg}), falling back to local AI Doctor`);
      aiService = 'local-fallback';

      const aiResponse = getAIResponse(
        message,
        {
          name: farmContext.user.name,
          location: farmContext.user.location,
          farm_size: farmContext.user.farm_size.toString(),
          crops: farmContext.crops.map((c) => c.name),
          alerts: farmContext.alerts.map((a) => a.title),
        },
        'en'
      );

      reply = aiResponse.message;
    }

    // Save to chat history
    await saveChatToHistory(userId, message, reply, 'en', farmContext).catch((err) =>
      console.warn('Failed to save chat history:', err)
    );

    const elapsedMs = Date.now() - startTime;
    res.json({
      success: true,
      data: {
        reply,
        language,
        context: {
          location: farmContext.user.location,
          crops_count: farmContext.crops.length,
          active_alerts: farmContext.alerts.length,
          disease_risk_score: farmContext.weather.diseaseRiskScore,
          nearby_farmer_alerts: farmContext.nearby_alerts_count,
        },
        performance: {
          response_time_ms: elapsedMs,
          ai_service: aiService,
        },
      },
    });
  } catch (err) {
    console.error('[CHAT] Fatal error:', err);
    const rawMessage = err instanceof Error ? err.message : 'Chat service unavailable. Please try again.';
    res.status(500).json({ success: false, message: rawMessage });
  }
};

export const analyzeImage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { message = '', language = 'en' } = req.body;
    const file = (req as any).file;
    const userId = req.user!.id;
    
    if (!file) {
      res.status(400).json({ success: false, message: 'Image is required' });
      return;
    }

    // Build farm context for personalized analysis
    const farmContext = await buildFarmContext(userId);
    const userCrop = farmContext.crops[0]?.name || 'Unknown crop';

    // Convert image to base64 for analysis
    const imageBase64 = file.buffer.toString('base64');
    const imageUrl = `data:${file.mimetype};base64,${imageBase64}`;

    const analyzePicturePrompt = `You are analyzing a leaf/crop image from an Indian farmer. Based on the image, provide a COMPLETE diagnosis using this structure:

🌱 Crop: [identify from image]
🦠 Disease: [scientific name + common name]
📍 Location: ${farmContext.user.location}

🔍 Disease Explanation: [Clear explanation of the disease]
⚠ Symptoms: [What you see in the image + other symptoms to watch for]
🌦 Causes: [Weather conditions / soil issues / farming mistakes that cause this]

💊 Treatment Plan (MOST IMPORTANT — crop-specific, REAL products):
1. Organic solution [with details]
2. Chemical treatment [specific Indian market product name, exact dosage, ₹ cost]
3. Fertilizer recommendation [if applicable]

🛡 Prevention: [How to avoid in future + seasonal advice]
🌤 Weather Impact: [Current ${farmContext.weather.temperature}°C, ${farmContext.weather.humidity}% humidity — how this affects the disease]
📊 Risk Level: [Low/Medium/High + reasoning based on disease risk score ${farmContext.weather.diseaseRiskScore}/100]
💰 Market Impact: [Expected yield reduction, price impact, recovery timeline]
🏛 Government Schemes: [Relevant Indian schemes — PM-KISAN, PMFBY, Soil Health Card, KCC]
👨‍🌾 Farmer Insights: [Regional trends for ${farmContext.user.location}]

${farmContext.user.name}'s farm context:
- Crop: ${userCrop}
- Location: ${farmContext.user.location}
- Farm Size: ${farmContext.user.farm_size} acres
- Weather: ${farmContext.weather.temperature}°C, ${farmContext.weather.humidity}% humidity, ${farmContext.weather.rainfall}mm rainfall
- Disease Risk Score: ${farmContext.weather.diseaseRiskScore}/100

STRICT RULES: No generic answers. Must be crop-specific with real Indian market products and ₹ prices.`;

    const langInstruction = language === 'hi'
      ? '\n\n🔴 CRITICAL: Respond ONLY in HINDI (देवनागरी script). EVERY word must be Hindi. Use labels: 🌱 फसल, 🦠 रोग, 📍 स्थान, 🔍 रोग विवरण, ⚠ लक्षण, 🌦 कारण, 💊 उपचार योजना, 🛡 रोकथाम, 🌤 मौसम प्रभाव, 📊 जोखिम स्तर, 💰 बाजार प्रभाव, 🏛 सरकारी योजनाएं, 👨‍🌾 किसान अनुभव'
      : language === 'mr'
      ? '\n\n🔴 CRITICAL: Respond ONLY in MARATHI (देवनागरी script). EVERY word must be Marathi. Use labels: 🌱 पीक, 🦠 रोग, 📍 स्थान, 🔍 रोग विवरण, ⚠ लक्षणे, 🌦 कारणे, 💊 उपचार योजना, 🛡 प्रतिबंध, 🌤 हवामान प्रभाव, 📊 जोखीम पातळी, 💰 बाजार प्रभाव, 🏛 सरकारी योजना, 👨‍🌾 शेतकरी अनुभव'
      : '';

    let reply: string;
    try {
      reply = await createChatCompletion({
        model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        maxTokens: 900,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `${AGROMIND_SYSTEM}${langInstruction}\n\n${analyzePicturePrompt}`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
              {
                type: 'text',
                text: message || 'Please analyze this leaf image and provide diagnosis and treatment plan.',
              },
            ] as any,
          },
        ],
      });

      // Save image analysis to chat history
      await saveChatToHistory(userId, message || 'Image analysis', reply, language as 'en' | 'hi' | 'mr', farmContext).catch(
        (err) => console.warn('Failed to save image analysis to history:', err)
      );
    } catch (err) {
      // Fallback: Use local AI Doctor with generic crop recommendation
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('OpenAI vision unavailable, using local AI Doctor:', errMsg);

      const cropMessage = message || `I uploaded a leaf image of my ${userCrop}. Please diagnose and provide treatment plan.`;
      const aiResponse = getAIResponse(
        cropMessage,
        {
          name: farmContext.user.name,
          location: farmContext.user.location,
          farm_size: farmContext.user.farm_size.toString(),
          crops: [userCrop],
          alerts: farmContext.alerts.map((a) => a.title),
        },
        language as 'en' | 'hi' | 'mr'
      );

      reply = aiResponse.message;
    }

    res.json({
      success: true,
      data: {
        reply,
        language,
        crop: userCrop,
        context: {
          location: farmContext.user.location,
          disease_risk_score: farmContext.weather.diseaseRiskScore,
        },
      },
    });
  } catch (err) {
    console.error('Image analysis error:', err);
    const rawMessage = err instanceof Error ? err.message : 'Image analysis failed. Please try again.';
    res.status(500).json({ success: false, message: rawMessage });
  }
};

export const getQuickReplies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { language = 'en' } = req.query;
    const lang = String(language || 'en');
    
    // Default quick replies (fallback when OpenAI is not available)
    const defaultReplies: Record<string, string[]> = {
      en: [
        'How do I identify crop diseases?',
        'What fertilizers should I use?',
        'How are nearby farmers doing?',
        'What government schemes am I eligible for?',
        'When should I apply pesticides?',
        'How do I prevent crop loss?',
      ],
      hi: [
        'मैं फसल की बीमारियों की पहचान कैसे करूं?',
        'मुझे कौन सी खाद का उपयोग करना चाहिए?',
        'पास के किसान कैसे हैं?',
        'मैं किन सरकारी योजनाओं के लिए पात्र हूं?',
        'मुझे कीटनाशक कब लगाना चाहिए?',
        'मैं फसल के नुकसान को कैसे रोक सकता हूं?',
      ],
      mr: [
        'मी पिकांच्या आजारांची ओळख कशी करू?',
        'मला कोणत्या खतांचा वापर करावा?',
        'जवळपास शेतकरी कसे आहेत?',
        'मला कोणत्या सरकारी योजनांसाठी पात्र आहे?',
        'मला कीटकनाशक केव्हा लागू करावे?',
        'मी पिकाचे नुकसान कसे रोखू शकतो?',
      ],
    };

    try {
      const prompt = `Generate 6 short quick-reply questions for an Indian farmer using AgroMind AI Doctor.
Language: ${lang === 'hi' ? 'Hindi (Devanagari)' : lang === 'mr' ? 'Marathi (Devanagari)' : 'English'}.
Return ONLY valid JSON: {"replies":["q1","q2","q3","q4","q5","q6"]}`;

      const text = await createChatCompletion({
        model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        maxTokens: 250,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      });
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      const replies = Array.isArray(parsed?.replies) ? parsed.replies : [];
      res.json({ success: true, data: replies });
    } catch {
      // Return default quick replies if OpenAI fails
      const replies = defaultReplies[lang] || defaultReplies['en'];
      res.json({ success: true, data: replies });
    }
  } catch (err) {
    console.error('Quick replies error:', err);
    res.json({ success: true, data: [] });
  }
};

/**
 * Get conversation history for the user
 * Returns up to 20 recent messages with context
 */
export const getChatHistoryEndpoint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = '20' } = req.query;
    const userId = req.user!.id;

    const history = await getChatHistory(userId, parseInt(limit as string, 10));

    res.json({
      success: true,
      data: {
        total: history.length,
        messages: history,
      },
    });
  } catch (err) {
    console.error('Chat history retrieval error:', err);
    const rawMessage = err instanceof Error ? err.message : 'Failed to retrieve chat history';
    res.status(500).json({ success: false, message: rawMessage });
  }
};

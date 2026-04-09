import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger';

// ────────────────────────────────────────────────────────────────────────────
// Claude API Integration — Generate dynamic treatment steps for diseases
// ────────────────────────────────────────────────────────────────────────────

let claudeClient: Anthropic | null = null;

const getClaudeClient = (): Anthropic | null => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  if (!claudeClient) {
    claudeClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  return claudeClient;
};

export interface TreatmentResponse {
  success: boolean;
  content?: string;
  message?: string;
  error?: string;
}

/**
 * Generate treatment steps using Claude API
 * CRITICAL: Never hardcode treatment steps. Always inject Plant.id data into prompt.
 */
export const generateTreatmentSteps = async (
  plantName: string,
  diseaseName: string,
  cause: string,
  probability: number,
  language: string = 'en',
): Promise<TreatmentResponse> => {
  try {
    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.warn('ANTHROPIC_API_KEY not configured. Falling back to generic advice.');
      return generateFallbackTreatment(plantName, diseaseName, language);
    }

    // Build dynamic prompt with Plant.id data
    const prompt = buildPrompt(plantName, diseaseName, cause, probability, language);

    // Call Claude API
    const message = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022', // Use latest Claude model
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text content
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    logger.info(`Treatment steps generated for ${plantName} - ${diseaseName} (probability: ${probability}%)`);

    return {
      success: true,
      content: content.text,
    };
  } catch (error: any) {
    logger.error('Error generating treatment steps with Claude:', {
      error: error.message,
      status: error.status,
    });

    // Fallback to generic advice
    return generateFallbackTreatment(plantName, diseaseName, language);
  }
};

/**
 * Build prompt for Claude — MUST include Plant.id data, never hardcoded
 */
const buildPrompt = (
  plantName: string,
  diseaseName: string,
  cause: string,
  probability: number,
  language: string,
): string => {
  const languageInstructions = getLanguageInstructions(language);

  return `You are an expert agricultural advisor helping Indian farmers treat crop diseases.

IMPORTANT: This is a REAL disease detection result. NOT a template or example.

PLANT IDENTIFICATION:
- Plant: ${plantName}
- Disease: ${diseaseName}
- Confidence: ${probability}%
- Cause: ${cause}

TASK: Provide practical, actionable treatment for this specific disease on this specific plant.

RESPONSE FORMAT:
Provide your answer ${languageInstructions}

Structure your response as:
1. Severity Assessment (1-2 sentences)
2. Exactly 5 numbered treatment steps (each 1-2 sentences)
3. Prevention Tips (3-4 bullet points)

Each step MUST be specific to ${plantName} and ${diseaseName}, NOT generic advice.
Use only locally available materials and methods suitable for Indian farmers.
${language !== 'en' ? `Respond ONLY in ${getLanguageName(language)}. Do not use English.` : ''}`;
};

/**
 * Get language-specific instructions
 */
const getLanguageInstructions = (language: string): string => {
  const instructions: Record<string, string> = {
    en: 'in English',
    hi: 'ONLY in Hindi (हिंदी)',
    mr: 'ONLY in Marathi (मराठी)',
    ta: 'ONLY in Tamil (தமிழ்)',
    te: 'ONLY in Telugu (తెలుగు)',
    kn: 'ONLY in Kannada (ಕನ್ನಡ)',
    gu: 'ONLY in Gujarati (ગુજરાતી)',
    bn: 'ONLY in Bengali (বাংলা)',
    pa: 'ONLY in Punjabi (ਪੰਜਾਬੀ)',
  };

  return instructions[language] || instructions['en'];
};

/**
 * Get full language name
 */
const getLanguageName = (code: string): string => {
  const names: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    mr: 'Marathi',
    ta: 'Tamil',
    te: 'Telugu',
    kn: 'Kannada',
    gu: 'Gujarati',
    bn: 'Bengali',
    pa: 'Punjabi',
  };

  return names[code] || 'English';
};

/**
 * Fallback: Generate generic treatment if Claude API fails
 */
const generateFallbackTreatment = (
  plantName: string,
  diseaseName: string,
  language: string,
): TreatmentResponse => {
  const fallbackTexts: Record<string, string> = {
    en: `Treatment for ${diseaseName} on ${plantName}:

1. Remove affected leaves: Prune and dispose of diseased leaves to prevent spread.
2. Improve air circulation: Space plants properly and remove clutter around plants.
3. Water management: Water at soil level, avoid wetting leaves directly.
4. Apply fungicide: Use copper-based or sulfur fungicide as per label instructions.
5. Monitor daily: Check plants daily for new symptoms and act quickly.

Prevention Tips:
• Rotate crops to prevent disease buildup
• Use disease-resistant varieties when available
• Maintain proper field hygiene by removing plant debris`,

    hi: `${diseaseName} के लिए ${plantName} पर उपचार:

1. प्रभावित पत्तियों को हटाएं: बीमारी वाली पत्तियों को काटकर नष्ट कर दें।
2. हवा का संचार बेहतर करें: पौधों को सही दूरी पर लगाएं।
3. सिंचाई प्रबंधन: पत्तियों को न भिगोएं, जड़ों में पानी दें।
4. कवकनाशी का उपयोग: तांबे या गंधक आधारित कवकनाशी छिड़कें।
5. दैनिक निरीक्षण करें: हर दिन पौधों की जांच करें।

रोकथाम के सुझाव:
• फसल चक्र अपनाएं
• रोग प्रतिरोधी किस्मों का उपयोग करें
• खेत को साफ रखें`,

    mr: `${diseaseName} साठी ${plantName} वर उपचार:

1. रोग ग्रस्त पत्ते हटवा: आजारी पाने असलेलं पान कापून टाकून द्या.
2. हवा संचार सुधारा: रोपांना योग्य अंतर ठेवा.
3. पाणी व्यवस्थापन: पानांचा अनावश्यक छितरा करू नका, मुळांना थेट पाणी द्या.
4. बुरशी नाशक वापरा: तांबे किंवा सल्फर आधारित बुरशी नाशक फवारा.
5. दैनंदिन तपासणी करा: रोज पौधांची तपासणी करा.

प्रतिबंध सूचना:
• पिकांचे फेरबदल करा
• रोग प्रतिरोधक जातीचा वापर करा
• शेताची स्वच्छता राखा`,
  };

  const fallbackText = fallbackTexts[language] || fallbackTexts['en'];

  return {
    success: true,
    content: fallbackText,
    message: 'Fallback advice provided (Claude API unavailable)',
  };
};

export default {
  generateTreatmentSteps,
};

import axios from 'axios';
import logger from '../utils/logger';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}

interface GeminiRequestBody {
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.0-flash';

function getGeminiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Get a key from https://ai.google.dev/');
  }
  return apiKey;
}

export async function callGeminiWithVision(
  base64Image: string,
  systemPrompt: string,
  userPrompt: string,
  isJsonMode: boolean = false
): Promise<string> {
  const apiKey = getGeminiKey();

  try {
    const messages: GeminiMessage[] = [
      {
        role: 'user',
        parts: [
          { text: systemPrompt + '\n\n' + userPrompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
        ],
      },
    ];

    const requestBody: GeminiRequestBody = {
      contents: messages,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1800,
        topP: 0.95,
        topK: 40,
      },
    };

    const response = await axios.post(
      `${GEMINI_API_BASE}/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
      requestBody,
      {
        timeout: 45000,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      logger.error('Gemini response missing content', { response: JSON.stringify(response.data).slice(0, 200) });
      throw new Error('Gemini response missing content');
    }

    return String(text).trim();
  } catch (err: any) {
    const errorMsg = err?.response?.data?.error?.message || err?.message || String(err);
    logger.error('Gemini request failed', { error: errorMsg, status: err?.response?.status });
    throw new Error(`Gemini request failed: ${errorMsg}`);
  }
}

export async function callGeminiText(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.3,
  maxTokens: number = 400
): Promise<string> {
  const apiKey = getGeminiKey();

  try {
    const messages: GeminiMessage[] = [
      {
        role: 'user',
        parts: [{ text: systemPrompt + '\n\n' + userPrompt }],
      },
    ];

    const requestBody: GeminiRequestBody = {
      contents: messages,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        topP: 0.95,
        topK: 40,
      },
    };

    const response = await axios.post(
      `${GEMINI_API_BASE}/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
      requestBody,
      {
        timeout: 45000,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      logger.error('Gemini text response missing content', { response: JSON.stringify(response.data).slice(0, 200) });
      throw new Error('Gemini response missing content');
    }

    return String(text).trim();
  } catch (err: any) {
    const errorMsg = err?.response?.data?.error?.message || err?.message || String(err);
    logger.error('Gemini text request failed', { error: errorMsg, status: err?.response?.status });
    throw new Error(`Gemini request failed: ${errorMsg}`);
  }
}

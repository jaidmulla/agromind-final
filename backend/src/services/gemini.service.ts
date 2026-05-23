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
const MODEL_CHAIN = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
const MAX_RETRIES_PER_MODEL = 2;
const RETRY_BASE_DELAY_MS = 1500;

function getGeminiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Get a key from https://ai.google.dev/');
  }
  return apiKey;
}

function isRetryableStatus(status: number | undefined): boolean {
  return status === 429 || status === 500 || status === 503 || status === 502;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGeminiWithRetryAndFallback(
  requestBody: GeminiRequestBody,
  models: string[],
  apiKey: string,
  timeoutMs: number = 45000
): Promise<string> {
  let lastError: Error | null = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
      try {
        const response = await axios.post(
          `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`,
          requestBody,
          {
            timeout: timeoutMs,
            headers: { 'Content-Type': 'application/json' },
          }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          logger.error('Gemini response missing content', {
            model,
            attempt,
            response: JSON.stringify(response.data).slice(0, 200),
          });
          throw new Error('Gemini response missing content');
        }

        if (model !== models[0]) {
          logger.info(`Gemini fallback succeeded with model=${model} on attempt ${attempt}`);
        }

        return String(text).trim();
      } catch (err: any) {
        const status = err?.response?.status;
        const errorMsg = err?.response?.data?.error?.message || err?.message || String(err);
        lastError = new Error(`Gemini [${model}] failed: ${errorMsg}`);

        if (attempt < MAX_RETRIES_PER_MODEL && isRetryableStatus(status)) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          logger.warn(
            `Gemini model=${model} attempt ${attempt}/${MAX_RETRIES_PER_MODEL} failed (status=${status}), retrying in ${delay}ms`
          );
          await sleep(delay);
          continue;
        }

        logger.warn(
          `Gemini model=${model} exhausted ${attempt} attempt(s) (status=${status}). ${
            model !== models[models.length - 1] ? 'Switching to next fallback model.' : 'No more fallback models.'
          }`
        );
        break; // Move to next model in chain
      }
    }
  }

  logger.error('All Gemini models exhausted', { models, error: lastError?.message });
  throw lastError || new Error('All Gemini models failed');
}

export async function callGeminiWithVision(
  base64Image: string,
  systemPrompt: string,
  userPrompt: string,
  isJsonMode: boolean = false
): Promise<string> {
  const apiKey = getGeminiKey();

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

  return callGeminiWithRetryAndFallback(requestBody, MODEL_CHAIN, apiKey, 45000);
}

export async function callGeminiText(
  systemPrompt: string,
  userPrompt: string,
  temperature: number = 0.3,
  maxTokens: number = 400
): Promise<string> {
  const apiKey = getGeminiKey();

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

  return callGeminiWithRetryAndFallback(requestBody, MODEL_CHAIN, apiKey, 45000);
}


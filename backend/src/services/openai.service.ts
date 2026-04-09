import axios from 'axios';
import logger from '../utils/logger';

export type OpenAIRole = 'system' | 'user' | 'assistant';

export interface OpenAIMessage {
  role: OpenAIRole;
  // content can be a string or multimodal array (text + image)
  content: any;
}

interface ChatCompletionOptions {
  model?: string;
  messages: OpenAIMessage[];
  maxTokens?: number;
  temperature?: number;
  response_format?: { type: 'json_object' } | { type: 'text' } | undefined;
}

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function getOpenAIKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'sk-test-placeholder-for-development' || apiKey.startsWith('sk-test-')) {
    throw new Error('OPENAI_API_KEY is not configured or is a placeholder. Get a real key from https://platform.openai.com/api-keys');
  }
  if (!apiKey.startsWith('sk-')) {
    throw new Error('OPENAI_API_KEY format is invalid. Keys should start with "sk-"');
  }
  return apiKey;
}

export async function createChatCompletion(options: ChatCompletionOptions): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    messages,
    maxTokens = 800,
    temperature = 0.2,
    response_format,
  } = options;

  const apiKey = getOpenAIKey();

  try {
    const res = await axios.post(
      `${OPENAI_BASE_URL}/chat/completions`,
      {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        ...(response_format ? { response_format } : {}),
      },
      {
        timeout: 45000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = res.data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('OpenAI response missing content');
    }
    return String(text).trim();
  } catch (err: any) {
    logger.error('OpenAI request failed', { err: err?.message || String(err) });
    throw new Error('OpenAI request failed');
  }
}


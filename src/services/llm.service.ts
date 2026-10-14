import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Proveedor de IA de la plataforma. Claude va primero: basta con poner ANTHROPIC_API_KEY
// en el entorno. Sin ella se usa Gemini si hay GOOGLE_API_KEY (comportamiento anterior).
// CLAUDE_MODEL y CLAUDE_EFFORT permiten cambiar modelo y esfuerzo sin tocar código.
const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';
const DEFAULT_CLAUDE_EFFORT = 'low';
const GEMINI_MODEL = 'gemini-flash-latest';

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type LlmProvider = 'anthropic' | 'google';

export function llmConfig(): { provider: LlmProvider; model: string } | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', model: process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL };
  }
  if (process.env.GOOGLE_API_KEY) {
    return { provider: 'google', model: GEMINI_MODEL };
  }
  return null;
}

function httpError(message: string, status: number) {
  const err = new Error(message);
  (err as any).status = status;
  return err;
}

let anthropicClient: Anthropic | null = null;

async function generateWithClaude(model: string, prompt: string, maxTokens: number) {
  anthropicClient ??= new Anthropic();
  const effort = (process.env.CLAUDE_EFFORT || DEFAULT_CLAUDE_EFFORT) as Effort;
  // fallbacks 'default': si el modelo rechaza la consulta, la API la repite en otro modelo
  const response = await anthropicClient.beta.messages.create({
    model,
    max_tokens: maxTokens,
    output_config: { effort },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{ role: 'user', content: prompt }],
  });
  if (response.stop_reason === 'refusal') {
    throw httpError('El modelo no ha querido responder a esta consulta', 422);
  }
  return response.content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();
}

async function generateWithGemini(model: string, prompt: string) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string);
  const result = await genAI.getGenerativeModel({ model }).generateContent(prompt);
  return result.response.text()?.trim() || '';
}

export async function generateText(prompt: string, { maxTokens = 4000 }: { maxTokens?: number } = {}) {
  const config = llmConfig();
  if (!config) {
    throw httpError('IA no configurada: falta ANTHROPIC_API_KEY', 500);
  }
  const text =
    config.provider === 'anthropic'
      ? await generateWithClaude(config.model, prompt, maxTokens)
      : await generateWithGemini(config.model, prompt);
  if (!text) {
    throw httpError('Respuesta vacía del modelo', 502);
  }
  return { text, ...config };
}

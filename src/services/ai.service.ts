import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AiDescriptionInput } from '../validators/ai.schema';

export const MODEL_NAME = 'gemini-flash-latest';

// Topes de salida por llamada. Son holgados porque los modelos con razonamiento
// cuentan esos tokens dentro de maxOutputTokens; su objetivo es acotar el coste.
export const MAX_OUTPUT_TOKENS = {
  description: 2048,
  assistant: 4096,
  health: 256,
} as const;

const REQUEST_TIMEOUT_MS = 30_000;

export function getGeminiModel(apiKey: string, maxOutputTokens: number) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel(
    { model: MODEL_NAME, generationConfig: { maxOutputTokens } },
    { timeout: REQUEST_TIMEOUT_MS },
  );
}

const languageMap: Record<AiDescriptionInput['language'], string> = {
  es: 'espanol',
  en: 'ingles',
};

function buildPrompt(input: AiDescriptionInput) {
  const features = input.features.map(f => `- ${f}`).join('\n');
  const language = languageMap[input.language] ?? 'espanol';
  const tone = input.tone;
  const maxWords = input.maxWords;

  return [
    `Genera una descripcion atractiva y concisa en ${language} para una propiedad en alquiler.`,
    `Tono: ${tone}.`,
    `Maximo ${maxWords} palabras.`,
    'Usa solo las caracteristicas proporcionadas y no inventes datos.',
    'Evita emojis y exceso de signos de exclamacion.',
    'Caracteristicas:',
    features,
  ].join('\n');
}

export async function generatePropertyDescription(input: AiDescriptionInput) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    const err = new Error('GOOGLE_API_KEY no configurada');
    (err as any).status = 500;
    throw err;
  }

  const model = getGeminiModel(apiKey, MAX_OUTPUT_TOKENS.description);
  const prompt = buildPrompt(input);

  const result = await model.generateContent(prompt);
  const text = result.response.text()?.trim();

  if (!text) {
    const err = new Error('Respuesta vacia del modelo');
    (err as any).status = 502;
    throw err;
  }

  return text;
}

export async function checkAiHealth(runTest: boolean) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: 'missing_api_key' };
  }

  if (!runTest) {
    return { ok: true, model: MODEL_NAME, test: 'skipped' as const };
  }

  const model = getGeminiModel(apiKey, MAX_OUTPUT_TOKENS.health);
  const result = await model.generateContent('Responde solo con la palabra OK.');
  const text = result.response.text()?.trim() || '';
  const ok = text.toLowerCase().includes('ok');

  return { ok, model: MODEL_NAME, test: 'ran' as const };
}

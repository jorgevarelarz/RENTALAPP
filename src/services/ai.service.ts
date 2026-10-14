import { generateText, llmConfig } from './llm.service';
import type { AiDescriptionInput } from '../validators/ai.schema';

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
  const { text } = await generateText(buildPrompt(input), { maxTokens: 2000 });
  return text;
}

export async function checkAiHealth(runTest: boolean) {
  const config = llmConfig();
  if (!config) {
    return { ok: false, reason: 'missing_api_key' };
  }

  if (!runTest) {
    return { ok: true, provider: config.provider, model: config.model, test: 'skipped' as const };
  }

  const { text } = await generateText('Responde solo con la palabra OK.', { maxTokens: 200 });
  const ok = text.toLowerCase().includes('ok');

  return { ok, provider: config.provider, model: config.model, test: 'ran' as const };
}

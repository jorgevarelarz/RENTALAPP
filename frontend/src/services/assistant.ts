import { api } from "../api/client";

export type AssistantAnswer = {
  answer: string;
  /** Versión de la LAU que se usó como contexto legal (si había) */
  lau?: { versionDate?: string; url?: string };
};

export async function queryAssistant(query: string): Promise<AssistantAnswer> {
  const { data } = await api.post("/api/assistant/query", { query });
  return data;
}

import { api } from "../api/client";

export async function queryAssistant(query: string): Promise<{ answer: string }> {
  const { data } = await api.post("/api/assistant/query", { query });
  return data;
}

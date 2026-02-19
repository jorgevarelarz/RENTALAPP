import { api } from "../api/client";

export type AiDescriptionInput = {
  title: string;
  city: string;
  rent: number;
  features: string[];
  tone?: "professional" | "friendly" | "premium";
  language?: "es" | "en";
  maxWords?: number;
};

export async function generateDescription(payload: AiDescriptionInput): Promise<{ description: string }> {
  const { data } = await api.post("/api/ai/description", payload);
  return data;
}

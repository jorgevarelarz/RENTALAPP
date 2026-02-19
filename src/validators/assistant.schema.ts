import { z } from 'zod';

export const assistantQuerySchema = z.object({
  query: z.string().trim().min(2).max(2000),
});

export type AssistantQueryInput = z.infer<typeof assistantQuerySchema>;

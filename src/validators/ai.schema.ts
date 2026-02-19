import { z } from 'zod';

export const aiDescriptionSchema = z.object({
  features: z
    .array(z.string().trim().min(2).max(120))
    .min(2)
    .max(20),
  language: z.enum(['es', 'en']).default('es'),
  tone: z.enum(['profesional', 'amigable', 'premium', 'neutro']).default('profesional'),
  maxWords: z.coerce.number().int().min(40).max(160).default(120),
});

export type AiDescriptionInput = z.infer<typeof aiDescriptionSchema>;

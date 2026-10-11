import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Límite compartido por /api/ai y /api/assistant: cada consulta llama a Gemini.
 * Va detrás de `authenticate`, así que se cuenta por usuario y no por IP.
 */
export function createAiRateLimiter(max = Number(process.env.AI_RATE_LIMIT_MAX) || 30) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?._id || (req as any).user?.id;
      return userId ? `user:${userId}` : `ip:${req.ip}`;
    },
    // El frontend muestra `error` tal cual, así que va en castellano.
    message: {
      error: 'Has hecho demasiadas consultas a la IA. Espera unos minutos y vuelve a intentarlo.',
      code: 'too_many_requests',
    },
  });
}

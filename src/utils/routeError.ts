import type { Response } from 'express';
import { logger } from './logger';
import { pathWithoutQuery } from '../metrics';

/**
 * Responde al error de una ruta sin filtrar mensajes internos.
 * Los 4xx lanzados a propósito (`Object.assign(new Error('forbidden'), { status: 403 })`)
 * conservan su mensaje; el resto (Mongo, Stripe, fallos inesperados) se registra
 * en el log y el cliente solo recibe `fallback`, un código fijo.
 */
export function sendRouteError(res: Response, err: any, fallback: string, context?: Record<string, unknown>) {
  const status = Number(err?.status);
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res.status(status).json({ error: err.message, code: status });
  }
  const code = Number.isInteger(status) && status >= 500 && status < 600 ? status : 500;
  const req = res.req;
  const url = req ? pathWithoutQuery(req.originalUrl || req.url) : undefined;
  logger.error({ method: req?.method, url, userId: (req as any)?.user?.id, ...context, err }, fallback);
  return res.status(code).json({ error: fallback, code });
}

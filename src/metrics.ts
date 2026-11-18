import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from './utils/logger';

type Labels = { method: string; status: number };

let httpRequestsTotal = 0;
const httpRequestsByLabel = new Map<string, number>();

/** Ruta sin la query: los logs no deben guardar códigos OAuth ni tokens. */
export function pathWithoutQuery(url: string | undefined) {
  return (url || '').split('?')[0];
}

function labelKey(l: Labels) {
  return `${l.method}_${l.status}`;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = (req.method || 'GET').toUpperCase();
  const started = Date.now();
  res.on('finish', () => {
    httpRequestsTotal += 1;
    const key = labelKey({ method, status: res.statusCode });
    httpRequestsByLabel.set(key, (httpRequestsByLabel.get(key) || 0) + 1);
    const rt = Date.now() - started;
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    // Log básico estructurado incluyendo requestId si existe
    const requestId = (res.locals as any)?.requestId;
    logger.info({
      type: 'http',
      requestId,
      method,
      url: pathWithoutQuery(req.originalUrl),
      status: res.statusCode,
      responseTimeMs: rt,
    });
  });
  next();
}

function hasMetricsToken(req: Request, expected: string) {
  const header = String(req.headers.authorization || '');
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return given.length > 0 && crypto.timingSafeEqual(a, b);
}

/**
 * Métricas Prometheus. Solo con `Authorization: Bearer <METRICS_TOKEN>`;
 * sin METRICS_TOKEN configurado la ruta no existe (404).
 */
export function metricsHandler(req: Request, res: Response) {
  const expected = process.env.METRICS_TOKEN || '';
  if (!expected) return res.status(404).json({ error: 'not_found' });
  if (!hasMetricsToken(req, expected)) return res.status(401).json({ error: 'unauthorized' });
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  let out = '';
  out += '# HELP http_requests_total Número total de peticiones HTTP\n';
  out += '# TYPE http_requests_total counter\n';
  out += `http_requests_total ${httpRequestsTotal}\n`;
  out += '# HELP http_requests_labeled_total Peticiones HTTP por método y estado\n';
  out += '# TYPE http_requests_labeled_total counter\n';
  for (const [key, value] of httpRequestsByLabel.entries()) {
    const [method, status] = key.split('_');
    out += `http_requests_labeled_total{method="${method}",status="${status}"} ${value}\n`;
  }
  res.end(out);
}


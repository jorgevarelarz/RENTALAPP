import { Request, Response, NextFunction } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import logger from './utils/logger';
import getRequestLogger from './utils/requestLogger';

const metricsRegistry: Registry = new Registry();

if (!(globalThis as any).__rentalMetricsInitialized) {
  collectDefaultMetrics({ register: metricsRegistry });
  (globalThis as any).__rentalMetricsInitialized = true;
}

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Número total de peticiones HTTP',
  labelNames: ['method', 'status'] as const,
  registers: [metricsRegistry],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de las peticiones HTTP en segundos',
  labelNames: ['method', 'status'] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = (req.method || 'GET').toUpperCase();
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const status = res.statusCode;
    httpRequestsTotal.inc({ method, status: String(status) });

    const diffNs = process.hrtime.bigint() - started;
    const durationSeconds = Number(diffNs) / 1e9;
    httpRequestDurationSeconds.observe({ method, status: String(status) }, durationSeconds);

    const requestLogger = getRequestLogger(req, res) ?? logger;
    const requestId = res.locals.requestId;
    requestLogger.info({
      type: 'http',
      requestId,
      method,
      url: req.originalUrl,
      status,
      responseTimeMs: durationSeconds * 1000,
    });
  });

  next();
}

export async function metricsHandler(_req: Request, res: Response) {
  res.setHeader('Content-Type', metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
}

import { Request, Response, NextFunction } from 'express';

type Labels = { method: string; status: number };

let httpRequestsTotal = 0;
const httpRequestsByLabel = new Map<string, number>();

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
    // Log básico estructurado incluyendo requestId si existe
    const requestId = (res.locals as any)?.requestId;
    console.log(
      JSON.stringify({
        type: 'http',
        requestId,
        method,
        url: req.originalUrl,
        status: res.statusCode,
        responseTimeMs: rt,
      }),
    );
  });
  next();
}

export function metricsHandler(_req: Request, res: Response) {
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


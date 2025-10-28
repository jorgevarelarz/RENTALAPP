import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';

/**
 * Asigna un ID de solicitud y lo expone en la respuesta como X-Request-Id
 * para facilitar la trazabilidad entre logs y clientes.
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers['x-request-id'] as string) || '';
  const id = incoming && incoming.length < 200 ? incoming : randomUUID();
  const child = logger.child({ requestId: id, method: req.method, url: req.originalUrl });
  (req as any).logger = child;
  res.locals.logger = child;
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

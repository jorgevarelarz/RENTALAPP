import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status || err.statusCode || 500;
  const requestId = (res.locals as any)?.requestId;
  res.status(status).json({
    code: status,
    message: err.message || 'Internal Server Error',
    details: err.details,
    requestId,
  });
}

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { isAppError } from '../utils/errors';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const appError = isAppError(err) ? err : undefined;
  const status = appError?.status || err.status || err.statusCode || 500;
  const log = res.locals.logger ?? logger;
  const requestId = res.locals.requestId;
  const code = appError?.code || err.code || status;
  log.error({ err, status, code, requestId }, 'Unhandled error caught by middleware');
  res.status(status).json({
    code,
    message: err.message || 'Internal Server Error',
    details: appError?.details ?? err.details,
    requestId,
  });
}

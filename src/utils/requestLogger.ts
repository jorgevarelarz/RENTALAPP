import { Request, Response } from 'express';
import logger from './logger';

export function getRequestLogger(req?: Request, res?: Response) {
  const maybeReqLogger = (req as any)?.logger;
  if (maybeReqLogger) return maybeReqLogger;
  if (res?.locals?.logger) return res.locals.logger;
  return logger;
}

export default getRequestLogger;

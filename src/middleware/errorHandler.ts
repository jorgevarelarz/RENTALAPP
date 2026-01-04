import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

interface AppError extends Error {
  status?: number;
  statusCode?: number;
  code?: number | string;
  details?: any;
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  const status = err.status || err.statusCode || 500;
  const requestId = (res.locals as any)?.requestId || req.headers['x-request-id'];

  // 1. Logging para el desarrollador (Server Side)
  // Solo loguear stack trace si es error 500 o error desconocido
  if (status >= 500) {
    console.error(`[Error] Request ${requestId} ${req.method} ${req.url}`);
    console.error('UserId:', req.user?.id || 'Guest');
    console.error(err);
  } else {
    // Para errores 4xx, un warning suele ser suficiente
    console.warn(`[Warn] ${requestId} ${status} - ${err.message}`);
  }

  // 2. Respuesta al Cliente (Client Side)
  // Manejo especial para Zod (Validación)
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'Datos de entrada inválidos',
      details: err.flatten(),
      requestId
    });
  }

  // Errores de Mongoose (Duplicados)
  if ((err as any).code === 11000) {
    return res.status(409).json({
      error: 'conflict',
      message: 'El registro ya existe (duplicado)',
      requestId
    });
  }

  // Respuesta Genérica
  res.status(status).json({
    error: status === 500 ? 'internal_server_error' : (err.name || 'error'),
    message: status === 500 ? 'Ha ocurrido un error interno.' : err.message,
    // Solo incluir detalles si NO es producción o si es un error de validación explícito
    details: process.env.NODE_ENV === 'production' && status === 500 ? undefined : err.details,
    requestId,
  });
}
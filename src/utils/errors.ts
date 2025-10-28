export interface AppErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = 'AppError';
    this.status = options.status ?? 500;
    this.code = options.code;
    this.details = options.details;
    if (options.cause) {
      (this as any).cause = options.cause;
    }
    Error.captureStackTrace?.(this, AppError);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function badRequest(message: string, details?: unknown) {
  return new AppError(message, { status: 400, code: 'bad_request', details });
}

export function unauthorized(message = 'Unauthorized') {
  return new AppError(message, { status: 401, code: 'unauthorized' });
}

export function forbidden(message = 'Forbidden') {
  return new AppError(message, { status: 403, code: 'forbidden' });
}

export function notFound(message = 'Not found') {
  return new AppError(message, { status: 404, code: 'not_found' });
}

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import type { ZodSchema } from 'zod';

type Middleware = (req: Request, res: Response, next: NextFunction) => void;

export function validate(schema: ZodSchema<any>): Middleware;
export function validate(req: Request, res: Response, next: NextFunction): void;
export function validate(
  arg1: ZodSchema<any> | Request,
  arg2?: Response,
  arg3?: NextFunction,
): Middleware | void {
  if (arg1 && typeof (arg1 as ZodSchema<any>).safeParse === 'function') {
    const schema = arg1 as ZodSchema<any>;
    return (req: Request, res: Response, next: NextFunction) => {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        res.status(400).json({ code: 400, message: 'validation_error', details: result.error.flatten() });
        return;
      }
      req.body = result.data;
      next();
    };
  }

  const req = arg1 as Request;
  const res = arg2 as Response;
  const next = arg3 as NextFunction;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ code: 400, message: 'validation_error', details: errors.array() });
    return;
  }
  next();
}

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to validate incoming contract creation payloads. Ensures that
 * required fields are present and of the correct type before handing off
 * to the controller.
 */
export const validateContract = (req: Request, res: Response, next: NextFunction) => {
  const { tenantId, propertyId, rent, deposit, startDate, endDate } = req.body;
  const errors: string[] = [];
  if (!tenantId) errors.push('tenantId es obligatorio');
  if (!propertyId) errors.push('propertyId es obligatorio');
  if (rent === undefined || rent === null || isNaN(Number(rent))) {
    errors.push('rent debe ser un número');
  }
  if (deposit === undefined || deposit === null || isNaN(Number(deposit))) {
    errors.push('deposit debe ser un número');
  }
  if (!startDate || isNaN(new Date(startDate).getTime())) {
    errors.push('startDate debe ser una fecha válida');
  }
  if (!endDate || isNaN(new Date(endDate).getTime())) {
    errors.push('endDate debe ser una fecha válida');
  }
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  next();
};
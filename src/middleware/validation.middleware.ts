import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { normalizeRegion, resolveClauses } from '../services/clauses.service';

/**
 * Middleware to validate incoming contract creation payloads. Ensures that
 * required fields are present and of the correct type before handing off
 * to the controller.
 */
export const validateContract = (req: Request, res: Response, next: NextFunction) => {
  const body = req.body || {};
  const rent = body.rent;
  const deposit = body.deposit;
  const startDate = body.startDate;
  const endDate = body.endDate;

  const usesClauseCatalog =
    body.region !== undefined ||
    Array.isArray(body.clauses) ||
    body.landlord !== undefined ||
    body.tenant !== undefined;

  const errors: string[] = [];

  if (usesClauseCatalog) {
    const landlordId = body.landlord ?? body.landlordId;
    const tenantId = body.tenant ?? body.tenantId;
    const propertyId = body.property ?? body.propertyId;
    const region = typeof body.region === 'string' ? body.region : undefined;

    if (!landlordId || !mongoose.Types.ObjectId.isValid(String(landlordId))) {
      errors.push('landlord debe ser un ObjectId válido');
    }
    if (!tenantId || !mongoose.Types.ObjectId.isValid(String(tenantId))) {
      errors.push('tenant debe ser un ObjectId válido');
    }
    if (!propertyId || !mongoose.Types.ObjectId.isValid(String(propertyId))) {
      errors.push('property debe ser un ObjectId válido');
    }
    if (!region) {
      errors.push('region es obligatoria');
    } else if (!normalizeRegion(region)) {
      errors.push(`region inválida: ${region}`);
    }
    if (!Array.isArray(body.clauses)) {
      errors.push('clauses debe ser un array');
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    try {
      const resolvedClauses = resolveClauses(region!, body.clauses as any[]);
      req.resolvedClauses = resolvedClauses;
      req.body.region = normalizeRegion(region!);
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Cláusulas inválidas' });
    }
  } else {
    const tenantId = body.tenantId;
    const propertyId = body.propertyId;
    if (!tenantId) errors.push('tenantId es obligatorio');
    if (!propertyId) errors.push('propertyId es obligatorio');
  }

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

  if (startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
      errors.push('endDate debe ser posterior a startDate');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
};

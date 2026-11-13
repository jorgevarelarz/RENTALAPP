import { Request, Response, NextFunction } from 'express';

const MAX_DEPTH = 20;

// Devuelve la primera clave que empieza por "$" (operador de Mongo) dentro de un valor
// de query o de cuerpo JSON. ?status[$ne]=x o {"email":{"$gt":""}} llegan como objetos
// y, si un controlador los pasa a un filtro, cambian la consulta.
export function findOperatorKey(value: unknown, depth = 0): string | null {
  if (!value || typeof value !== 'object' || depth > MAX_DEPTH) return null;
  if (Buffer.isBuffer(value)) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findOperatorKey(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const key of Object.keys(value)) {
    if (key.startsWith('$')) return key;
    const found = findOperatorKey((value as Record<string, unknown>)[key], depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * Rechaza con 400 las peticiones cuya query o cuerpo traen claves de operador de Mongo.
 * Los filtros ya se construyen acotados al usuario; esto cierra la puerta en todas las rutas
 * a la vez, también en las que se escriban después.
 */
export function rejectMongoOperators(req: Request, res: Response, next: NextFunction) {
  const key = findOperatorKey(req.query) || findOperatorKey(req.body);
  if (key) return res.status(400).json({ error: 'invalid_input', message: 'La petición contiene campos no permitidos.' });
  next();
}

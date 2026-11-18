import { Request, Response } from 'express';
import { generatePropertyDescription, checkAiHealth } from '../services/ai.service';

export async function generateDescription(req: Request, res: Response) {
  const description = await generatePropertyDescription(req.body);
  res.status(200).json({ description });
}

export async function health(req: Request, res: Response) {
  const runTest = String(req.query.test || '').toLowerCase() === 'true';
  // La prueba real llama al modelo (y cuesta dinero): solo para administradores.
  if (runTest && req.user?.role !== 'admin') {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  const result = await checkAiHealth(runTest);
  res.status(result.ok ? 200 : 500).json(result);
}

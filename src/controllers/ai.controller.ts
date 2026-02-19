import { Request, Response } from 'express';
import { generatePropertyDescription, checkAiHealth } from '../services/ai.service';

export async function generateDescription(req: Request, res: Response) {
  const description = await generatePropertyDescription(req.body);
  res.status(200).json({ description });
}

export async function health(req: Request, res: Response) {
  const runTest = String(req.query.test || '').toLowerCase() === 'true';
  const result = await checkAiHealth(runTest);
  res.status(result.ok ? 200 : 500).json(result);
}

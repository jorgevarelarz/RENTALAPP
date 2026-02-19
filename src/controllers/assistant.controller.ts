import { Request, Response } from 'express';
import { buildPlatformContext, answerWithClara } from '../services/assistant.service';

export async function queryAssistant(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { query } = req.body as { query: string };
  const platformContext = await buildPlatformContext(userId);
  const result = await answerWithClara(query, platformContext);

  return res.status(200).json(result);
}

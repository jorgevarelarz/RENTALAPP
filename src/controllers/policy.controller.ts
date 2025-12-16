// src/controllers/policy.controller.ts
import { Request, Response } from 'express';
import { PolicyService } from '../services/policy.service';

export class PolicyController {
  static async accept(req: Request, res: Response) {
    try {
      const userId = req.user?._id; // asumimos que identity middleware añade req.user
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { policyType, policyVersion } = req.body;
      if (!policyType || !policyVersion)
        return res.status(400).json({ error: 'Missing fields' });

      const acceptance = await PolicyService.acceptPolicy(
        userId,
        policyType,
        policyVersion
      );

      res.status(201).json({ success: true, data: acceptance });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const userId = req.user?._id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const acceptances = await PolicyService.getUserAcceptances(userId);
      res.json({ success: true, data: acceptances });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

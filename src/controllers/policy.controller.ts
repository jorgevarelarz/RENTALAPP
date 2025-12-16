// src/controllers/policy.controller.ts
import { Request, Response } from 'express';
import { PolicyService } from '../services/policy.service';

export class PolicyController {
  static async createVersion(req: Request, res: Response) {
    try {
      const { policyType, version, expiresAt } = req.body;
      if (!policyType || !version) {
        return res.status(400).json({ error: 'Missing fields' });
      }
      const policy = await PolicyService.createVersion(
        policyType,
        version,
        expiresAt ? new Date(expiresAt) : null
      );
      res.status(201).json({ success: true, data: policy });
    } catch (error: any) {
      const code = error.code === 11000 ? 409 : 400;
      res.status(code).json({ success: false, error: error.message });
    }
  }

  static async getActive(req: Request, res: Response) {
    try {
      const policies = await PolicyService.getActiveVersions();
      res.json({ success: true, data: policies });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

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
        policyVersion,
        {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      res.status(201).json({ success: true, data: acceptance });
    } catch (error: any) {
      if (error.code === 'POLICY_INACTIVE') {
        return res.status(409).json({ success: false, error: error.message });
      }
      if (error.message?.includes('already accepted')) {
        return res.status(400).json({ success: false, error: error.message });
      }
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

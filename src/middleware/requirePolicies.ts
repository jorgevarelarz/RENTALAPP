import { Request, Response, NextFunction } from 'express';
import { PolicyVersion, PolicyType } from '../models/policy.model';
import { UserPolicyAcceptance } from '../models/userPolicyAcceptance.model';

/**
 * Middleware que exige que el usuario haya aceptado las versiones activas de las políticas indicadas.
 * Responde 409 con la lista de políticas faltantes.
 */
export const requirePolicies = (types: PolicyType[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?._id || (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const now = new Date();
      const activePolicies = await PolicyVersion.find({
        policyType: { $in: types },
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      }).lean();

      if (activePolicies.length === 0) return next();

      const acceptances = await UserPolicyAcceptance.find({
        userId,
        policyType: { $in: types },
      }).lean();

      const missing: PolicyType[] = [];

      for (const policy of activePolicies) {
        const accepted = acceptances.find(
          a => a.policyType === policy.policyType && a.policyVersion === policy.version
        );
        if (!accepted) missing.push(policy.policyType);
      }

      if (missing.length > 0) {
        return res.status(409).json({
          error: 'missing_policy_acceptance',
          missingPolicies: missing,
        });
      }

      next();
    } catch (error) {
      console.error('requirePolicies error', error);
      res.status(500).json({ error: 'internal_error' });
    }
  };
};

export default requirePolicies;

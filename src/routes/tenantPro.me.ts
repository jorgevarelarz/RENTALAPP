import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/user.model';
import { deleteTP } from '../services/tenantProStorage';

const router = Router();

router.get(
  '/me/tenant-pro',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = (await User.findById((req as any).user?.id || (req as any).user?._id)
      .select('tenantPro email')
      .lean()) as any;
    if (!user) return res.sendStatus(404);
    res.json({ tenantPro: user.tenantPro });
  }),
);

router.post(
  '/me/tenant-pro/delete',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = (await User.findById((req as any).user?.id || (req as any).user?._id)) as any;
    if (!user) return res.sendStatus(404);

    for (const doc of user.tenantPro?.docs || []) {
      if (doc?.url) deleteTP(doc.url as any);
    }

    user.tenantPro = {
      isActive: false,
      maxRent: 0,
      status: 'none',
      docs: [],
      auditTrail: [],
      consentAccepted: false,
      consentTextVersion: undefined,
      consentAcceptedAt: undefined,
      lastDecisionAt: undefined,
    } as any;

    await user.save();
    res.json({ ok: true });
  }),
);

export default router;

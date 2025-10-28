import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler';
import { User } from '../models/user.model';
import { deleteTP } from '../utils/tenantProStorage';
import { assertRole } from '../middleware/assertRole';

const router = Router();

const infoPaths = ['/me/tenant-pro', '/tenant-pro/me'];
const deletePaths = ['/me/tenant-pro/delete', '/tenant-pro/me/delete'];

router.get(
  infoPaths,
  ...assertRole('tenant'),
  asyncHandler(async (req, res) => {
    const user = (await User.findById((req as any).user?.id || (req as any).user?._id)
      .select('tenantPro email')
      .lean()) as any;
    if (!user) return res.sendStatus(404);
    res.json({ tenantPro: user.tenantPro });
  }),
);

router.post(
  deletePaths,
  ...assertRole('tenant'),
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

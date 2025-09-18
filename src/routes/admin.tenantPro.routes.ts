import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/user.model';
import { deleteTP } from '../services/tenantProStorage';

const router = Router();

router.get(
  '/tenant-pro/pending',
  authenticate,
  authorizeRoles('admin'),
  asyncHandler(async (_req, res) => {
    const users = await User.find({ 'tenantPro.status': 'pending' }).select('email tenantPro');
    res.json(users);
  }),
);

router.post(
  '/tenant-pro/:userId/decision',
  authenticate,
  authorizeRoles('admin'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { decision, maxRent } = req.body as { decision: 'approved' | 'rejected'; maxRent?: number };
    const user = (await User.findById(userId)) as any;
    if (!user) return res.sendStatus(404);

    const reviewerId = (req as any).user?.id || (req as any).user?._id;
    const now = new Date();

    if (decision === 'approved') {
      user.tenantPro.status = 'verified';
      user.tenantPro.isActive = true;
      user.tenantPro.maxRent = Number(maxRent || 0);
      user.tenantPro.docs.forEach((doc: any) => {
        if (doc.status === 'pending') doc.status = 'approved';
        doc.reviewedAt = now;
        (doc as any).reviewer = reviewerId;
      });
    } else {
      user.tenantPro.status = 'rejected';
      user.tenantPro.isActive = false;
      user.tenantPro.maxRent = 0;
      user.tenantPro.docs.forEach((doc: any) => {
        if (doc.status === 'pending') doc.status = 'rejected';
        doc.reviewedAt = now;
        (doc as any).reviewer = reviewerId;
      });
    }
    user.tenantPro.lastDecisionAt = now;
    await user.save();
    res.json({ ok: true });
  }),
);

router.post(
  '/tenant-pro/:userId/purge',
  authenticate,
  authorizeRoles('admin'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const user = (await User.findById(userId)) as any;
    if (!user) return res.sendStatus(404);
    for (const doc of user.tenantPro.docs || []) {
      deleteTP(doc.url as any);
    }
    user.tenantPro = {
      isActive: false,
      maxRent: 0,
      status: 'none',
      docs: [],
      consentAccepted: false,
    } as any;
    await user.save();
    res.json({ ok: true });
  }),
);

export default router;

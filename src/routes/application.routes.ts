import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import asyncHandler from '../utils/asyncHandler';
import * as applicationCtrl from '../controllers/application.controller';

const router = Router();

router.get('/', authenticate as any, authorizeRoles('tenant', 'admin'), asyncHandler(applicationCtrl.listMine));
router.get('/owner', authenticate as any, authorizeRoles('landlord', 'admin'), asyncHandler(applicationCtrl.listForOwner));
router.post('/:id/decision', authenticate as any, authorizeRoles('landlord', 'admin'), asyncHandler(applicationCtrl.decide));
router.post('/:id/toggle-pro', authenticate as any, authorizeRoles('landlord', 'admin'), asyncHandler(applicationCtrl.toggleTenantPro));
router.post('/:id/message', authenticate as any, authorizeRoles('landlord', 'admin'), asyncHandler(applicationCtrl.sendMessage));

export default router;

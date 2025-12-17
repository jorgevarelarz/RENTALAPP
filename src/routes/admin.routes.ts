import { Router } from 'express';
import { getStats, listPolicyAcceptances } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

// Only administrators can access the dashboard statistics
router.get('/stats', authenticate, authorizeRoles('admin'), getStats);
router.get('/policies/acceptances', authenticate, authorizeRoles('admin'), listPolicyAcceptances);

export default router;

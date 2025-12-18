import { Router } from 'express';
import { getStats, listAuditTrails, listPolicyAcceptances, streamAuditTrails } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

// Only administrators can access the dashboard statistics
router.get('/stats', authenticate, authorizeRoles('admin'), getStats);
router.get('/policies/acceptances', authenticate, authorizeRoles('admin'), listPolicyAcceptances);
router.get('/compliance/audit-trails', authenticate, authorizeRoles('admin'), listAuditTrails);
router.get('/compliance/audit-trails/stream', streamAuditTrails);

export default router;

import { Router } from 'express';
import { exportAuditTrails, getStats, listAuditTrails, listPolicyAcceptances, listWeeklyStats, streamAuditTrails, listAdminRequests, decideAdminRequest } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

// Only administrators can access the dashboard statistics
router.get('/stats', authenticate, authorizeRoles('admin'), getStats);
router.get('/policies/acceptances', authenticate, authorizeRoles('admin'), listPolicyAcceptances);
router.get('/compliance/audit-trails', authenticate, authorizeRoles('admin'), listAuditTrails);
router.get('/compliance/audit-trails/export', authenticate, authorizeRoles('admin'), exportAuditTrails);
router.get('/compliance/audit-trails/stream', streamAuditTrails);
router.get('/compliance/stats/weekly', authenticate, authorizeRoles('admin'), listWeeklyStats);
router.get('/requests', authenticate, authorizeRoles('admin'), listAdminRequests);
router.post('/requests/:id/decision', authenticate, authorizeRoles('admin'), decideAdminRequest);

export default router;

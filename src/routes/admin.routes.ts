import { Router } from 'express';
import { exportAuditTrails, getStats, listAuditTrails, listPolicyAcceptances, listWeeklyStats, streamAuditTrails, listAdminRequests, decideAdminRequest, upsertAdminTensionedArea, listTensionedAreas, getComplianceDashboard, exportComplianceDashboardCsv, listSystemEventsAdmin, exportSystemEventsCsv } from '../controllers/admin.controller';
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
router.get('/compliance/dashboard', authenticate, authorizeRoles('admin'), getComplianceDashboard);
router.get('/compliance/dashboard/export.csv', authenticate, authorizeRoles('admin'), exportComplianceDashboardCsv);
router.get('/system-events', authenticate, authorizeRoles('admin'), listSystemEventsAdmin);
router.get('/system-events/export.csv', authenticate, authorizeRoles('admin'), exportSystemEventsCsv);
router.get('/compliance/tensioned-areas', authenticate, authorizeRoles('admin'), listTensionedAreas);
router.post('/compliance/tensioned-areas', authenticate, authorizeRoles('admin'), upsertAdminTensionedArea);
router.get('/requests', authenticate, authorizeRoles('admin'), listAdminRequests);
router.post('/requests/:id/decision', authenticate, authorizeRoles('admin'), decideAdminRequest);

export default router;

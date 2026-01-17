import { Router } from 'express';
import { getTaxReport, exportTaxReportCsv, exportTaxReportPdf } from '../controllers/taxReport.controller';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

router.get('/tax/report', authorizeRoles('landlord', 'pro'), getTaxReport);
router.get('/tax/report/export.csv', authorizeRoles('landlord', 'pro'), exportTaxReportCsv);
router.get('/tax/report/export.pdf', authorizeRoles('landlord', 'pro'), exportTaxReportPdf);

export default router;

import { Router } from 'express';
import { getTaxReport, exportTaxReportCsv, exportTaxReportPdf } from '../controllers/taxReport.controller';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

router.get('/report', authorizeRoles('landlord', 'pro'), getTaxReport);
router.get('/report/export.csv', authorizeRoles('landlord', 'pro'), exportTaxReportCsv);
router.get('/report/export.pdf', authorizeRoles('landlord', 'pro'), exportTaxReportPdf);

export default router;

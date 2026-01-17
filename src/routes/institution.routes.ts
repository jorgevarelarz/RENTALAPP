import { Router } from 'express';
import { exportInstitutionComplianceDashboardCsv, getInstitutionComplianceDashboard } from '../controllers/institution.controller';

const router = Router();

router.get('/compliance/dashboard', getInstitutionComplianceDashboard);
router.get('/compliance/dashboard/export.csv', exportInstitutionComplianceDashboardCsv);

export default router;

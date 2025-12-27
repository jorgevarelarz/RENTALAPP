import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { listMyApplications, proposeVisit, acceptProposedVisit } from '../controllers/application.controller';

const r = Router();

// Tenant: list my applications
r.get('/applications/my', authenticate, authorizeRoles('tenant'), asyncHandler(listMyApplications));

// Landlord/admin: schedule a visit for an application
r.post('/applications/:id/propose', authenticate, authorizeRoles('tenant', 'landlord', 'admin'), asyncHandler(proposeVisit));
r.post('/applications/:id/accept', authenticate, authorizeRoles('tenant', 'landlord', 'admin'), asyncHandler(acceptProposedVisit));

export default r;

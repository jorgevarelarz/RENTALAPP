import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { listMyApplications, proposeVisit, acceptProposedVisit } from '../controllers/application.controller';

const r = Router();

// Tenant: list my applications
r.get('/applications/my', authenticate, authorizeRoles('tenant'), asyncHandler(listMyApplications));

// Propietario, agencia gestora o admin proponen la visita; el inquilino puede contraproponer
r.post('/applications/:id/propose', authenticate, authorizeRoles('tenant', 'landlord', 'agency', 'admin'), asyncHandler(proposeVisit));
r.post('/applications/:id/accept', authenticate, authorizeRoles('tenant', 'landlord', 'agency', 'admin'), asyncHandler(acceptProposedVisit));

export default r;

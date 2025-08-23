import { Router } from 'express';
import { createProperty, getAllProperties } from '../controllers/property.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { requireVerified } from '../middleware/requireVerified';

const router = Router();
// Only landlords can create properties (requires verification)
router.post('/', authenticate, requireVerified, authorizeRoles('landlord'), createProperty);
// Both landlords and tenants can view properties
router.get('/', getAllProperties);
export default router;
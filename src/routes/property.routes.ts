import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { assertRole } from '../middleware/assertRole';
import { validate } from '../middleware/validate';
import * as ctrl from '../controllers/property.controller';
import { propertyCreateSchema, propertyUpdateSchema } from '../validators/property.schema';
import { asyncHandler } from '../utils/asyncHandler';
import { requireVerified } from '../middleware/requireVerified';

const r = Router();

r.post('/properties', ...assertRole('landlord', 'admin'), validate(propertyCreateSchema), asyncHandler(ctrl.create));
r.put('/properties/:id', ...assertRole('landlord', 'admin'), validate(propertyUpdateSchema), asyncHandler(ctrl.update));
r.post('/properties/:id/publish', ...assertRole('landlord', 'admin'), asyncHandler(ctrl.publish));
r.post('/properties/:id/archive', ...assertRole('landlord', 'admin'), asyncHandler(ctrl.archive));

r.post(
  '/properties/:id/favorite',
  authenticate,
  authorizeRoles('tenant', 'landlord', 'admin'),
  asyncHandler(ctrl.favorite),
);
r.delete(
  '/properties/:id/favorite',
  authenticate,
  authorizeRoles('tenant', 'landlord', 'admin'),
  asyncHandler(ctrl.unfavorite),
);
r.get(
  '/properties/favorites',
  authenticate,
  authorizeRoles('tenant', 'landlord', 'admin'),
  asyncHandler(ctrl.listMyFavorites),
);

r.get('/properties/:id', asyncHandler(ctrl.getById));
r.get('/properties', asyncHandler(ctrl.search));

r.post('/properties/:id/apply', ...assertRole('tenant', 'admin'), asyncHandler(ctrl.apply));
r.get('/properties/:id/applications', authenticate, authorizeRoles('landlord', 'admin'), asyncHandler(ctrl.listApplications));

r.post('/properties/:id/subscribe-price', authenticate, asyncHandler(ctrl.subscribePriceAlert));
r.delete('/properties/:id/subscribe-price', authenticate, asyncHandler(ctrl.unsubscribePriceAlert));

r.post('/properties/:id/view', asyncHandler(ctrl.countView));

export default r;

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

r.post('/properties', ...assertRole('landlord', 'admin', 'agency'), validate(propertyCreateSchema), asyncHandler(ctrl.create));
r.put('/properties/:id', ...assertRole('landlord', 'admin', 'agency'), validate(propertyUpdateSchema), asyncHandler(ctrl.update));
r.post('/properties/:id/publish', ...assertRole('landlord', 'admin', 'agency'), asyncHandler(ctrl.publish));
r.post('/properties/:id/archive', ...assertRole('landlord', 'admin', 'agency'), asyncHandler(ctrl.archive));
r.post('/properties/:id/handoff', ...assertRole('agency', 'admin'), asyncHandler(ctrl.handoffToOwner));

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

/**
 * @openapi
 * /api/properties:
 *   get:
 *     tags: [Properties]
 *     summary: Buscar propiedades disponibles
 *     security: []
 *     parameters:
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de propiedades
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:  { type: array, items: { $ref: '#/components/schemas/Property' } }
 *                 total: { type: integer }
 *                 page:  { type: integer }
 */
r.get('/properties', asyncHandler(ctrl.search));

/**
 * @openapi
 * /api/properties/{id}:
 *   get:
 *     tags: [Properties]
 *     summary: Obtener propiedad por ID
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Propiedad encontrada, content: { application/json: { schema: { $ref: '#/components/schemas/Property' } } } }
 *       404: { description: Propiedad no encontrada }
 */
r.get('/properties/:id', asyncHandler(ctrl.getById));

r.post('/properties/:id/apply', ...assertRole('tenant', 'admin'), asyncHandler(ctrl.apply));
r.get('/properties/:id/applications', authenticate, authorizeRoles('landlord', 'admin'), asyncHandler(ctrl.listApplications));

r.post('/properties/:id/subscribe-price', authenticate, asyncHandler(ctrl.subscribePriceAlert));
r.delete('/properties/:id/subscribe-price', authenticate, asyncHandler(ctrl.unsubscribePriceAlert));

r.post('/properties/:id/view', asyncHandler(ctrl.countView));

export default r;

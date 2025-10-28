import { Router } from 'express';
import { body } from 'express-validator';
import { createColiving, getAllColivings, getColivingById } from '../controllers/coliving.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import asyncHandler from '../utils/asyncHandler';

const router = Router();

// Create a new coliving space
router.post(
  '/',
  authenticate,
  [
    body('title').isString().notEmpty(),
    body('monthlyRent').isNumeric().custom((v) => v > 0),
    body('address').isString().notEmpty(),
    body('roomType').isIn(['private', 'shared']),
    body('description').optional().isString(),
    body('photos').optional().isArray(),
    body('amenities').optional().isArray(),
    body('deposit').optional().isNumeric(),
    body('houseRules').optional().isString(),
  ],
  validate,
  asyncHandler(createColiving)
);

// Public routes to get coliving spaces
router.get('/', asyncHandler(getAllColivings));
router.get('/:id', asyncHandler(getColivingById));

export default router;

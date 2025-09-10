import { Router } from 'express';
import { body } from 'express-validator';
import { createProperty, getAllProperties, getPropertyById } from '../controllers/property.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Create property (published by default)
router.post(
  '/',
  authenticate,
  [
    body('title').isString().notEmpty(),
    body('price').isNumeric().custom((v) => v > 0),
    body('address').isString().notEmpty(),
    body('description').optional().isString(),
    body('photos').optional().isArray(),
  ],
  validate,
  asyncHandler(createProperty)
);

// Public listings
router.get('/', asyncHandler(getAllProperties));
router.get('/:id', asyncHandler(getPropertyById));

export default router;

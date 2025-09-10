import { Router } from 'express';
import { createProperty, getAllProperties, getPropertyById } from '../controllers/property.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
// Create property (published by default)
router.post('/', authenticate, createProperty);
// Public listings
router.get('/', getAllProperties);
router.get('/:id', getPropertyById);
export default router;
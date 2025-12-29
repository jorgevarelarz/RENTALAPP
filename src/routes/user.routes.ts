import { Router } from 'express';
import { getAllUsers, updateUser, getLandlordStats } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// List all users (requires authentication)
router.get('/', authenticate, getAllUsers);

// Landlord dashboard stats
router.get('/me/stats', authenticate, getLandlordStats);

// Update a user by id (requires authentication)
router.patch('/:id', authenticate, updateUser);

export default router;

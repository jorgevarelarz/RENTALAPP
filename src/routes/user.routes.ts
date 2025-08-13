import { Router } from 'express';
import { getAllUsers, updateUser } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// List all users (requires authentication)
router.get('/', authenticate, getAllUsers);

// Update a user by id (requires authentication)
router.patch('/:id', authenticate, updateUser);

export default router;
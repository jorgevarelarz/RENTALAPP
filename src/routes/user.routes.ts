import { Router } from 'express';
import { getAllUsers, updateUser } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

// List all users (admin only)
router.get('/', authenticate, authorizeRoles('admin'), getAllUsers);

// Update a user by id (self or admin)
router.patch('/:id', authenticate, updateUser);

export default router;

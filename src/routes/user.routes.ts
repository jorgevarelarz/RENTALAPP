import { Router } from 'express';
import { getAllUsers, updateUser, getLandlordStats, getMe, updateProfile } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

// List all users (admin only)
router.get('/', authenticate, authorizeRoles('admin'), getAllUsers);

router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateProfile);

// Landlord dashboard stats
router.get('/me/stats', authenticate, getLandlordStats);

// Update a user by id (requires authentication)
router.patch('/:id', authenticate, updateUser);

export default router;

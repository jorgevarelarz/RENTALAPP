import { Router } from 'express';
import { createUser, getAllUsers, exportUsersCsv, updateUser, getLandlordStats, getMe, updateProfile } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Usuarios (solo admin). asyncHandler: un fallo de Mongo daba una promesa rechazada sin respuesta
router.get('/', authenticate, authorizeRoles('admin'), asyncHandler(getAllUsers));
router.get('/export.csv', authenticate, authorizeRoles('admin'), asyncHandler(exportUsersCsv));
router.post('/', authenticate, authorizeRoles('admin'), asyncHandler(createUser));

router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateProfile);

// Landlord dashboard stats
router.get('/me/stats', authenticate, getLandlordStats);

// Update a user by id (requires authentication)
router.patch('/:id', authenticate, updateUser);

export default router;

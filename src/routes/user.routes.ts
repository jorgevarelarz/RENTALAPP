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

// Landlord dashboard stats
router.get('/me/stats', authenticate, getLandlordStats);

// Update a user by id (requires authentication)
router.patch('/:id', authenticate, updateUser);

// Perfil propio: se monta en /api/users/me sin requireVerified (app.ts). /me/stats sigue en el
// router de arriba, con la identidad verificada.
export const userProfileRoutes = Router();
userProfileRoutes.get('/', getMe);
userProfileRoutes.put('/', updateProfile);

export default router;

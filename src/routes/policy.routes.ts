// src/routes/policy.routes.ts
import { Router } from 'express';
import { PolicyController } from '../controllers/policy.controller';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';

const router = Router();

router.get('/active', requireAuth, PolicyController.getActive);
// Publicar una versión nueva desactiva las anteriores: solo admin
router.post('/version', requireAuth, requireAdmin, PolicyController.createVersion);
router.post('/accept', requireAuth, PolicyController.accept);
router.get('/', requireAuth, PolicyController.list);

export default router;

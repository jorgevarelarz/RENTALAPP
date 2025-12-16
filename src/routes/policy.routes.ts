// src/routes/policy.routes.ts
import { Router } from 'express';
import { PolicyController } from '../controllers/policy.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/active', requireAuth, PolicyController.getActive);
router.post('/version', requireAuth, PolicyController.createVersion);
router.post('/accept', requireAuth, PolicyController.accept);
router.get('/', requireAuth, PolicyController.list);

export default router;

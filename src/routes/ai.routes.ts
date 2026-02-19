import { Router } from 'express';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { aiDescriptionSchema } from '../validators/ai.schema';
import * as ctrl from '../controllers/ai.controller';

const r = Router();

r.get('/health', asyncHandler(ctrl.health));
r.post('/description', validate(aiDescriptionSchema), asyncHandler(ctrl.generateDescription));

export default r;

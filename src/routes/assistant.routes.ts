import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middleware/validate';
import { assistantQuerySchema } from '../validators/assistant.schema';
import * as ctrl from '../controllers/assistant.controller';

const r = Router();

r.post('/query', validate(assistantQuerySchema), asyncHandler(ctrl.queryAssistant));

export default r;

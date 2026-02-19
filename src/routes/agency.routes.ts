import { Router } from 'express';
import { listAgencyProperties } from '../controllers/agency.controller';

const r = Router();

// Summary endpoint: safe after handoff (status_only). No contract details exposed here.
r.get('/properties', listAgencyProperties);

export default r;


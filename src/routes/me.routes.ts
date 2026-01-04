import { Router } from 'express';
import { getMyInvites } from '../controllers/contract.controller';

const r = Router();

r.get('/invites', getMyInvites);

export default r;

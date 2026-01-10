import { Router } from 'express';
import { getMyInvites } from '../controllers/contract.controller';
import { listMyFavorites } from '../controllers/property.controller';

const r = Router();

r.get('/invites', getMyInvites);
r.get('/favorites', listMyFavorites);

export default r;

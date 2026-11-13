import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { listAgencyProperties } from '../controllers/agency.controller';
import { createLandlordInvite, listLandlordInvites, resendLandlordInvite } from '../controllers/agencyInvite.controller';
import {
  getAgencyEarningsSummary,
  listAgencyEarnings,
  getAgencyInvoicePdf,
} from '../controllers/agencyEarnings.controller';

const r = Router();

// Summary endpoint: safe after handoff (status_only). No contract details exposed here.
r.get('/properties', listAgencyProperties);

// Alta de propietarios (captación) y funnel de estados.
// asyncHandler: con Express 4 un error en un handler async dejaba la petición colgada.
r.post('/landlords/invite', asyncHandler(createLandlordInvite));
r.get('/landlords', asyncHandler(listLandlordInvites));
r.post('/landlords/invites/:id/resend', asyncHandler(resendLandlordInvite));

// Comisiones de la agencia: resumen con tramos, movimientos y autofactura.
r.get('/earnings/summary', getAgencyEarningsSummary);
r.get('/earnings/invoice', getAgencyInvoicePdf);
r.get('/earnings', listAgencyEarnings);

export default r;

import { Router } from 'express';
import { listAgencyProperties } from '../controllers/agency.controller';
import { createLandlordInvite, listLandlordInvites } from '../controllers/agencyInvite.controller';
import {
  getAgencyEarningsSummary,
  listAgencyEarnings,
  getAgencyInvoicePdf,
} from '../controllers/agencyEarnings.controller';

const r = Router();

// Summary endpoint: safe after handoff (status_only). No contract details exposed here.
r.get('/properties', listAgencyProperties);

// Alta de propietarios (captación) y funnel de estados.
r.post('/landlords/invite', createLandlordInvite);
r.get('/landlords', listLandlordInvites);

// Comisiones de la agencia: resumen con tramos, movimientos y autofactura.
r.get('/earnings/summary', getAgencyEarningsSummary);
r.get('/earnings/invoice', getAgencyInvoicePdf);
r.get('/earnings', listAgencyEarnings);

export default r;

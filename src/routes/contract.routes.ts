import { Router } from 'express';
import * as contractController from '../controllers/contract.controller';
import * as lifeCtrl from '../controllers/contract.lifecycle.controller';
import * as signCtrl from '../controllers/contract.signature.controller';
import * as termCtrl from '../controllers/contract.terminate.controller';
import { authenticate } from '../middleware/auth.middleware';
import { Contract } from '../models/contract.model';
import { assertRole } from '../middleware/assertRole';
import asyncHandler from '../utils/asyncHandler';
import { AppError, notFound } from '../utils/errors';

const router = Router();

// List contracts
router.get('/', authenticate, contractController.listContracts);

// Crear contrato
router.post('/', ...assertRole('landlord', 'admin'), asyncHandler(contractController.create));

// Descargar contrato en PDF
router.get('/:id/pdf', authenticate, asyncHandler(contractController.getContractPDF));

// Obtener historial de cambios de un contrato
router.get('/:id/history', authenticate, asyncHandler(contractController.getContractHistory));

// Firmar contrato
router.patch('/:id/sign', authenticate, asyncHandler(contractController.signContract));

// Iniciar pago por SEPA con Stripe
router.post('/:id/pay', ...assertRole('tenant'), asyncHandler(contractController.initiatePayment));

// Iniciar firma electrónica de contrato
router.post('/:id/signature', ...assertRole('landlord', 'admin'), asyncHandler(contractController.requestSignature));

// Activar contrato
router.post('/:id/activate', authenticate, lifeCtrl.activate);

// Enviar recordatorio de pago de renta
router.post('/:id/remind', authenticate, asyncHandler(contractController.sendRentReminder));

// Enviar notificación de renovación
router.post('/:id/renew', authenticate, asyncHandler(contractController.sendRenewalNotification));

// Terminar contrato
router.post('/:id/terminate', authenticate, termCtrl.terminate);

// Pagar fianza
router.post('/:id/deposit', ...assertRole('tenant'), asyncHandler(contractController.payDeposit));

// Obtener contrato con reputación
router.get('/:id', authenticate, asyncHandler(contractController.getContract));

// PDF firmado (DocuSign) con control de acceso
router.get(
  '/:id/pdf/signed',
  authenticate,
  asyncHandler(async (req, res) => {
    const c = await Contract.findById(req.params.id).lean();
    if (!c) throw notFound('not_found');
    const u: any = (req as any).user;
    const isParty = u?.role === 'admin' || String(c.landlord) === u?.id || String(c.tenant) === u?.id;
    if (!isParty) throw new AppError('forbidden', { status: 403, code: 'forbidden' });
    const fs = require('fs');
    const path = require('path');
    const dir = path.resolve(process.cwd(), 'storage/contracts-signed');
    const envelopeId = c?.signature?.envelopeId;
    const fileName = envelopeId ? `${String(c._id)}-${envelopeId}.pdf` : null;
    if (!fileName) throw notFound('no_signed_pdf');
    const abs = path.join(dir, fileName);
    if (!fs.existsSync(abs)) throw notFound('no_signed_pdf');
    res.setHeader('Content-Type', 'application/pdf');
    fs.createReadStream(abs).pipe(res);
  }),
);

// Alias
router.get('/:id/signed.pdf', (_req, res) => {
  const id = _req.params.id;
  res.redirect(302, `/api/contracts/${id}/pdf/signed`);
});

// Rutas públicas que no requieren verificación previa (ej. webhooks de firma)
export const contractPublicRoutes = Router();
contractPublicRoutes.post('/:id/signature/callback', signCtrl.signatureCallback);

export default router;

import { Router } from 'express';
import * as contractController from '../controllers/contract.controller';
import * as lifeCtrl from '../controllers/contract.lifecycle.controller';
import * as signCtrl from '../controllers/contract.signature.controller';
import * as termCtrl from '../controllers/contract.terminate.controller';
import { authenticate } from '../middleware/auth.middleware';
import { Contract } from '../models/contract.model';
import { assertRole } from '../middleware/assertRole';
import { requirePolicies } from '../middleware/requirePolicies';
import type { PolicyType } from '../models/policy.model';

const router = Router();
const REQUIRED_POLICIES: PolicyType[] = ['terms_of_service', 'data_processing'];

// List contracts
router.get('/', authenticate, contractController.listContracts);

// Crear contrato
router.post(
  '/',
  ...assertRole('landlord', 'admin'),
  requirePolicies(REQUIRED_POLICIES),
  contractController.create
);

// Descargar contrato en PDF
router.get('/:id/pdf', authenticate, contractController.getContractPDF);

// Obtener historial de cambios de un contrato
router.get('/:id/history', authenticate, contractController.getContractHistory);

// Firmar contrato
router.patch('/:id/sign', authenticate, requirePolicies(REQUIRED_POLICIES), contractController.signContract);

// Iniciar pago por SEPA con Stripe
router.post('/:id/pay', ...assertRole('tenant'), contractController.initiatePayment);

// Iniciar firma electrónica de contrato
router.post(
  '/:id/signature',
  ...assertRole('landlord', 'admin'),
  requirePolicies(REQUIRED_POLICIES),
  contractController.requestSignature
);
router.post(
  '/:id/signature/init',
  ...assertRole('landlord', 'admin'),
  requirePolicies(REQUIRED_POLICIES),
  signCtrl.initiateSignature
);
router.get('/:id/signature/status', authenticate, signCtrl.getSignature);
router.post('/signature/webhook', signCtrl.signatureWebhook);

// Callback de firma (mock)
router.post('/:id/signature/callback', signCtrl.signatureCallback);

// Activar contrato
router.post('/:id/activate', authenticate, lifeCtrl.activate);

// Enviar recordatorio de pago de renta
router.post('/:id/remind', authenticate, contractController.sendRentReminder);

// Enviar notificación de renovación
router.post('/:id/renew', authenticate, contractController.sendRenewalNotification);

// Terminar contrato
router.post('/:id/terminate', authenticate, termCtrl.terminate);

// Pagar fianza
router.post('/:id/deposit', ...assertRole('tenant'), contractController.payDeposit);

// Obtener contrato con reputación
router.get('/:id', authenticate, contractController.getContract);

// PDF firmado (DocuSign) con control de acceso
router.get('/:id/pdf/signed', authenticate, async (req, res) => {
  try {
    const c = await Contract.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ error: 'not_found' });
    const u: any = (req as any).user;
    const isParty = u?.role === 'admin' || String(c.landlord) === u?.id || String(c.tenant) === u?.id;
    if (!isParty) return res.status(403).json({ error: 'forbidden' });
    const fs = require('fs');
    const path = require('path');
    const dir = path.resolve(process.cwd(), 'storage/contracts-signed');
    const envelopeId = c?.signature?.envelopeId;
    const fileName = envelopeId ? `${String(c._id)}-${envelopeId}.pdf` : null;
    if (!fileName) return res.status(404).json({ error: 'no_signed_pdf' });
    const abs = path.join(dir, fileName);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'no_signed_pdf' });
    res.setHeader('Content-Type', 'application/pdf');
    fs.createReadStream(abs).pipe(res);
  } catch (e: any) {
    res.status(500).json({ error: 'serve_signed_pdf_failed' });
  }
});

// Alias
router.get('/:id/signed.pdf', (_req, res) => {
  const id = _req.params.id;
  res.redirect(302, `/api/contracts/${id}/pdf/signed`);
});

export default router;

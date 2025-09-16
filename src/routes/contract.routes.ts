import { Router } from 'express';
import * as contractController from '../controllers/contract.controller';
import * as lifeCtrl from '../controllers/contract.lifecycle.controller';
import * as signCtrl from '../controllers/contract.signature.controller';
import * as termCtrl from '../controllers/contract.terminate.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// List contracts
router.get('/', authenticate, contractController.listContracts);

// Crear contrato
router.post('/', authenticate, contractController.create);

// Descargar contrato en PDF
router.get('/:id/pdf', authenticate, contractController.getContractPDF);

// Obtener historial de cambios de un contrato
router.get('/:id/history', authenticate, contractController.getContractHistory);

// Firmar contrato
router.patch('/:id/sign', authenticate, contractController.signContract);

// Iniciar pago por SEPA con Stripe
router.post('/:id/pay', authenticate, contractController.initiatePayment);

// Iniciar firma electrónica de contrato
router.post('/:id/signature', authenticate, contractController.requestSignature);

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
router.post('/:id/deposit', authenticate, contractController.payDeposit);

// Obtener contrato con reputación
router.get('/:id', authenticate, contractController.getContract);

export default router;

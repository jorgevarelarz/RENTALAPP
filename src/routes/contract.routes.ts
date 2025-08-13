import { Router } from 'express';
import * as contractController from '../controllers/contract.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateContract } from '../middleware/validation.middleware';

const router = Router();

// Crear contrato
router.post('/', authenticate, validateContract, contractController.createContract);

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

// Enviar recordatorio de pago de renta
router.post('/:id/remind', authenticate, contractController.sendRentReminder);

// Enviar notificación de renovación
router.post('/:id/renew', authenticate, contractController.sendRenewalNotification);

// Pagar fianza
router.post('/:id/deposit', authenticate, contractController.payDeposit);

export default router;
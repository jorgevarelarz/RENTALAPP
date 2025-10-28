import { Router } from 'express';
import { signaturitProvider } from '../signature/signaturit';
import { Contract } from '../models/contract.model';
import { SignatureRequest } from '../models/signatureRequest.model';
import { User } from '../models/user.model';
import { isMock, isProd } from '../config/flags';
import getRequestLogger from '../utils/requestLogger';

const router = Router();

// Start signing flow for a contract
router.post('/contracts/:id/sign/start', async (req, res) => {
  if (isProd() && isMock(process.env.SIGN_PROVIDER)) {
    return res.status(503).json({ error: 'signature_mock_not_allowed_in_prod' });
  }
  const contract = await Contract.findById(req.params.id);
  if (!contract) return res.status(404).json({ error: 'contract_not_found' });
  if (contract.status !== 'generated' && contract.status !== 'draft') {
    return res.status(400).json({ error: 'invalid_status' });
  }

  const owner = await User.findById(contract.landlord);
  const tenant = await User.findById(contract.tenant);
  if (!owner || !tenant) return res.status(400).json({ error: 'missing_parties' });

  const pdfPath = req.body?.pdfPath || '';
  const { requestId, signerLinks } = await signaturitProvider.createSignatureFlow({
    contractId: String(contract._id),
    pdfPath,
    returnUrl: process.env.APP_URL || '',
    webhookUrl: `${process.env.APP_URL}/api/signature/webhook`,
    signers: [
      { role: 'owner', userId: String(owner._id), name: owner.name, email: owner.email },
      { role: 'tenant', userId: String(tenant._id), name: tenant.name, email: tenant.email },
    ],
  });

  await SignatureRequest.create({ contractId: contract._id, provider: 'signaturit', requestId, status: 'sent', signerLinks });
  contract.status = 'signing';
  await contract.save();

  res.json({ requestId, signerLinks });
});

// Webhook to receive updates from signature provider
router.post('/signature/webhook', async (req, res) => {
  const event = signaturitProvider.parseWebhook(req.body);
  await SignatureRequest.findOneAndUpdate(
    { requestId: event.requestId },
    { $set: { status: event.status, evidence: event.evidence } },
    { upsert: true },
  );
  if (event.status === 'completed') {
    const sig = await SignatureRequest.findOne({ requestId: event.requestId });
    if (sig) {
      const pdfBuffer = await signaturitProvider.downloadFinalPdf(event.requestId);
      // In a real app, upload buffer to storage and compute sha256
      getRequestLogger(req).info({ requestId: event.requestId, bytes: pdfBuffer.length }, 'PDF de firma descargado');
      await Contract.findByIdAndUpdate(sig.contractId, { $set: { status: 'signed' } });
    }
  }
  res.json({ received: true });
});

export default router;

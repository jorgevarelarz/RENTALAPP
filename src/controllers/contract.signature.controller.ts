import { Request, Response } from 'express';
import { Contract } from '../models/contract.model';
import { ProcessedEvent } from '../models/processedEvent.model';
import { transitionContract } from '../core/contractState';
import { recordContractHistory } from '../utils/history';
import * as docusignProvider from '../core/signature/docusign.provider';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { isMock, isProd } from '../config/flags';
import getRequestLogger from '../utils/requestLogger';

type KnownStatuses = "signed" | "active" | "terminated" | "completed";

const FINAL_STATES: KnownStatuses[] = ["signed", "active", "terminated", "completed"];

const isDuplicateKeyError = (error: unknown) => {
  return typeof error === "object" && error !== null && (error as any).code === 11000;
};

/**
 * Payload esperado (mock / proveedores reales):
 * { eventId: string, provider?: 'mock'|'signaturit'|..., status?: 'signed' }
 */
export async function signatureCallback(req: Request, res: Response) {
  const { id } = req.params;
  const providerFlag = (process.env.SIGN_PROVIDER || 'mock').toLowerCase();

  if (providerFlag !== 'docusign') {
    const sharedSecret = process.env.SIGNATURE_CALLBACK_SECRET;
    if (!sharedSecret) {
      getRequestLogger(req).error({ contractId: id }, 'Signature callback secret not configured');
      return res.status(500).json({ error: 'signature_callback_secret_not_configured' });
    }
    const providedSecret =
      req.header('x-signature-secret') ||
      (typeof req.query.secret === 'string' ? req.query.secret : undefined);
    if (providedSecret !== sharedSecret) {
      getRequestLogger(req).warn({ contractId: id }, 'Invalid signature callback secret');
      return res.status(401).json({ error: 'invalid_signature_secret' });
    }
  }

  // DocuSign branch
  if (providerFlag === 'docusign') {
    try {
      const rawBuffer: Buffer | undefined = (req as any).rawBody
        ? Buffer.from((req as any).rawBody)
        : undefined;
      const signatureHeader = req.header('X-DocuSign-Signature-1') || req.header('x-docusign-signature-1');
      if (!signatureHeader) return res.status(400).json({ error: 'missing_signature_header' });
      const payloadBuffer =
        rawBuffer ||
        (typeof req.body === 'string'
          ? Buffer.from(req.body, 'utf8')
          : Buffer.from(JSON.stringify(req.body || {}), 'utf8'));
      const ok = docusignProvider.verifyConnectHmac(payloadBuffer, signatureHeader);
      if (!ok) return res.status(400).json({ error: 'invalid_hmac' });
      let body: any;
      if (rawBuffer) {
        try {
          body = JSON.parse(rawBuffer.toString('utf8') || '{}');
        } catch {
          body = {};
        }
      } else if (typeof req.body === 'object') {
        body = req.body;
      } else {
        body = JSON.parse(String(req.body || '{}'));
      }
      const envelopeId: string | undefined = body?.envelopeId || body?.envelope_id;
      const eventType: string | undefined = body?.event || body?.eventType || body?.status;
      if (!envelopeId) return res.status(400).json({ error: 'missing_envelopeId' });
      const contract = await Contract.findOne({ 'signature.envelopeId': envelopeId });
      if (!contract) return res.status(404).json({ error: 'contract_not_found' });
      const now = new Date();
      const updates: any = { 'signature.updatedAt': now };
      if (eventType) updates['signature.events'] = [...(contract.signature?.events || []), { at: now, type: eventType }];
      if (['completed','declined','sent','created','error'].includes(String(eventType))) {
        updates['signature.status'] = eventType;
      }
      // On completed, fetch and store PDF
      if (String(eventType) === 'completed') {
        const buf = await docusignProvider.fetchCompletedDocument(envelopeId);
        const dir = path.resolve(process.cwd(), 'storage/contracts-signed');
        try { fs.mkdirSync(dir, { recursive: true }); } catch {}
        const fileName = `${String(contract._id)}-${envelopeId}.pdf`;
        const abs = path.join(dir, fileName);
        fs.writeFileSync(abs, buf);
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        updates['signature.pdfUrl'] = `/api/contracts/${String(contract._id)}/pdf/signed`;
        updates['signature.pdfHash'] = hash;
      }
      await Contract.findByIdAndUpdate(contract._id, { $set: updates });
      return res.json({ ok: true });
    } catch (e: any) {
      getRequestLogger(req).error({ err: e, contractId: id }, 'DocuSign callback error');
      return res.status(500).json({ error: 'callback_failed' });
    }
  }

  const { eventId, provider = "mock", status = "signed" } = (req.body || {}) as any;

  if (!eventId || typeof eventId !== "string") {
    return res.status(400).json({ error: "missing_eventId" });
  }

  const contract = await Contract.findById(id);
  if (!contract) {
    return res.status(404).json({ error: "contract_not_found" });
  }

  try {
    await ProcessedEvent.create({ provider, eventId, contractId: contract._id });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.json({ ok: true, status: contract.status, idempotent: true });
    }
    getRequestLogger(req).error({ err: error, contractId: id, eventId }, 'Error almacenando evento de firma');
    return res.status(500).json({ error: "event_store_failed" });
  }

  if (FINAL_STATES.includes(contract.status as KnownStatuses)) {
    return res.json({ ok: true, status: contract.status, alreadyFinalized: true });
  }

  if (status === "signed") {
    if (isProd() && isMock(process.env.SIGN_PROVIDER)) {
      return res.status(503).json({ error: "signature_mock_not_allowed_in_prod" });
    }
    try {
      const updated = await transitionContract(id, "signed");
      await recordContractHistory(id, "SIGNED", (req as any).user?.id, { provider, eventId });
      return res.json({ ok: true, status: updated.status });
    } catch (error: any) {
      const httpStatus = error?.status ?? 500;
      return res.status(httpStatus).json({
        error: error?.message || "signature_callback_failed",
        from: error?.from,
        to: error?.to,
      });
    }
  }

  return res.json({ ok: true, status: contract.status, ignored: true });
}

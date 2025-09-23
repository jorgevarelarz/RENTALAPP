import { Request, Response } from "express";
import { Contract } from "../models/contract.model";
import { ProcessedEvent } from "../models/processedEvent.model";
import { transitionContract } from "../services/contractState";
import { recordContractHistory } from "../utils/history";
import * as docusignProvider from "../services/signature/docusign.provider";
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { isMock, isProd } from "../config/flags";

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
  // DocuSign branch
  if (providerFlag === 'docusign') {
    try {
      const raw = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? (req.body as any) : JSON.stringify(req.body || {});
      const ok = docusignProvider.verifyConnectHmac(raw, req.header('X-DocuSign-Signature-1') || req.header('x-docusign-signature-1'));
      if (!ok) return res.status(400).json({ error: 'invalid_hmac' });
      const body: any = typeof req.body === 'object' ? req.body : JSON.parse(String(raw || '{}'));
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
      console.error('DocuSign callback error:', e);
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
    console.error("Error almacenando evento de firma:", error);
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

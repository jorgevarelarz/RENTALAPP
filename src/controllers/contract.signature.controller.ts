import { Request, Response } from "express";
import { Contract } from "../models/contract.model";
import { ProcessedEvent } from "../models/processedEvent.model";
import { transitionContract } from "../services/contractState";
import { recordContractHistory } from "../utils/history";
import * as docusignProvider from "../services/signature/docusign.provider";
import { initSignature, getSignatureStatus } from "../services/signature.service";
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { isMock, isProd } from "../config/flags";
import { ContractSignatureEvent } from "../models/contractSignatureEvent.model";

type KnownStatuses = "signed" | "active" | "terminated" | "completed";

const FINAL_STATES: KnownStatuses[] = ["signed", "active", "terminated", "completed"];

const isDuplicateKeyError = (error: unknown) => {
  return typeof error === "object" && error !== null && (error as any).code === 11000;
};

const verifyGenericHmac = (raw: string | undefined, signatureHeader: string | string[] | undefined, secret?: string) => {
  if (!secret) return true;
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!signature) return false;
  const computed = crypto.createHmac('sha256', secret).update(raw || '').digest('hex');
  return signature === computed;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
};

const getClientIp = (req: Request): string | undefined => {
  const xf = req.header('x-forwarded-for');
  if (xf) return xf.split(',')[0]?.trim();
  const direct = (req as any).ip || (req as any).connection?.remoteAddress;
  return direct;
};

async function recordSignatureEvent(params: {
  contractId: string;
  userId?: string;
  envelopeId?: string;
  provider?: string;
  eventType: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}) {
  const previous = await ContractSignatureEvent.findOne({ contractId: params.contractId })
    .sort({ timestamp: -1, _id: -1 })
    .lean();
  const previousHash = previous?.currentHash || 'GENESIS';
  const payload = {
    contractId: params.contractId,
    userId: params.userId || null,
    envelopeId: params.envelopeId || null,
    provider: params.provider || null,
    eventType: params.eventType,
    timestamp: params.timestamp.toISOString(),
    ip: params.ip || null,
    userAgent: params.userAgent || null,
  };
  const payloadStr = stableStringify(payload);
  const currentHash = crypto.createHash('sha256').update(`${previousHash}|${payloadStr}`).digest('hex');
  await ContractSignatureEvent.create({
    contractId: params.contractId,
    userId: params.userId,
    eventType: params.eventType,
    timestamp: params.timestamp,
    ip: params.ip,
    userAgent: params.userAgent,
    previousHash,
    currentHash,
  });
  return { previousHash, currentHash };
}

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
      const raw = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : typeof req.body === 'string' || Buffer.isBuffer(req.body) ? (req.body as any) : JSON.stringify(req.body || {});
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

  const contractId = id || (req.body as any)?.contractId;
  const contract = contractId ? await Contract.findById(contractId) : null;
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

export async function initiateSignature(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).user?._id || (req as any).user?.id;
    const result = await initSignature(id, userId);
    res.status(201).json(result);
  } catch (error: any) {
    const code = error?.status || 500;
    res.status(code).json({ error: error?.message || 'init_signature_failed' });
  }
}

export async function getSignature(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const status = await getSignatureStatus(id);
    res.json(status);
  } catch (error: any) {
    const code = error?.status || 500;
    res.status(code).json({ error: error?.message || 'signature_status_failed' });
  }
}

export async function signatureWebhook(req: Request, res: Response) {
  if (isProd() && isMock(process.env.SIGN_PROVIDER)) {
    return res.status(403).json({ error: 'signature_mock_not_allowed_in_prod' });
  }
  const secret = process.env.SIGN_WEBHOOK_SECRET;
  const raw = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : JSON.stringify(req.body || {});
  if (!verifyGenericHmac(raw, req.headers['x-signature'], secret)) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  const { envelopeId, event, status: bodyStatus, eventId } = (req.body || {}) as any;
  const status: string = bodyStatus || event || 'unknown';

  if (!envelopeId) return res.status(400).json({ error: 'missing_envelopeId' });

  const contract = await Contract.findOne({ 'signature.envelopeId': envelopeId });
  if (!contract) return res.status(404).json({ error: 'contract_not_found' });

  const now = new Date();
  await recordSignatureEvent({
    contractId: String(contract._id),
    envelopeId,
    provider: (process.env.SIGN_PROVIDER || 'mock').toLowerCase(),
    eventType: status,
    timestamp: now,
    ip: getClientIp(req),
    userAgent: req.header('user-agent') || undefined,
  });

  if (eventId) {
    try {
      await ProcessedEvent.create({ provider: 'webhook', eventId, contractId: contract._id });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        console.error('signature webhook event store failed', error);
        return res.status(500).json({ error: 'event_store_failed' });
      }
    }
  }

  const updates: any = {
    'signature.updatedAt': now,
    'signature.status': status,
    'signature.events': [...(contract.signature?.events || []), { at: now, type: status }],
  };

  if (status === 'completed' || status === 'signed') {
    if (isProd() && isMock(process.env.SIGN_PROVIDER)) {
      return res.status(503).json({ error: 'signature_mock_not_allowed_in_prod' });
    }
    try {
      const updated = await transitionContract(String(contract._id), 'signed');
      await recordContractHistory(String(contract._id), 'SIGNED', null, { provider: 'webhook', envelopeId });
      await Contract.findByIdAndUpdate(contract._id, { $set: updates });
      return res.sendStatus(200);
    } catch (error: any) {
      const httpStatus = error?.status ?? 500;
      return res.status(httpStatus).json({
        error: error?.message || 'signature_callback_failed',
        from: error?.from,
        to: error?.to,
      });
    }
  }

  await Contract.findByIdAndUpdate(contract._id, { $set: updates });
  return res.sendStatus(200);
}

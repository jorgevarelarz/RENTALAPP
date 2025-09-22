import { Request, Response } from "express";
import { Contract } from "../models/contract.model";
import { ProcessedEvent } from "../models/processedEvent.model";
import { transitionContract } from "../services/contractState";
import { recordContractHistory } from "../utils/history";
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
  const { eventId, provider = "mock", status = "signed" } = req.body || {};

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

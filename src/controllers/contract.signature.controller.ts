import { Request, Response } from "express";
import { transitionContract } from "../services/contractState";
import { recordContractHistory } from "../utils/history";

export async function signatureCallback(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const contract = await transitionContract(id, "signed");

    await recordContractHistory(id, "SIGNED", (req as any).user?.id, {
      provider: "mock",
      note: "signature completed (mock)",
    });

    return res.json({ ok: true, status: contract.status });
  } catch (error: any) {
    const status = error?.status ?? 500;
    const payload: Record<string, unknown> = {
      error: error?.message || "signature_callback_failed",
    };
    if (error?.from) payload.from = error.from;
    if (error?.to) payload.to = error.to;
    return res.status(status).json(payload);
  }
}

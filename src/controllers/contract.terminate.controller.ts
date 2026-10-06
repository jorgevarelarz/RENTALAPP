import { Request, Response } from "express";
import { transitionContract } from "../services/contractState";
import { recordContractHistory } from "../utils/history";
import { ensureCanReadContract } from "../utils/contractAccess";

export async function terminate(req: Request, res: Response) {
  const { id } = req.params;
  const { reason } = req.body || {};

  try {
    // Solo las partes del contrato (o admin / agencia gestora) pueden terminarlo
    await ensureCanReadContract({ contractId: id, user: (req as any).user });
    const c = await transitionContract(id, "terminated");
    await recordContractHistory(id, "TERMINATED", (req as any).user?.id, { reason });
    return res.json({ ok: true, status: c.status });
  } catch (error: any) {
    const status = error?.status ?? 500;
    const payload: Record<string, unknown> = {
      error: error?.message || "termination_failed",
    };
    if (error?.from) payload.from = error.from;
    if (error?.to) payload.to = error.to;
    return res.status(status).json(payload);
  }
}

import { Request, Response } from "express";
import { transitionContract } from "../services/contractState";
import { recordContractHistory } from "../utils/history";
import { ensureCanReadContract } from "../utils/contractAccess";
import { sendRouteError } from "../utils/routeError";

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
    const status = Number(error?.status);
    if (!(status >= 400 && status < 500)) return sendRouteError(res, error, "termination_failed");
    const payload: Record<string, unknown> = { error: error.message };
    if (error?.from) payload.from = error.from;
    if (error?.to) payload.to = error.to;
    return res.status(status).json(payload);
  }
}

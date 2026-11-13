import { Request, Response } from "express";
import { Contract } from "../models/contract.model";
import { transitionContract } from "../services/contractState";
import { recordContractHistory } from "../utils/history";
import { ensureCanReadContract } from "../utils/contractAccess";
import { sendRouteError } from "../utils/routeError";

export async function activate(req: Request, res: Response) {
  const { id } = req.params;

  try {
    await ensureCanReadContract({ contractId: id, user: (req as any).user });
    const c = await Contract.findById(id);
    if (!c) {
      return res.status(404).json({ error: "contract_not_found" });
    }

    if (c.status !== "signed") {
      return res.status(409).json({ error: "must_be_signed" });
    }

    const now = new Date();
    if (c.startDate && now < c.startDate) {
      return res.status(409).json({ error: "start_date_not_reached" });
    }

    const updated = await transitionContract(id, "active");

    await recordContractHistory(id, "ACTIVATED", (req as any).user?.id, {
      startDate: c.startDate,
    });

    return res.json({ ok: true, status: updated.status });
  } catch (error: any) {
    const status = Number(error?.status);
    if (!(status >= 400 && status < 500)) return sendRouteError(res, error, "activation_failed");
    const payload: Record<string, unknown> = { error: error.message };
    if (error?.from) payload.from = error.from;
    if (error?.to) payload.to = error.to;
    return res.status(status).json(payload);
  }
}

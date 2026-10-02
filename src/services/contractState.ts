import { Contract } from "../models/contract.model";
import { sendContractActiveEmail } from "../utils/email";
import {
  type ContractStatus,
  canTransitionContract,
  normalizeContractStatus,
} from "../domain/contracts/status";

export type ContractState = ContractStatus;

export function canTransition(from: string | undefined, to: ContractState) {
  return canTransitionContract(from, to);
}

export async function transitionContract(id: string, to: ContractState) {
  const c = await Contract.findById(id)
    .populate("property")
    .populate({ path: "tenant", select: "name email" });
  if (!c) throw Object.assign(new Error("contract_not_found"), { status: 404 });
  const currentStatus = normalizeContractStatus(c.status as string | undefined);
  if (!canTransition(c.status, to)) {
    throw Object.assign(new Error("invalid_transition"), { status: 409, from: c.status, to });
  }
  const previous = currentStatus;
  c.status = to;
  await c.save();

  if (to === "active" && previous !== "active") {
    try {
      const tenant = c.tenant && typeof c.tenant === "object" ? (c.tenant as any) : null;
      const tenantEmail = tenant?.email;
      if (tenantEmail) {
        const propertyTitle =
          c.property && typeof c.property === "object"
            ? (c.property as any).title || (c.property as any).address || "tu nueva vivienda"
            : "tu nueva vivienda";
        await sendContractActiveEmail(
          tenantEmail,
          tenant?.name || "Inquilino",
          propertyTitle,
          String(c._id),
        );
      }
    } catch (error) {
      console.error("Error enviando email de contrato activo:", error);
    }
  }

  return c;
}

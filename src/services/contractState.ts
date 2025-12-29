import { Contract } from "../models/contract.model";
import { sendContractActiveEmail } from "../utils/email";

export type ContractState = "draft" | "pending_signature" | "signed" | "active" | "terminated";

const ALLOWED: Record<ContractState, ContractState[]> = {
  draft: ["pending_signature", "terminated"],
  pending_signature: ["signed", "terminated"],
  signed: ["active", "terminated"],
  active: ["terminated"],
  terminated: [],
};

export function canTransition(from: ContractState, to: ContractState) {
  return ALLOWED[from]?.includes(to) ?? false;
}

export async function transitionContract(id: string, to: ContractState) {
  const c = await Contract.findById(id)
    .populate("property")
    .populate({ path: "tenant", select: "name email" });
  if (!c) throw Object.assign(new Error("contract_not_found"), { status: 404 });
  if (!canTransition((c.status as ContractState) ?? "draft", to)) {
    throw Object.assign(new Error("invalid_transition"), { status: 409, from: c.status, to });
  }
  const previous = c.status as ContractState;
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

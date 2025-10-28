import { Contract } from "../models/contract.model";

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
  const c = await Contract.findById(id);
  if (!c) throw Object.assign(new Error("contract_not_found"), { status: 404 });
  if (!canTransition((c.status as ContractState) ?? "draft", to)) {
    throw Object.assign(new Error("invalid_transition"), { status: 409, from: c.status, to });
  }
  c.status = to;
  await c.save();
  return c;
}

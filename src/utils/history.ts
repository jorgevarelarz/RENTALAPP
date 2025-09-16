import { Types } from "mongoose";
import { Contract } from "../models/contract.model";
import { ContractHistory } from "../models/history.model";

type ActorLike = string | Types.ObjectId | null | undefined;

type DetailsLike = Record<string, unknown> | null | undefined;

const normalizeActorId = (value: ActorLike): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Types.ObjectId) {
    return value.toHexString();
  }
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  return undefined;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

export async function recordContractHistory(
  contractId: string | Types.ObjectId,
  action: string,
  actorOrDetails?: ActorLike | DetailsLike,
  maybeDetails?: DetailsLike,
): Promise<void> {
  let actorId: string | undefined;
  let payload: Record<string, unknown> = {};

  if (maybeDetails !== undefined) {
    actorId = normalizeActorId(actorOrDetails as ActorLike);
    if (isPlainObject(maybeDetails)) {
      payload = maybeDetails;
    }
  } else if (isPlainObject(actorOrDetails) && !(actorOrDetails instanceof Types.ObjectId)) {
    payload = actorOrDetails as Record<string, unknown>;
  } else if (actorOrDetails instanceof Types.ObjectId) {
    actorId = normalizeActorId(actorOrDetails);
  } else if (typeof actorOrDetails === "string") {
    payload = { message: actorOrDetails };
  }

  const entry = {
    ts: new Date(),
    actorId,
    action,
    payload,
  };

  try {
    await Contract.findByIdAndUpdate(
      contractId,
      { $push: { history: entry } },
      { new: false },
    );
  } catch (error) {
    console.error("Error actualizando historial embebido del contrato:", error);
  }

  try {
    const description =
      typeof payload.message === "string"
        ? payload.message
        : typeof actorOrDetails === "string" && maybeDetails === undefined
          ? actorOrDetails
          : undefined;
    await new ContractHistory({ contract: contractId, action, description }).save();
  } catch (error) {
    console.error("Error al registrar historial del contrato:", error);
  }
}

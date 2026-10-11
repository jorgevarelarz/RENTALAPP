import { Types } from 'mongoose';
import { Contract } from '../models/contract.model';
import { Property } from '../models/property.model';
import { ContractParty } from '../models/contractParty.model';

export type AuthUserLike = {
  id?: string;
  _id?: string;
  role?: string;
};

function getUserId(u: AuthUserLike | undefined | null): string | undefined {
  const id = (u as any)?.id ?? (u as any)?._id;
  return id ? String(id) : undefined;
}

export async function ensureCanReadContract(params: {
  contractId: string;
  user: AuthUserLike | undefined | null;
}): Promise<void> {
  const { contractId, user } = params;
  const userId = getUserId(user);
  const role = String((user as any)?.role || '');
  if (!userId || !role) {
    const err: any = new Error('unauthorized');
    err.status = 403;
    throw err;
  }
  if (!Types.ObjectId.isValid(contractId)) {
    const err: any = new Error('invalid_contract_id');
    err.status = 400;
    throw err;
  }

  if (role === 'admin') return;

  const c: any = await Contract.findById(contractId).select('landlord tenant agencyId property').lean();
  if (!c) {
    const err: any = new Error('not_found');
    err.status = 404;
    throw err;
  }

  if (String(c.landlord) === userId || String(c.tenant) === userId) return;

  if (role === 'agency') {
    if (String(c.agencyId || '') !== userId) {
      const err: any = new Error('forbidden');
      err.status = 403;
      throw err;
    }
    const p: any = await Property.findById(c.property).select('agencyId agencyAccess').lean();
    const managesStill =
      p?.agencyAccess === 'manage' &&
      String(p?.agencyId || '') === userId;
    if (!managesStill) {
      const err: any = new Error('forbidden');
      err.status = 403;
      throw err;
    }
    return;
  }

  const err: any = new Error('forbidden');
  err.status = 403;
  throw err;
}


/**
 * Co-titular que ya aceptó la invitación (o firmó). Solo da acceso de lectura (detalle y PDF);
 * el resto de acciones sobre el contrato siguen en `ensureCanReadContract`.
 */
export async function isActiveCoTenant(contractId: unknown, userId: string | undefined): Promise<boolean> {
  if (!userId || !Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(String(contractId))) return false;
  return !!(await ContractParty.exists({
    contractId: String(contractId),
    role: 'TENANT',
    userId,
    status: { $in: ['JOINED', 'SIGNED'] },
  }));
}

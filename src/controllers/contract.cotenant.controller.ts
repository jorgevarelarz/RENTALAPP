import { Request, Response } from 'express';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { Contract } from '../models/contract.model';
import { ContractParty } from '../models/contractParty.model';
import { getNextSigningStatus } from '../domain/contracts/status';
import { AdminRequest } from '../models/adminRequest.model';
import { User } from '../models/user.model';
import { Property } from '../models/property.model';
import { sendCoTenantInviteEmail } from '../utils/email';
import { frontendUrl } from '../utils/frontendUrl';
import { isManagingAgency } from '../utils/propertyAccess';

const redactEmail = (email?: string) => {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  const localRed = local.length <= 2 ? `${local[0]}*` : `${local[0]}***${local.slice(-1)}`;
  const domainParts = domain.split('.');
  const domainName = domainParts[0] || '';
  const domainRed = domainName.length <= 2 ? `${domainName[0]}*` : `${domainName[0]}***${domainName.slice(-1)}`;
  const tld = domainParts.slice(1).join('.');
  return `${localRed}@${domainRed}${tld ? `.${tld}` : ''}`;
};

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;
/** Entre dos envíos de la misma invitación vigente, para no usar la app para mandar correo en bucle. */
export const INVITE_RESEND_COOLDOWN_MS = 10 * 60 * 1000;

const newInviteToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  };
};

/**
 * El email dice quién invita y qué vivienda es; el token solo viaja en el enlace.
 * Guarda en la invitación si el correo salió, para que la interfaz pueda avisar.
 */
const sendInviteEmail = async (party: any, token: string, expiresAt: Date, contract: any, inviterId?: string) => {
  const [property, inviter]: any[] = await Promise.all([
    contract.property ? Property.findById(contract.property).select('title address city').lean() : null,
    inviterId ? User.findById(inviterId).select('name').lean() : null,
  ]);
  const emailStatus = await sendCoTenantInviteEmail(party.email, {
    link: frontendUrl('/invites/accept', { token }),
    inviterName: inviter?.name,
    propertyTitle: property?.title,
    propertyAddress: [property?.address, property?.city].filter(Boolean).join(', '),
    expiresAt,
  });
  party.inviteEmailStatus = emailStatus;
  await party.save();
  return emailStatus;
};

export const inviteCoTenant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { email } = req.body || {};
    const userId = req.user?.id;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email_required' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    if (String(contract.tenant) !== String(userId)) {
      return res.status(403).json({ error: 'Solo el inquilino principal puede invitar' });
    }
    const existing = await ContractParty.findOne({
      contractId: contract._id,
      role: 'TENANT',
      email: normalizedEmail,
    });
    if (existing && existing.status !== 'REMOVED') {
      return res.status(400).json({ error: 'already_invited' });
    }
    const { token, tokenHash, expiresAt } = newInviteToken();
    let party = existing;
    if (party) {
      party.status = 'INVITED';
      party.invitedByUserId = userId ? new Types.ObjectId(userId) : undefined;
      party.inviteTokenHash = tokenHash;
      party.inviteExpiresAt = expiresAt;
      party.userId = undefined;
      party.signedAt = undefined;
      await party.save();
    } else {
      party = await ContractParty.create({
        contractId: contract._id,
        role: 'TENANT',
        email: normalizedEmail,
        status: 'INVITED',
        invitedByUserId: userId ? new Types.ObjectId(userId) : undefined,
        inviteTokenHash: tokenHash,
        inviteExpiresAt: expiresAt,
      });
    }
    const emailStatus = await sendInviteEmail(party, token, expiresAt, contract, userId);
    res.json({ ok: true, partyId: party._id, emailStatus });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'invite_failed' });
  }
};

/**
 * Reenvía una invitación de co-titular aún sin aceptar con un enlace nuevo (el anterior deja de valer).
 * Solo el inquilino principal; si la invitación sigue vigente, como mucho una vez cada 10 minutos.
 */
export const resendCoTenantInvite = async (req: Request, res: Response) => {
  try {
    const { id, partyId } = req.params as { id: string; partyId: string };
    const userId = req.user?.id;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    if (String(contract.tenant) !== String(userId)) {
      return res.status(403).json({ error: 'Solo el inquilino principal puede invitar' });
    }
    if (['completed', 'terminated', 'cancelled'].includes(String(contract.status))) {
      return res.status(400).json({ error: 'contract_closed' });
    }
    const party = Types.ObjectId.isValid(partyId) ? await ContractParty.findById(partyId) : null;
    if (!party || String(party.contractId) !== String(contract._id)) {
      return res.status(404).json({ error: 'party_not_found' });
    }
    if (party.status !== 'INVITED') return res.status(400).json({ error: 'not_invited' });
    const now = Date.now();
    const stillValid = !!party.inviteExpiresAt && party.inviteExpiresAt.getTime() > now;
    // Si el último correo falló no hay espera: el invitado no ha recibido nada.
    const lastEmailFailed = party.inviteEmailStatus === 'failed';
    if (stillValid && !lastEmailFailed && party.updatedAt && now - party.updatedAt.getTime() < INVITE_RESEND_COOLDOWN_MS) {
      return res.status(429).json({ error: 'resend_too_soon' });
    }
    const { token, tokenHash, expiresAt } = newInviteToken();
    party.inviteTokenHash = tokenHash;
    party.inviteExpiresAt = expiresAt;
    party.invitedByUserId = userId ? new Types.ObjectId(userId) : party.invitedByUserId;
    await party.save();
    const emailStatus = await sendInviteEmail(party, token, expiresAt, contract, userId);
    res.json({ ok: true, partyId: party._id, expiresAt, emailStatus });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'resend_failed' });
  }
};

/**
 * Cancela una invitación de co-titular que nadie ha aceptado: el enlace deja de valer y el correo
 * puede volver a invitarse. Solo el inquilino principal. Para quien ya se unió está la baja con
 * aprobación del administrador (remove-request).
 */
export const cancelCoTenantInvite = async (req: Request, res: Response) => {
  try {
    const { id, partyId } = req.params as { id: string; partyId: string };
    const userId = req.user?.id;
    const contract = Types.ObjectId.isValid(id) ? await Contract.findById(id) : null;
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    if (String(contract.tenant) !== String(userId)) {
      return res.status(403).json({ error: 'Solo el inquilino principal puede cancelar invitaciones' });
    }
    const party = Types.ObjectId.isValid(partyId) ? await ContractParty.findById(partyId) : null;
    if (!party || String(party.contractId) !== String(contract._id)) {
      return res.status(404).json({ error: 'party_not_found' });
    }
    if (party.status !== 'INVITED') return res.status(400).json({ error: 'not_invited' });
    party.status = 'REMOVED';
    party.inviteTokenHash = undefined;
    party.inviteExpiresAt = undefined;
    await party.save();
    res.json({ ok: true, partyId: party._id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'cancel_failed' });
  }
};

export const signCoTenant = async (req: Request, res: Response) => {
  try {
    const { id, partyId } = req.params as { id: string; partyId: string };
    const userId = req.user?.id;
    const party = await ContractParty.findById(partyId);
    if (!party || String(party.contractId) !== id) {
      return res.status(404).json({ error: 'party_not_found' });
    }
    if (String(party.userId) !== String(userId)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (party.status === 'SIGNED') {
      return res.status(400).json({ error: 'already_signed' });
    }
    if (party.status !== 'JOINED') {
      return res.status(400).json({ error: 'not_joined' });
    }
    party.status = 'SIGNED';
    party.signedAt = new Date();
    await party.save();

    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    const tenants = await ContractParty.find({ contractId: contract._id, role: 'TENANT' });
    const allSigned = tenants.length > 0 && tenants.every(t => t.status === 'SIGNED');
    if (allSigned) {
      contract.signedByTenant = true;
    }
    contract.status = getNextSigningStatus({
      signedByTenant: contract.signedByTenant,
      signedByLandlord: contract.signedByLandlord,
    });
    if (contract.status === 'signed') contract.signedAt = new Date();
    await contract.save();
    res.json({ ok: true, contractStatus: contract.status });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'sign_failed' });
  }
};

export const removeCoTenantRequest = async (req: Request, res: Response) => {
  try {
    const { id, partyId } = req.params as { id: string; partyId: string };
    const { reason } = req.body || {};
    const userId = req.user?.id;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    const isParty = await ContractParty.findOne({
      contractId: contract._id,
      role: 'TENANT',
      userId,
    });
    const isLandlord = String(contract.landlord) === String(userId);
    if (!isParty && !isLandlord) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const party = await ContractParty.findById(partyId);
    if (!party || String(party.contractId) !== String(contract._id)) {
      return res.status(404).json({ error: 'party_not_found' });
    }
    if (party.status === 'REMOVED' || party.status === 'REMOVED_PENDING_ADMIN') {
      return res.status(400).json({ error: 'already_pending_or_removed' });
    }
    party.status = 'REMOVED_PENDING_ADMIN';
    await party.save();
    const reqDoc = await AdminRequest.create({
      type: 'REMOVE_COTENANT',
      contractId: contract._id,
      requestedByUserId: userId,
      targetPartyId: party._id,
      reason,
      status: 'OPEN',
    });
    res.json({ ok: true, requestId: reqDoc._id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'remove_request_failed' });
  }
};

export const getContractParties = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const contract = await Contract.findById(id).lean();
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });

    const parties = await ContractParty.find({ contractId: id, role: 'TENANT' }).lean();
    const userId = String(user?.id || '');
    const isLandlord = String(contract.landlord) === userId;
    const isParty = parties.some(p => String(p.userId) === userId) || String(contract.tenant) === userId;
    const isAdmin = user?.role === 'admin';
    // La agencia que aún gestiona el inmueble ve los co-titulares (solo lectura).
    const isManagingAgencyOfContract =
      user?.role === 'agency' &&
      String((contract as any).agencyId || '') === userId &&
      isManagingAgency(user, await Property.findById(contract.property).select('agencyId agencyAccess').lean());
    if (!isLandlord && !isParty && !isAdmin && !isManagingAgencyOfContract) {
      return res.status(403).json({ error: 'forbidden' });
    }

    // Las invitaciones pendientes no tienen userId: String(undefined) rompía la consulta de usuarios.
    const userIds = parties.filter(p => p.userId).map(p => String(p.userId));
    const users = await User.find({ _id: { $in: userIds } }).select('name avatar').lean();
    const umap = new Map(users.map((u: any) => [String(u._id), u]));
    const showFullEmail = isLandlord || isParty;

    const payload = parties.map(p => ({
      partyId: p._id,
      role: p.role,
      status: p.status,
      signedAt: p.signedAt,
      invitedAt: p.createdAt,
      ...(p.status === 'INVITED'
        ? {
            expiresAt: p.inviteExpiresAt,
            expired: !!p.inviteExpiresAt && p.inviteExpiresAt < new Date(),
            emailFailed: p.inviteEmailStatus === 'failed',
          }
        : {}),
      email: showFullEmail ? p.email : redactEmail(p.email),
      user: p.userId
        ? {
            id: String(p.userId),
            name: umap.get(String(p.userId))?.name,
            avatar: umap.get(String(p.userId))?.avatar,
          }
        : undefined,
    }));

    const legacyTenantId = String(contract.tenant || '');
    const hasLegacyInParties = parties.some(p => String(p.userId) === legacyTenantId);
    if (legacyTenantId && !hasLegacyInParties) {
      const legacyUser: any = await User.findById(legacyTenantId).select('name avatar email').lean();
      payload.unshift({
        partyId: `legacy:${legacyTenantId}`,
        role: 'TENANT',
        status: contract.signedByTenant ? 'SIGNED' : 'JOINED',
        signedAt: contract.signedByTenant ? contract.signedAt : undefined,
        invitedAt: contract.createdAt,
        email: showFullEmail ? legacyUser?.email : redactEmail(legacyUser?.email),
        user: legacyTenantId
          ? {
              id: legacyTenantId,
              name: legacyUser?.name,
              avatar: legacyUser?.avatar,
            }
          : undefined,
      });
    }

    res.json({ items: payload });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'parties_failed' });
  }
};

export const getMyInvites = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    let email = req.user?.email?.toLowerCase?.();
    if (!email) {
      const u = await User.findById(userId).select('email').lean();
      email = u?.email?.toLowerCase?.();
    }
    if (!email) return res.status(400).json({ error: 'email_missing' });
    const now = new Date();
    const invites = await ContractParty.find({
      role: 'TENANT',
      email,
      status: 'INVITED',
    }).lean();
    const contractIds = invites.map(i => i.contractId);
    const contracts = await Contract.find({ _id: { $in: contractIds } })
      .populate({ path: 'property', select: 'title address city' })
      .populate({ path: 'landlord', select: 'name email' })
      .lean();
    const cmap = new Map(contracts.map(c => [String(c._id), c]));
    const payload = invites.map(inv => {
      const c: any = cmap.get(String(inv.contractId));
      return {
        partyId: inv._id,
        contractId: inv.contractId,
        invitedAt: inv.createdAt,
        expiresAt: inv.inviteExpiresAt,
        expired: !!inv.inviteExpiresAt && inv.inviteExpiresAt < now,
        status: inv.status,
        email: inv.email,
        landlordName: c?.landlord?.name,
        property: c?.property
          ? {
              id: c.property._id,
              title: c.property.title,
              address: c.property.address,
              city: c.property.city,
            }
          : undefined,
      };
    });
    res.json({ items: payload });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'invites_failed' });
  }
};

/**
 * Vista previa pública de una invitación de co-titular: quien tiene el enlace aún puede no tener
 * cuenta. Devuelve solo lo necesario para decidir (email invitado, inmueble y quién invita).
 * El token va en la query, que no se guarda en los logs.
 */
export const getInvitePreview = async (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return res.status(400).json({ error: 'token_required' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const party = await ContractParty.findOne({ inviteTokenHash: tokenHash, status: 'INVITED' }).lean();
  if (!party) return res.status(404).json({ error: 'invite_not_found' });
  const [contract, inviter]: any[] = await Promise.all([
    Contract.findById(party.contractId).populate({ path: 'property', select: 'title address city' }).lean(),
    party.invitedByUserId ? User.findById(party.invitedByUserId).select('name').lean() : null,
  ]);
  const property = contract?.property;
  res.json({
    email: party.email,
    expired: !!party.inviteExpiresAt && party.inviteExpiresAt < new Date(),
    inviterName: inviter?.name,
    property: property ? { title: property.title, address: property.address, city: property.city } : undefined,
  });
};

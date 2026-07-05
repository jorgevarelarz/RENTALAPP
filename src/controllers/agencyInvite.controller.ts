import type { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z, ZodError } from 'zod';
import { AgencyInvite } from '../models/agencyInvite.model';
import { User } from '../models/user.model';
import { Property } from '../models/property.model';
import { Contract } from '../models/contract.model';
import { Verification } from '../models/verification.model';
import { sendEmail } from '../utils/email';
import { getJwtSecret } from '../utils/getJwtSecret';
import { recordFunnelEvent } from '../services/funnelEvents.service';
import { logger } from '../utils/logger';

const INVITE_TTL_DAYS = 30;

const createInviteSchema = z.object({
  landlordName: z.string().trim().min(2).max(120),
  landlordEmail: z.string().trim().email().toLowerCase(),
  landlordPhone: z.string().trim().max(30).optional(),
  propertyAddress: z.string().trim().max(200).optional(),
  propertyCity: z.string().trim().max(80).optional(),
});

function requireAgency(req: Request, res: Response): string | null {
  const u: any = (req as any).user;
  const userId = String(u?.id || u?._id || '');
  if (!userId) { res.status(401).json({ error: 'unauthorized' }); return null; }
  if (u?.role !== 'agency') { res.status(403).json({ error: 'forbidden' }); return null; }
  return userId;
}

/** POST /api/agency/landlords/invite — la agencia da de alta a un propietario. */
export async function createLandlordInvite(req: Request, res: Response) {
  const agencyId = requireAgency(req, res);
  if (!agencyId) return;

  let data: z.infer<typeof createInviteSchema>;
  try {
    data = createInviteSchema.parse(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'invalid_payload', details: error.flatten() });
    }
    return res.status(400).json({ error: 'invalid_payload' });
  }

  // Primer toque gana: no se puede reclamar a un usuario que ya existe.
  const existingUser = await User.findOne({ email: data.landlordEmail }).select('_id').lean();
  if (existingUser) {
    return res.status(409).json({ error: 'landlord_already_exists' });
  }
  const pendingInvite = await AgencyInvite.findOne({
    landlordEmail: data.landlordEmail,
    status: 'invited',
    expiresAt: { $gt: new Date() },
  }).select('agencyId').lean();
  if (pendingInvite) {
    const mine = String(pendingInvite.agencyId) === agencyId;
    return res.status(409).json({ error: mine ? 'invite_already_pending' : 'landlord_already_invited' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const invite = await AgencyInvite.create({
    ...data,
    agencyId,
    token,
    status: 'invited',
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  });

  const agency = await User.findById(agencyId).select('name').lean();
  const inviteUrl = `${process.env.FRONTEND_URL || 'https://app.rentalapp.es'}/invite/${token}`;
  sendEmail(
    data.landlordEmail,
    `${agency?.name || 'Tu inmobiliaria'} te invita a gestionar tu alquiler en RentalApp`,
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #030712;">Hola ${data.landlordName},</h2>
      <p><strong>${agency?.name || 'Tu inmobiliaria'}</strong> ha preparado tu cuenta en RentalApp para que gestiones tu alquiler${data.propertyAddress ? ` de <strong>${data.propertyAddress}</strong>` : ''}: contratos, firma digital, cobros y recibos en un solo sitio.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" style="background-color: #030712; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Activar mi cuenta</a>
      </div>
      <p style="color: #666; font-size: 12px;">El enlace caduca en ${INVITE_TTL_DAYS} días. Si no esperabas esta invitación puedes ignorar este email.</p>
    </div>
    `,
  ).catch((err) => logger.error({ err }, 'Error enviando email de invitación de agencia'));

  await recordFunnelEvent(req, 'agency_invite_created', {
    resourceType: 'agencyInvite',
    resourceId: String(invite._id),
    meta: { agencyId, landlordEmail: data.landlordEmail },
  });

  return res.status(201).json({
    invite: {
      id: String(invite._id),
      landlordName: invite.landlordName,
      landlordEmail: invite.landlordEmail,
      status: invite.status,
      inviteUrl,
      expiresAt: invite.expiresAt,
    },
  });
}

/** GET /api/agency/landlords — funnel de propietarios dados de alta por la agencia. */
export async function listLandlordInvites(req: Request, res: Response) {
  const agencyId = requireAgency(req, res);
  if (!agencyId) return;

  const invites = await AgencyInvite.find({ agencyId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const landlordIds = invites.map((i) => i.landlordId).filter(Boolean);
  const [verifications, properties, contracts] = await Promise.all([
    Verification.find({ userId: { $in: landlordIds.map(String) }, status: 'verified' }).select('userId').lean(),
    Property.find({ owner: { $in: landlordIds } }).select('owner').lean(),
    Contract.find({ landlord: { $in: landlordIds }, status: 'active' }).select('landlord').lean(),
  ]);
  const verifiedSet = new Set(verifications.map((v: any) => String(v.userId)));
  const propOwners = new Set(properties.map((p: any) => String(p.owner)));
  const contractOwners = new Set(contracts.map((c: any) => String(c.landlord)));

  const items = invites.map((i) => {
    const lid = i.landlordId ? String(i.landlordId) : undefined;
    const expired = i.status === 'invited' && i.expiresAt < new Date();
    // Funnel: invitado → cuenta creada → KYC → propiedad publicada → contrato activo
    const steps = {
      accountCreated: i.status === 'accepted',
      kycVerified: lid ? verifiedSet.has(lid) : false,
      hasProperty: lid ? propOwners.has(lid) : false,
      hasActiveContract: lid ? contractOwners.has(lid) : false,
    };
    return {
      id: String(i._id),
      landlordName: i.landlordName,
      landlordEmail: i.landlordEmail,
      propertyAddress: i.propertyAddress,
      status: expired ? 'expired' : i.status,
      createdAt: i.createdAt,
      acceptedAt: i.acceptedAt,
      steps,
    };
  });

  return res.json({ items });
}

/** GET /api/agency-invites/:token — datos públicos de la invitación (sin auth). */
export async function getInviteByToken(req: Request, res: Response) {
  const invite = await AgencyInvite.findOne({ token: req.params.token }).lean();
  if (!invite) return res.status(404).json({ error: 'invite_not_found' });
  const expired = invite.status === 'invited' && invite.expiresAt < new Date();
  const agency = await User.findById(invite.agencyId).select('name').lean();
  return res.json({
    landlordName: invite.landlordName,
    landlordEmail: invite.landlordEmail,
    propertyAddress: invite.propertyAddress,
    agencyName: agency?.name || 'Tu inmobiliaria',
    status: expired ? 'expired' : invite.status,
  });
}

/** POST /api/agency-invites/:token/accept — el propietario acepta y crea SU cuenta. */
export async function acceptInvite(req: Request, res: Response) {
  const schema = z.object({
    name: z.string().trim().min(2).max(120).optional(),
    password: z.string().min(8).max(200),
  });
  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(req.body);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'invalid_payload', details: error.flatten() });
    }
    return res.status(400).json({ error: 'invalid_payload' });
  }

  const invite = await AgencyInvite.findOne({ token: req.params.token });
  if (!invite) return res.status(404).json({ error: 'invite_not_found' });
  if (invite.status === 'accepted') return res.status(409).json({ error: 'invite_already_accepted' });
  if (invite.expiresAt < new Date()) return res.status(410).json({ error: 'invite_expired' });

  const existing = await User.findOne({ email: invite.landlordEmail }).select('_id').lean();
  if (existing) return res.status(409).json({ error: 'user_already_exists' });

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = new User({
    name: data.name || invite.landlordName,
    email: invite.landlordEmail,
    passwordHash,
    role: 'landlord',
    phone: invite.landlordPhone,
    referredByAgencyId: invite.agencyId,
  });
  await user.save();

  invite.status = 'accepted';
  invite.landlordId = user._id as any;
  invite.acceptedAt = new Date();
  await invite.save();

  await recordFunnelEvent(req, 'agency_invite_accepted', {
    resourceType: 'user',
    resourceId: String(user._id),
    meta: { agencyId: String(invite.agencyId), inviteId: String(invite._id) },
  });

  const isVerified = Boolean((user as any).isVerified);
  const tokenPayload: any = { id: user._id, role: user.role };
  if (isVerified) tokenPayload.isVerified = true;
  const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '7d' });
  return res.status(201).json({
    token,
    user: { _id: user._id, email: user.email, role: user.role, name: user.name, isVerified },
  });
}

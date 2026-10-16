import { Request, Response } from 'express';
import { User } from '../models/user.model';
import { Payment } from '../models/payment.model';
import { Property } from '../models/property.model';
import { Contract } from '../models/contract.model';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { emailInUse, findUserByEmail, normalizeEmail } from '../utils/userEmail';
import { logger } from '../utils/logger';
import { csvRows } from '../utils/csv';
import { accentInsensitivePattern, escapeRegExp } from '../utils/searchRegex';

const toPublicUser = (u: any) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  isVerified: u.isVerified,
  avatar: u.avatar,
  ratingAvg: u.ratingAvg,
  reviewCount: u.reviewCount,
  companyName: u.companyName,
  serviceCategory: u.serviceCategory,
  createdAt: u.createdAt,
});

const toMeUser = (u: any) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  isVerified: Boolean(u.isVerified),
  phone: u.phone,
  avatar: u.avatar,
  bio: u.bio,
  jobTitle: u.jobTitle,
  monthlyIncome: u.monthlyIncome,
  companyName: u.companyName,
  serviceCategory: u.serviceCategory,
  ratingAvg: u.ratingAvg,
  reviewCount: u.reviewCount,
  createdAt: u.createdAt,
  tenantPro: u.tenantPro
    ? {
        status: u.tenantPro.status,
        isActive: u.tenantPro.isActive,
        maxRent: u.tenantPro.maxRent,
        consentAccepted: u.tenantPro.consentAccepted,
        consentTextVersion: u.tenantPro.consentTextVersion,
        consentAcceptedAt: u.tenantPro.consentAcceptedAt,
        lastDecisionAt: u.tenantPro.lastDecisionAt,
      }
    : undefined,
});

export const USER_ROLES = ['landlord', 'tenant', 'admin', 'pro', 'agency', 'institution_viewer'] as const;
const CSV_MAX_ROWS = 10000;

class UserFilterError extends Error {}

// `q` iba a $regex sin escapar (un «(a+)+$» bloqueaba Mongo) y buscaba en el rol, no en el nombre;
// un rol inexistente daba lista vacía en vez de avisar.
function buildUsersQuery(raw: Record<string, unknown>) {
  const query: Record<string, unknown> = {};
  const role = typeof raw.role === 'string' ? raw.role : '';
  if (role) {
    if (!(USER_ROLES as readonly string[]).includes(role)) throw new UserFilterError('invalid_role');
    query.role = role;
  }
  const term = typeof raw.q === 'string' ? raw.q.trim().slice(0, 100) : '';
  if (term) {
    const pattern = escapeRegExp(term);
    query.$or = [
      { email: { $regex: pattern, $options: 'i' } },
      { name: { $regex: accentInsensitivePattern(term), $options: 'i' } },
      { companyName: { $regex: accentInsensitivePattern(term), $options: 'i' } },
    ];
  }
  return query;
}

/**
 * Lista de usuarios para el administrador, de la cuenta más reciente a la más antigua.
 * El hash de la contraseña no sale (toPublicUser).
 */
export const getAllUsers = async (req: Request, res: Response) => {
  const { page = '1', limit = '10' } = (req.query || {}) as any;
  const pg = Math.max(1, parseInt(String(page)) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(String(limit)) || 10));

  let query: Record<string, unknown>;
  try {
    query = buildUsersQuery(req.query || {});
  } catch (error) {
    if (error instanceof UserFilterError) return res.status(400).json({ error: error.message });
    throw error;
  }

  const [items, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip((pg - 1) * lim)
      .limit(lim)
      .lean(),
    User.countDocuments(query),
  ]);

  res.json({ items: items.map(toPublicUser), total, page: pg, limit: lim });
};

/** CSV con todos los usuarios del filtro (máx. 10.000), con fórmulas neutralizadas. */
export const exportUsersCsv = async (req: Request, res: Response) => {
  let query: Record<string, unknown>;
  try {
    query = buildUsersQuery(req.query || {});
  } catch (error) {
    if (error instanceof UserFilterError) return res.status(400).json({ error: error.message });
    throw error;
  }
  const users = await User.find(query)
    .select(['name', 'email', 'role', 'companyName', 'isVerified', 'createdAt'])
    .sort({ createdAt: -1, _id: -1 })
    .limit(CSV_MAX_ROWS)
    .lean();
  const header = ['id', 'nombre', 'email', 'rol', 'empresa', 'verificado', 'alta'];
  const rows = users.map((u: any) => [
    String(u._id),
    u.name,
    u.email,
    u.role,
    u.companyName ?? '',
    u.isVerified ? 'sí' : 'no',
    u.createdAt ? new Date(u.createdAt).toISOString() : '',
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="usuarios.csv"');
  res.send(csvRows([header, ...rows]));
};

export const createUser = async (req: Request, res: Response) => {
  const requester = (req as any).user;
  if (requester?.role !== 'admin') {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const role = String(req.body?.role || '');
  const allowedRoles = ['tenant', 'landlord', 'pro', 'agency'];

  if (!name || !email || password.length < 8 || !allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  if (await emailInUse(email)) return res.status(409).json({ error: 'email_already_exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
    isVerified: role === 'agency' ? true : Boolean(req.body?.isVerified),
    companyName: req.body?.companyName ? String(req.body.companyName).trim() : undefined,
  });

  res.status(201).json({ user: toPublicUser(user) });
};

// Campos que cada cuenta puede cambiar de sí misma con PATCH /api/users/:id (igual que PUT /me).
const SELF_EDITABLE = ['phone', 'bio', 'avatar', 'jobTitle', 'monthlyIncome', 'companyName', 'serviceCategory'] as const;
// Roles que el administrador puede asignar: los mismos con los que puede crear cuentas.
const ASSIGNABLE_ROLES = ['tenant', 'landlord', 'pro', 'agency'];
const TEXT_LIMITS: Record<string, number> = { name: 120, phone: 40, avatar: 2048, jobTitle: 120, companyName: 200 };

class UserUpdateError extends Error {}

/**
 * Traduce el cuerpo a { $set, $unset } con lista blanca. El administrador puede además cambiar
 * nombre, correo (normalizado y sin duplicados), rol (entre los asignables) e identidad
 * verificada; nunca valoraciones, tokens, Stripe ni Tenant PRO. Los campos desconocidos se ignoran.
 */
async function buildUserUpdate(body: any, target: any, isAdmin: boolean) {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ''> = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body ?? {}, key);

  const text = (key: string, required = false) => {
    const raw = body[key];
    if (raw === null || raw === '') {
      if (required) throw new UserUpdateError(`invalid_${key}`);
      $unset[key] = '';
      return;
    }
    if (typeof raw !== 'string') throw new UserUpdateError(`invalid_${key}`);
    const value = raw.trim();
    if ((required && !value) || value.length > (TEXT_LIMITS[key] ?? 1000)) throw new UserUpdateError(`invalid_${key}`);
    if (value) $set[key] = value;
    else $unset[key] = '';
  };

  for (const key of SELF_EDITABLE) {
    if (!has(key)) continue;
    if (key === 'monthlyIncome') {
      const raw = body.monthlyIncome;
      if (raw === null || raw === '') {
        $unset.monthlyIncome = '';
        continue;
      }
      const n = Number(raw);
      if (typeof raw === 'boolean' || !Number.isFinite(n) || n < 0) throw new UserUpdateError('invalid_monthlyIncome');
      $set.monthlyIncome = n;
    } else if (key === 'serviceCategory') {
      if (typeof body.serviceCategory !== 'string') throw new UserUpdateError('invalid_serviceCategory');
      $set.serviceCategory = body.serviceCategory; // el enum lo valida runValidators
    } else {
      text(key);
    }
  }

  if (!isAdmin) return { $set, $unset };

  if (has('name')) text('name', true);
  if (has('email')) {
    const email = normalizeEmail(body.email);
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new UserUpdateError('invalid_email');
    }
    if (email !== target.email) {
      const other = await findUserByEmail(email, '_id');
      if (other && String(other._id) !== String(target._id)) throw new UserUpdateError('email_already_exists');
      $set.email = email;
    }
  }
  if (has('role') && body.role !== target.role) {
    // Las cuentas de administración e institución no se convierten desde aquí, ni se crean.
    if (!ASSIGNABLE_ROLES.includes(body.role)) throw new UserUpdateError('invalid_role');
    if (!ASSIGNABLE_ROLES.includes(target.role)) throw new UserUpdateError('role_locked');
    $set.role = body.role;
  }
  if (has('isVerified')) {
    if (typeof body.isVerified !== 'boolean') throw new UserUpdateError('invalid_isVerified');
    $set.isVerified = body.isVerified;
  }
  return { $set, $unset };
}

/**
 * PATCH /api/users/:id. Cada cuenta puede editar sus datos de perfil; el administrador, además,
 * los de cualquier cuenta y nombre, correo, rol e identidad verificada (ver buildUserUpdate).
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const requester = (req as any).user;
    const requesterId = String(requester?.id || '');
    const isAdmin = requester?.role === 'admin';
    const isSelf = requesterId && requesterId === String(id);
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'invalid_user_id' });

    const target = await User.findById(id).select('email role').lean();
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    let update;
    try {
      update = await buildUserUpdate(req.body, target, isAdmin);
    } catch (err) {
      if (err instanceof UserUpdateError) {
        return res.status(err.message === 'email_already_exists' ? 409 : 400).json({ error: err.message });
      }
      throw err;
    }
    const ops: Record<string, unknown> = {};
    if (Object.keys(update.$set).length) ops.$set = update.$set;
    if (Object.keys(update.$unset).length) ops.$unset = update.$unset;

    const user = Object.keys(ops).length
      ? await User.findByIdAndUpdate(id, ops, { new: true, runValidators: true }).lean()
      : await User.findById(id).lean();
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(isSelf ? toMeUser(user) : toPublicUser(user));
  } catch (error: any) {
    if (error?.name === 'ValidationError' || error?.name === 'CastError') {
      return res.status(400).json({ error: 'invalid_payload' });
    }
    if (error?.code === 11000) return res.status(409).json({ error: 'email_already_exists' });
    logger.error({ err: error }, 'Error al actualizar el usuario');
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    // requireVerified también da por verificado a quien tiene una Verification aprobada
    // aunque User.isVerified siga en false: se devuelve el estado con el que se le atiende.
    const me = toMeUser(user);
    res.json({ ...me, isVerified: me.isVerified || (req as any).user?.isVerified === true });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ message: 'Error al obtener perfil' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const updates: Record<string, any> = {};
    // name is tied to verification and should not be editable here
    if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) updates.phone = req.body.phone;
    if (Object.prototype.hasOwnProperty.call(req.body, 'bio')) updates.bio = req.body.bio;
    if (Object.prototype.hasOwnProperty.call(req.body, 'avatar')) updates.avatar = req.body.avatar;
    if (Object.prototype.hasOwnProperty.call(req.body, 'jobTitle')) updates.jobTitle = req.body.jobTitle;
    if (Object.prototype.hasOwnProperty.call(req.body, 'monthlyIncome')) {
      const raw = req.body.monthlyIncome;
      if (raw === '' || raw === null || typeof raw === 'undefined') {
        updates.monthlyIncome = undefined;
      } else {
        const parsed = Number(raw);
        updates.monthlyIncome = Number.isFinite(parsed) ? parsed : undefined;
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'companyName')) updates.companyName = req.body.companyName;
    if (Object.prototype.hasOwnProperty.call(req.body, 'serviceCategory')) updates.serviceCategory = req.body.serviceCategory;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(toMeUser(user));
  } catch (error) {
    logger.error({ err: error }, 'Error actualizando perfil');
    res.status(500).json({ message: 'Error al actualizar perfil' });
  }
};

export const getLandlordStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId || !Types.ObjectId.isValid(String(userId))) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    // aggregate() no convierte tipos: req.user lleva el id como texto.
    const userObjectId = new Types.ObjectId(String(userId));

    const earningsAgg = await Payment.aggregate([
      {
        $match: {
          payee: userObjectId,
          status: 'succeeded',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);
    const totalEarnings = earningsAgg[0]?.total || 0;

    const totalProperties = await Property.countDocuments({ owner: userId });
    const activeContracts = await Contract.countDocuments({
      landlord: userId,
      status: 'active',
    });
    const pendingContracts = await Contract.countDocuments({
      landlord: userId,
      status: { $in: ['draft', 'pending_signature', 'signing', 'signed'] },
    });

    const recentPayments = await Payment.find({
      payee: userId,
      status: 'succeeded',
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(5)
      .populate({
        path: 'contract',
        select: 'property',
        populate: { path: 'property', select: 'title address' },
      })
      .lean();

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      earnings: totalEarnings,
      properties: {
        total: totalProperties,
        rented: activeContracts,
        vacancyRate:
          totalProperties > 0
            ? Math.round(((totalProperties - activeContracts) / totalProperties) * 100)
            : 0,
      },
      contracts: {
        active: activeContracts,
        pending: pendingContracts,
      },
      recentPayments: recentPayments.map((p: any) => ({
        id: p._id,
        amount: p.amount,
        date: p.paidAt || p.createdAt,
        concept: p.concept,
        propertyName: p.contract?.property?.title || p.contract?.property?.address || 'Propiedad',
      })),
    });
  } catch (error) {
    console.error('Error getting landlord stats:', error);
    res.status(500).json({ message: 'Error al calcular estadísticas' });
  }
};

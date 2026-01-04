import { Request, Response } from 'express';
import { User } from '../models/user.model';
import { Payment } from '../models/payment.model';
import { Property } from '../models/property.model';
import { Contract } from '../models/contract.model';

/**
 * Retrieve a list of all users. The password hash is excluded for security.
 */
export const getAllUsers = async (req: Request, res: Response) => {
  const { q = '', role = '', page = '1', limit = '10' } = (req.query || {}) as any;
  const pg = Math.max(1, parseInt(String(page)) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(String(limit)) || 10));

  const query: any = {};
  if (role) query.role = role;
  if (q) {
    const term = String(q).trim();
    if (term) query.$or = [
      { email: { $regex: term, $options: 'i' } },
      { role: { $regex: term, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(query)
      .select('-passwordHash')
      .sort({ ratingAvg: -1, reviewCount: -1, createdAt: -1 })
      .skip((pg - 1) * lim)
      .limit(lim)
      .lean(),
    User.countDocuments(query),
  ]);

  res.json({ items, total, page: pg, limit: lim });
};

/**
 * Update user information by id. This allows updating the name, email or role.
 * Password updates should be handled via a dedicated endpoint (not implemented).
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: any = { ...req.body };
    // Prevent changing passwordHash directly via this endpoint
    delete updates.passwordHash;
    const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    const user = await User.findById(userId).select('-passwordHash').lean();
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(user);
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
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ message: 'Error al actualizar perfil' });
  }
};

export const getLandlordStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const userObjectId = (req as any).user?._id;
    if (!userId) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const earningsAgg = await Payment.aggregate([
      {
        $match: {
          payee: userObjectId || userId,
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
      status: { $in: ['draft', 'signing', 'signed'] },
    });

    const recentPayments = await Payment.find({
      payee: userId,
      status: 'succeeded',
    })
      .sort({ paidAt: -1 })
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
        date: p.paidAt,
        concept: p.concept,
        propertyName: p.contract?.property?.title || p.contract?.property?.address || 'Propiedad',
      })),
    });
  } catch (error) {
    console.error('Error getting landlord stats:', error);
    res.status(500).json({ message: 'Error al calcular estadísticas' });
  }
};

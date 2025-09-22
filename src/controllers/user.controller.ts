import { Request, Response } from 'express';
import { User } from '../models/user.model';

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

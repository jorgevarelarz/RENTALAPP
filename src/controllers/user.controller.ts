import { Request, Response } from 'express';
import { User } from '../models/user.model';

/**
 * Retrieve a list of all users. The password hash is excluded for security.
 */
export const getAllUsers = async (_req: Request, res: Response) => {
  const users = await User.find().select('-passwordHash').sort({ ratingAvg: -1, reviewCount: -1 });
  res.json(users);
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

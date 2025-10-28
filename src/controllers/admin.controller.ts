import { Request, Response } from 'express';
import { User } from '../models/user.model';
import { Property } from '../models/property.model';
import { Contract } from '../models/contract.model';
import getRequestLogger from '../utils/requestLogger';

/**
 * Returns aggregate statistics about the platform: total number of users
 * per role, total properties and contracts, and a breakdown of contract
 * statuses. This endpoint is intended for administrators to monitor
 * overall usage.
 */
export const getStats = async (req: Request, res: Response) => {
  try {
    const totalUsers = await User.countDocuments();
    const tenants = await User.countDocuments({ role: 'tenant' });
    const landlords = await User.countDocuments({ role: 'landlord' });
    const admins = await User.countDocuments({ role: 'admin' });
    const totalProperties = await Property.countDocuments();
    const totalContracts = await Contract.countDocuments();
    const activeContracts = await Contract.countDocuments({ status: 'active' });
    const completedContracts = await Contract.countDocuments({ status: 'completed' });
    const draftContracts = await Contract.countDocuments({ status: 'draft' });
    const cancelledContracts = await Contract.countDocuments({ status: 'cancelled' });
    res.json({
      users: { total: totalUsers, tenants, landlords, admins },
      properties: totalProperties,
      contracts: {
        total: totalContracts,
        draft: draftContracts,
        active: activeContracts,
        completed: completedContracts,
        cancelled: cancelledContracts,
      },
    });
  } catch (error: any) {
    getRequestLogger(req).error({ err: error }, 'Error obteniendo estadísticas administrativas');
    res.status(500).json({ error: 'Error obteniendo estadísticas', details: error.message });
  }
};

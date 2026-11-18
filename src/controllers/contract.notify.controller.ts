import { Request, Response } from 'express';
import { Contract } from '../models/contract.model';
import { User } from '../models/user.model';
import { recordContractHistory } from '../utils/history';
import { sendRentReminderEmail, sendContractRenewalNotification } from '../utils/notification';
// @ts-ignore
import { ensureCanReadContract } from '../utils/contractAccess';
import { sendRouteError } from '../utils/routeError';

export const sendRentReminder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ensureCanReadContract({ contractId: id, user: req.user as any });
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    const tenant = await User.findById(contract.tenant);
    if (!tenant?.email) {
      return res.status(404).json({ error: 'El inquilino no tiene email disponible' });
    }
    await sendRentReminderEmail(tenant.email, contract.id, contract.rent);
    await recordContractHistory(contract.id, 'rentReminderSent', 'Recordatorio de renta enviado');
    res.json({ message: 'Recordatorio de renta enviado' });
  } catch (error: any) {
    sendRouteError(res, error, 'rent_reminder_failed');
  }
};

export const sendRenewalNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ensureCanReadContract({ contractId: id, user: req.user as any });
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    const landlord = await User.findById(contract.landlord);
    const tenant = await User.findById(contract.tenant);
    const endDateStr = contract.endDate.toISOString().split('T')[0];
    if (landlord?.email) {
      await sendContractRenewalNotification(landlord.email, contract.id, endDateStr);
    }
    if (tenant?.email) {
      await sendContractRenewalNotification(tenant.email, contract.id, endDateStr);
    }
    await recordContractHistory(contract.id, 'renewalNoticeSent', 'Notificación de renovación enviada');
    res.json({ message: 'Notificaciones de renovación enviadas' });
  } catch (error: any) {
    sendRouteError(res, error, 'renewal_notice_failed');
  }
};

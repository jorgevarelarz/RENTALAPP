import { Request, Response } from 'express';
import { Contract } from '../models/contract.model';
import { Payment } from '../models/payment.model';
// @ts-ignore
import { ensureCanReadContract } from '../utils/contractAccess';

export const getContractPayments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ensureCanReadContract({ contractId: id, user: req.user as any });
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });

    const payments = await Payment.find({ contract: id, status: 'succeeded' }).sort({ createdAt: -1 }).lean();
    res.json(payments);
  } catch (error: any) {
    console.error('Error obteniendo historial de pagos', error);
    const status = error?.status || 500;
    res.status(status).json({ error: status === 403 ? 'forbidden' : 'Error al obtener historial' });
  }
};

export const getLandlordEarnings = async (req: Request, res: Response) => {
  try {
    const landlordId = req.user?.id;
    if (!landlordId) return res.status(403).json({ error: 'No autorizado' });

    const contracts = await Contract.find({ landlord: landlordId }).select('_id').lean();
    const contractIds = contracts.map(c => c._id);
    if (contractIds.length === 0) {
      return res.json({ totalEarnings: 0, monthEarnings: 0, totalTransactions: 0, chart: [] });
    }

    const allPayments = await Payment.aggregate([
      { $match: { contract: { $in: contractIds }, status: 'succeeded' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthPayments = await Payment.aggregate([
      {
        $match: {
          contract: { $in: contractIds },
          status: 'succeeded',
          paidAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const chartData = await Payment.aggregate([
      {
        $match: {
          contract: { $in: contractIds },
          status: 'succeeded',
          paidAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: { month: { $month: '$paidAt' }, year: { $year: '$paidAt' } },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      totalEarnings: allPayments[0]?.total || 0,
      monthEarnings: monthPayments[0]?.total || 0,
      totalTransactions: allPayments[0]?.count || 0,
      chart: chartData.map(d => ({
        label: `${d._id.month}/${d._id.year}`,
        amount: d.amount,
      })),
    });
  } catch (error) {
    console.error('Error calculando ganancias:', error);
    res.status(500).json({ error: 'Error interno de servidor' });
  }
};

export const exportEarningsReport = async (req: Request, res: Response) => {
  try {
    const landlordId = req.user?.id;
    if (!landlordId) return res.status(403).json({ error: 'No autorizado' });

    const contracts = await Contract.find({ landlord: landlordId }).select('_id propertyAddress tenantName').lean();
    const contractMap = contracts.reduce((acc: Record<string, any>, c: any) => {
      acc[String(c._id)] = c;
      return acc;
    }, {});
    const contractIds = contracts.map(c => c._id);

    const payments = await Payment.find({ contract: { $in: contractIds }, status: 'succeeded' })
      .sort({ paidAt: -1 })
      .lean();

    let csv = 'Fecha,Concepto,Propiedad,Inquilino,Importe (EUR),Estado,ID Transaccion\n';
    payments.forEach(p => {
      const contract = contractMap[String(p.contract)] || {};
      const date = p.paidAt ? new Date(p.paidAt).toLocaleDateString('es-ES') : '-';
      const amount = Number(p.amount || 0).toFixed(2);
      const clean = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
      const cleanConcept = clean(p.concept || '');
      const cleanAddress = clean(contract.propertyAddress || 'Propiedad');
      const cleanTenant = clean(contract.tenantName || 'Inquilino');
      csv += `${date},${cleanConcept},${cleanAddress},${cleanTenant},${amount},Pagado,${p.stripePaymentIntentId || ''}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment(`reporte_ingresos_${new Date().toISOString().slice(0, 10)}.csv`);
    return res.send(csv);
  } catch (error) {
    console.error('Error exportando CSV:', error);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
};

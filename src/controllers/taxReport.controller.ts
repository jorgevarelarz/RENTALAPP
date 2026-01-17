import { Request, Response } from 'express';
import { Payment } from '../models/payment.model';
import PlatformEarning from '../models/platformEarning.model';
import ServiceOffer from '../models/serviceOffer.model';
import { calcPlatformFeeOnRent } from '../utils/rentFees';
import PDFDocument from 'pdfkit';

type TaxReportItem = {
  date: string;
  kind: 'income' | 'expense';
  category: 'rent' | 'service' | 'platform_fee';
  propertyId?: string;
  concept: string;
  gross: number;
  fee: number;
  net: number;
  currency: string;
};

function getYearRange(year: number) {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return { start, end };
}

function round(amount: number) {
  return Math.round(amount * 100) / 100;
}

export async function getTaxReport(req: Request, res: Response) {
  try {
    const user: any = req.user;
    const userId = user?._id ?? user?.id;
    const role = user?.role;
    const year = Number(req.query.year || new Date().getFullYear());
    if (!userId || !['landlord', 'pro'].includes(role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'invalid_year' });
    }

    const { start, end } = getYearRange(year);

    if (role === 'landlord') {
      const rentPayments = await Payment.find({
        payee: userId,
        type: 'rent',
        status: 'succeeded',
        paidAt: { $gte: start, $lte: end },
      })
        .select('amount currency paidAt contract concept')
        .populate('contract', 'property')
        .lean();

      const rentItems: TaxReportItem[] = rentPayments.map((p: any) => {
        const amount = p.amount || 0;
        const fee = calcPlatformFeeOnRent(Math.round(amount * 100)) / 100;
        const propertyId = p.contract?.property ? String(p.contract.property) : undefined;
        return {
          date: (p.paidAt || p.createdAt || new Date()).toISOString(),
          kind: 'income',
          category: 'rent',
          propertyId,
          concept: p.concept || 'Renta',
          gross: round(amount),
          fee: round(fee),
          net: round(amount - fee),
          currency: String(p.currency || 'eur').toUpperCase(),
        };
      });

      const rentIncome = rentItems.reduce((sum, item) => sum + item.gross, 0);
      const platformRentFees = rentItems.reduce((sum, item) => sum + item.fee, 0);

      const serviceOffers = await ServiceOffer.find({
        ownerId: String(userId),
        status: { $in: ['paid', 'confirmed', 'done'] },
        createdAt: { $gte: start, $lte: end },
      })
        .select('_id amount propertyId createdAt title')
        .lean();

      const offerIds = serviceOffers.map(o => String(o._id));
      const serviceFees = offerIds.length
        ? await PlatformEarning.find({ kind: 'service', offerId: { $in: offerIds } })
            .select('offerId fee')
            .lean()
        : [];
      const feeByOffer = new Map<string, number>();
      serviceFees.forEach((f: any) => {
        if (f.offerId) feeByOffer.set(String(f.offerId), f.fee || 0);
      });

      const serviceItems: TaxReportItem[] = serviceOffers.map((o: any) => {
        const fee = feeByOffer.get(String(o._id)) || 0;
        return {
          date: (o.createdAt || new Date()).toISOString(),
          kind: 'expense',
          category: 'service',
          propertyId: o.propertyId ? String(o.propertyId) : undefined,
          concept: o.title || 'Servicio',
          gross: round(o.amount || 0),
          fee: round(fee),
          net: round(-((o.amount || 0) + fee)),
          currency: 'EUR',
        };
      });

      const serviceExpense = serviceItems.reduce((sum, item) => sum + item.gross, 0);
      const platformServiceFees = serviceItems.reduce((sum, item) => sum + item.fee, 0);

      const incomeTotal = round(rentIncome);
      const expensesTotal = round(platformRentFees + serviceExpense + platformServiceFees);
      const items = [...rentItems, ...serviceItems].sort((a, b) => a.date.localeCompare(b.date));

      const byProperty: Record<string, { income: number; expense: number; fees: number; net: number }> = {};
      for (const item of items) {
        const key = item.propertyId || 'unknown';
        if (!byProperty[key]) {
          byProperty[key] = { income: 0, expense: 0, fees: 0, net: 0 };
        }
        if (item.kind === 'income') {
          byProperty[key].income += item.gross;
          byProperty[key].fees += item.fee;
          byProperty[key].net += item.net;
        } else {
          byProperty[key].expense += item.gross;
          byProperty[key].fees += item.fee;
          byProperty[key].net += item.net;
        }
      }

      return res.json({
        year,
        role,
        income: {
          rent: round(rentIncome),
          services: 0,
          total: incomeTotal,
        },
        expenses: {
          platformRentFees: round(platformRentFees),
          serviceExpenses: round(serviceExpense),
          platformServiceFees: round(platformServiceFees),
          total: expensesTotal,
        },
        net: round(incomeTotal - expensesTotal),
        breakdown: {
          rentPayments: rentPayments.length,
          serviceOffers: serviceOffers.length,
        },
        items,
        byProperty,
      });
    }

    const earnings = await PlatformEarning.find({
      kind: 'service',
      proId: String(userId),
      createdAt: { $gte: start, $lte: end },
    })
      .select('gross fee netToPro offerId createdAt')
      .lean();

    const gross = earnings.reduce((sum: number, e: any) => sum + (e.gross || 0), 0);
    const fee = earnings.reduce((sum: number, e: any) => sum + (e.fee || 0), 0);
    const net = earnings.reduce((sum: number, e: any) => sum + (e.netToPro || 0), 0);
    const items: TaxReportItem[] = earnings.map((e: any) => ({
      date: (e.createdAt || new Date()).toISOString(),
      kind: 'income',
      category: 'service',
      concept: e.offerId ? `Servicio ${e.offerId}` : 'Servicio',
      gross: round(e.gross || 0),
      fee: round(e.fee || 0),
      net: round(e.netToPro || 0),
      currency: 'EUR',
    }));

    return res.json({
      year,
      role,
      income: {
        services: round(gross),
        total: round(gross),
      },
      expenses: {
        platformServiceFees: round(fee),
        total: round(fee),
      },
      net: round(net),
      breakdown: {
        servicePayments: earnings.length,
      },
      items,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'tax_report_failed' });
  }
}

async function resolveTaxReportData(req: Request) {
  return new Promise<any>((resolve, reject) => {
    const fakeRes: any = {
      status: (code: number) => ({
        json: (payload: any) =>
          reject(Object.assign(new Error(payload?.error || 'error'), { status: code })),
      }),
      json: (payload: any) => resolve(payload),
    };
    getTaxReport(req, fakeRes as Response).catch(reject);
  });
}

export async function exportTaxReportCsv(req: Request, res: Response) {
  try {
    const data = await resolveTaxReportData(req);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tax-report.csv"');

    const lines = [
      ['date', 'kind', 'category', 'propertyId', 'concept', 'gross', 'fee', 'net', 'currency'],
      ...(data.items || []).map((item: TaxReportItem) => [
        item.date,
        item.kind,
        item.category,
        item.propertyId || '',
        item.concept,
        String(item.gross ?? 0),
        String(item.fee ?? 0),
        String(item.net ?? 0),
        item.currency,
      ]),
    ];

    res.send(lines.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'));
  } catch (error: any) {
    const status = error?.status || 500;
    res.status(status).json({ error: error?.message || 'tax_report_export_failed' });
  }
}

export async function exportTaxReportPdf(req: Request, res: Response) {
  try {
    const data = await resolveTaxReportData(req);
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (d: Buffer) => chunks.push(d));

    doc.fontSize(18).text('RentalApp - Informe fiscal', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Ejercicio: ${data.year}`);
    doc.text(`Rol: ${data.role}`);
    doc.moveDown(0.5);
    doc.text(`Ingresos totales: ${data.income?.total ?? 0} EUR`);
    doc.text(`Gastos totales: ${data.expenses?.total ?? 0} EUR`);
    doc.text(`Neto: ${data.net ?? 0} EUR`);
    doc.moveDown(1);

    if (data.byProperty) {
      doc.fontSize(14).text('Resumen por inmueble', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      for (const [propertyId, summary] of Object.entries<any>(data.byProperty)) {
        doc.text(`- ${propertyId}`);
        doc.text(
          `  Ingresos: ${summary.income.toFixed(2)} | Gastos: ${summary.expense.toFixed(2)} | Comisiones: ${summary.fees.toFixed(2)} | Neto: ${summary.net.toFixed(2)}`,
        );
      }
      doc.moveDown(1);
    }

    doc.fontSize(14).text('Detalle', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);
    for (const item of data.items || []) {
      doc.text(
        `${item.date} | ${item.kind} | ${item.category} | ${item.propertyId || '-'} | ${item.concept} | ${item.gross} | ${item.fee} | ${item.net} ${item.currency}`,
      );
    }

    doc.end();

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="tax-report.pdf"');
    res.send(buffer);
  } catch (error: any) {
    const status = error?.status || 500;
    res.status(status).json({ error: error?.message || 'tax_report_export_failed' });
  }
}

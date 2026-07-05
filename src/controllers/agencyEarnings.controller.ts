import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { Types } from 'mongoose';
import { PartnerEarning } from '../models/partnerEarning.model';
import { User } from '../models/user.model';
import {
  countActiveAgencyContracts,
  nextTierFor,
  parseShareTiers,
  pctForActiveCount,
} from '../services/agencyShare.service';
import { getAgencySharePctFromEnv } from '../utils/partnerEarnings';

function requireAgency(req: Request, res: Response): string | null {
  const u: any = (req as any).user;
  const userId = String(u?.id || u?._id || '');
  if (!userId) { res.status(401).json({ error: 'unauthorized' }); return null; }
  if (u?.role !== 'agency') { res.status(403).json({ error: 'forbidden' }); return null; }
  return userId;
}

function monthRange(month?: string): { from: Date; to: Date; label: string } {
  const now = new Date();
  let year = now.getUTCFullYear();
  let mon = now.getUTCMonth();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    if (m >= 1 && m <= 12) { year = y; mon = m - 1; }
  }
  const from = new Date(Date.UTC(year, mon, 1));
  const to = new Date(Date.UTC(year, mon + 1, 1));
  const label = `${year}-${String(mon + 1).padStart(2, '0')}`;
  return { from, to, label };
}

/** GET /api/agency/earnings/summary — mes actual, tramo vigente y progreso. */
export async function getAgencyEarningsSummary(req: Request, res: Response) {
  const agencyId = requireAgency(req, res);
  if (!agencyId) return;
  const id = new Types.ObjectId(agencyId);
  const { from, to } = monthRange();

  const [monthAgg, historyAgg, activeContracts] = await Promise.all([
    PartnerEarning.aggregate([
      { $match: { agencyId: id, status: 'created', createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: null, cents: { $sum: '$partnerShareCents' }, count: { $sum: 1 } } },
    ]),
    PartnerEarning.aggregate([
      { $match: { agencyId: id, status: 'created' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          cents: { $sum: '$partnerShareCents' },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 12 },
    ]),
    countActiveAgencyContracts(agencyId),
  ]);

  const tiers = parseShareTiers(process.env.AGENCY_SHARE_TIERS);
  const fallbackPct = getAgencySharePctFromEnv();
  const currentPct = tiers.length ? pctForActiveCount(activeContracts, tiers, fallbackPct) : fallbackPct;
  const next = tiers.length ? nextTierFor(activeContracts, tiers) : null;

  return res.json({
    monthCents: monthAgg[0]?.cents || 0,
    monthOperations: monthAgg[0]?.count || 0,
    activeContracts,
    currentPct,
    nextTier: next ? { atCount: next.minCount, pct: next.pct, missing: next.minCount - activeContracts } : null,
    tiers,
    history: historyAgg.map((h: any) => ({ month: h._id, cents: h.cents })).reverse(),
  });
}

/** GET /api/agency/earnings?month=YYYY-MM — movimientos del mes. */
export async function listAgencyEarnings(req: Request, res: Response) {
  const agencyId = requireAgency(req, res);
  if (!agencyId) return;
  const { from, to, label } = monthRange(String(req.query.month || ''));

  const items = await PartnerEarning.find({
    agencyId,
    status: 'created',
    createdAt: { $gte: from, $lt: to },
  })
    .select('contractId propertyId platformFeeCents sharePct partnerShareCents currency createdAt')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  return res.json({
    month: label,
    items: items.map((e: any) => ({
      id: String(e._id),
      contractId: String(e.contractId),
      propertyId: String(e.propertyId),
      platformFeeCents: e.platformFeeCents,
      sharePct: e.sharePct,
      partnerShareCents: e.partnerShareCents,
      currency: e.currency,
      createdAt: e.createdAt,
    })),
  });
}

/** GET /api/agency/earnings/invoice?month=YYYY-MM — autofactura mensual en PDF. */
export async function getAgencyInvoicePdf(req: Request, res: Response) {
  const agencyId = requireAgency(req, res);
  if (!agencyId) return;
  const { from, to, label } = monthRange(String(req.query.month || ''));

  const [agency, items] = await Promise.all([
    User.findById(agencyId).select('name email').lean(),
    PartnerEarning.find({ agencyId, status: 'created', createdAt: { $gte: from, $lt: to } })
      .select('contractId platformFeeCents sharePct partnerShareCents createdAt')
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  const totalCents = items.reduce((acc: number, e: any) => acc + (e.partnerShareCents || 0), 0);
  const eur = (cents: number) => (cents / 100).toFixed(2).replace('.', ',') + ' €';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=autofactura_rentalapp_${label}.pdf`);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  doc.fontSize(16).text('AUTOFACTURA — Comisiones de colaboración', { align: 'left' });
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#555')
    .text(`Periodo: ${label}  ·  Emitida: ${new Date().toISOString().slice(0, 10)}`)
    .text('Emitida por RentalApp en nombre del colaborador conforme al acuerdo de agencia.');
  doc.moveDown(0.8);

  doc.fillColor('#000').fontSize(11).text('Colaborador (agencia)', { underline: true });
  doc.fontSize(10)
    .text(`${(agency as any)?.name || 'Agencia'}`)
    .text(`${(agency as any)?.email || ''}`);
  doc.moveDown(0.8);

  doc.fontSize(11).text('Detalle de comisiones', { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor('#555').text('Fecha          Contrato                              Base (fee plataforma)     %      Comisión');
  doc.moveDown(0.2);
  doc.fillColor('#000');
  if (!items.length) {
    doc.fontSize(10).text('Sin movimientos en el periodo.');
  }
  for (const e of items as any[]) {
    const d = new Date(e.createdAt).toISOString().slice(0, 10);
    doc.fontSize(9).text(
      `${d}     ${String(e.contractId)}     ${eur(e.platformFeeCents)}     ${e.sharePct}%     ${eur(e.partnerShareCents)}`,
    );
  }
  doc.moveDown(0.8);
  doc.fontSize(12).text(`TOTAL: ${eur(totalCents)}`, { align: 'right' });
  doc.moveDown(1.2);
  doc.fontSize(8).fillColor('#777').text(
    'Las comisiones corresponden al porcentaje pactado sobre la comisión de plataforma de los cobros de renta procesados a través de RentalApp para contratos captados o gestionados por el colaborador. Operación sujeta al régimen fiscal aplicable entre las partes.',
  );

  doc.end();
}

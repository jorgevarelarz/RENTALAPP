import { Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models/user.model';
import { Property } from '../models/property.model';
import { Contract } from '../models/contract.model';
import { UserPolicyAcceptance } from '../models/userPolicyAcceptance.model';
import { PolicyVersion } from '../models/policy.model';
import { getAuditStatusStats, getAuditSummary, getWeeklyStats } from '../services/compliance.service';
import jwt from 'jsonwebtoken';
import { auditTrailEvents } from '../events/auditTrail.events';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { generateAuditTrailPdf } from '../services/auditTrailPdf';
import { AdminRequest } from '../models/adminRequest.model';
import { ContractParty } from '../models/contractParty.model';
import { buildComplianceCsv, getComplianceDashboard as getComplianceDashboardData, upsertTensionedArea } from '../modules/rentalPublic';
import { buildSystemEventsCsv, listSystemEvents, listSystemEventsAll } from '../services/systemEvents.service';
import { TensionedArea } from '../modules/rentalPublic/models/tensionedArea.model';

/**
 * Returns aggregate statistics about the platform: total number of users
 * per role, total properties and contracts, and a breakdown of contract
 * statuses. This endpoint is intended for administrators to monitor
 * overall usage.
 */
export const getStats = async (_req: Request, res: Response) => {
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
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo estadísticas', details: error.message });
  }
};

export const listPolicyAcceptances = async (req: Request, res: Response) => {
  try {
    const { userId, policyType, activeOnly } = req.query as {
      userId?: string;
      policyType?: string;
      activeOnly?: string;
    };

    const match: any = {};
    if (userId) match.userId = userId;
    if (policyType) match.policyType = policyType;

    let acceptances = await UserPolicyAcceptance.find(match).sort({ acceptedAt: -1 }).lean();

    if (activeOnly === 'true') {
      const now = new Date();
      const active = await PolicyVersion.find({
        isActive: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      }).lean();
      const activeMap = new Map<string, string>();
      active.forEach(p => activeMap.set(p.policyType, p.version));
      acceptances = acceptances.filter(a => activeMap.get(a.policyType) === a.policyVersion);
    }

    const users = await User.find({ _id: { $in: acceptances.map(a => a.userId) } })
      .select(['email'])
      .lean();
    const userMap = new Map<string, any>();
    users.forEach(u => userMap.set(String(u._id), u));

    const data = acceptances.map(a => ({
      user: { id: String(a.userId), email: userMap.get(String(a.userId))?.email ?? '' },
      policyType: a.policyType,
      policyVersion: a.policyVersion,
      acceptedAt: a.acceptedAt,
      ip: a.ip,
      userAgent: a.userAgent,
    }));

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'compliance_list_failed' });
  }
};

export const listAuditTrails = async (req: Request, res: Response) => {
  try {
    const { userId, dateFrom, dateTo, status, page, pageSize, format } = req.query as {
      userId?: string;
      dateFrom?: string;
      dateTo?: string;
      status?: string;
      page?: string;
      pageSize?: string;
      format?: string;
    };
    const filters = { userId, status, dateFrom, dateTo, page, pageSize };

    if (String(format || '').toLowerCase() === 'csv') {
      const { items } = await getAuditSummary({ ...filters, page: 1, pageSize: 5000 });
      const header = ['contractId', 'userEmail', 'status', 'lastEvent', 'auditHash', 'auditPdfUrl'];
      const rows = items.map(i => [
        i.contractId,
        i.user?.email || '',
        String(i.status || ''),
        i.lastEvent ? new Date(i.lastEvent).toISOString() : '',
        i.auditHash || '',
        i.auditPdfUrl || '',
      ]);
      const csv = [header, ...rows]
        .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-trails.csv"');
      return res.send(csv);
    }

    const [{ items, total, page: p, pageSize: ps }, stats] = await Promise.all([
      getAuditSummary(filters),
      getAuditStatusStats({ userId, dateFrom, dateTo }),
    ]);
    res.json({ data: items, meta: { total, page: p, pageSize: ps }, stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'audit_trails_failed' });
  }
};

export const streamAuditTrails = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'token_required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'insecure') as any;
    if (decoded?.role !== 'admin') return res.status(403).json({ error: 'forbidden' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    (res as any).flushHeaders?.();

    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const onUpdate = (payload: any) => {
      res.write(`event: auditTrailUpdated\ndata: ${JSON.stringify(payload)}\n\n`);
    };
    auditTrailEvents.on('auditTrailUpdated', onUpdate);

    req.on('close', () => {
      auditTrailEvents.off('auditTrailUpdated', onUpdate);
      res.end();
    });
  } catch (e: any) {
    return res.status(401).json({ error: 'invalid_token' });
  }
};

export const exportAuditTrails = async (req: Request, res: Response) => {
  try {
    const format = String((req.query as any).format || '').toLowerCase();
    if (format !== 'zip') return res.status(400).json({ error: 'unsupported_format' });

    const idsRaw = (req.query as any).contractIds;
    const ids: string[] = Array.isArray(idsRaw)
      ? idsRaw.flatMap((v: any) => String(v).split(',').map((s: string) => s.trim()).filter(Boolean))
      : String(idsRaw || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

    if (ids.length === 0) return res.status(400).json({ error: 'contractIds_required' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-trails.zip"');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => {
      console.error('zip export error', err);
      try {
        res.status(500).end();
      } catch {}
    });
    archive.pipe(res);

    for (const contractId of ids.slice(0, 200)) {
      const dir = path.resolve(process.cwd(), 'storage/contracts-audit');
      const abs = path.join(dir, `contract_${contractId}.pdf`);
      if (!fs.existsSync(abs)) {
        try {
          await generateAuditTrailPdf(contractId);
        } catch (e) {
          // Skip if can't generate (missing contract/events)
          continue;
        }
      }
      if (fs.existsSync(abs)) {
        archive.file(abs, { name: `contract_${contractId}.pdf` });
      }
    }

    await archive.finalize();
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'zip_export_failed' });
  }
};

export const listAdminRequests = async (req: Request, res: Response) => {
  try {
    const { type, status } = req.query as { type?: string; status?: string };
    const q: any = {};
    if (type) q.type = type;
    if (status) q.status = status;
    const items = await AdminRequest.find(q).sort({ createdAt: -1 }).lean();
    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'admin_requests_failed' });
  }
};

const tensionedAreaSchema = z.object({
  region: z.string().min(1),
  city: z.string().optional(),
  zoneCode: z.string().optional(),
  areaKey: z.string().optional(),
  source: z.string().min(1),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  active: z.boolean().optional(),
});

export const upsertAdminTensionedArea = async (req: Request, res: Response) => {
  try {
    const payload = tensionedAreaSchema.parse(req.body);
    const saved = await upsertTensionedArea({
      ...payload,
      effectiveTo: payload.effectiveTo ?? undefined,
    });
    res.json({ data: saved });
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ error: 'invalid_payload', details: error.issues });
    }
    res.status(500).json({ error: error?.message || 'tensioned_area_upsert_failed' });
  }
};

export const listTensionedAreas = async (req: Request, res: Response) => {
  try {
    const { areaKey, region, city, active } = req.query as Record<string, string | undefined>;
    const query: any = {};
    if (areaKey) query.areaKey = String(areaKey).trim().toLowerCase();
    if (region) query.region = String(region);
    if (city) query.city = String(city);
    if (active !== undefined) query.active = active === 'true';

    const items = await TensionedArea.find(query).sort({ effectiveFrom: -1 }).lean();
    res.json({ data: items });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'tensioned_area_list_failed' });
  }
};

export const getComplianceDashboard = async (req: Request, res: Response) => {
  try {
    const { page, pageSize, status, areaKey, dateFrom, dateTo } = req.query as {
      page?: string;
      pageSize?: string;
      status?: string;
      areaKey?: string;
      dateFrom?: string;
      dateTo?: string;
    };
    const data = await getComplianceDashboardData({ page, pageSize, status, areaKey, dateFrom, dateTo });
    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'compliance_dashboard_failed' });
  }
};

export const exportComplianceDashboardCsv = async (req: Request, res: Response) => {
  try {
    const { status, areaKey, dateFrom, dateTo } = req.query as {
      status?: string;
      areaKey?: string;
      dateFrom?: string;
      dateTo?: string;
    };
    const data = await getComplianceDashboardData({ status, areaKey, dateFrom, dateTo, includeAll: true });
    const csv = buildComplianceCsv(data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="compliance-dashboard.csv"');
    return res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'compliance_dashboard_export_failed' });
  }
};

export const listSystemEventsAdmin = async (req: Request, res: Response) => {
  try {
    const { type, resourceType, dateFrom, dateTo, page, pageSize } = req.query as {
      type?: string;
      resourceType?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: string;
      pageSize?: string;
    };
    const data = await listSystemEvents({ type, resourceType, dateFrom, dateTo, page, pageSize });
    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'system_events_list_failed' });
  }
};

export const exportSystemEventsCsv = async (req: Request, res: Response) => {
  try {
    const { type, resourceType, dateFrom, dateTo } = req.query as {
      type?: string;
      resourceType?: string;
      dateFrom?: string;
      dateTo?: string;
    };
    const items = await listSystemEventsAll({ type, resourceType, dateFrom, dateTo });
    const csv = buildSystemEventsCsv(items);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="system-events.csv"');
    return res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'system_events_export_failed' });
  }
};

export const decideAdminRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { decision, adminNotes } = req.body || {};
    const reqDoc = await AdminRequest.findById(id);
    if (!reqDoc) return res.status(404).json({ error: 'request_not_found' });
    if (reqDoc.status !== 'OPEN' && reqDoc.status !== 'IN_REVIEW') {
      return res.status(400).json({ error: 'request_not_open' });
    }

    const party = await ContractParty.findById(reqDoc.targetPartyId);
    if (!party) return res.status(404).json({ error: 'party_not_found' });

    if (decision === 'approve') {
      party.status = 'REMOVED';
      await party.save();
      reqDoc.status = 'COMPLETED';
      reqDoc.adminNotes = adminNotes;
      await reqDoc.save();
      return res.json({ ok: true, status: reqDoc.status });
    }
    if (decision === 'reject') {
      if (party.status === 'REMOVED_PENDING_ADMIN') {
        party.status = party.signedAt ? 'SIGNED' : 'JOINED';
        await party.save();
      }
      reqDoc.status = 'REJECTED';
      reqDoc.adminNotes = adminNotes;
      await reqDoc.save();
      return res.json({ ok: true, status: reqDoc.status });
    }
    return res.status(400).json({ error: 'invalid_decision' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'admin_decision_failed' });
  }
};

export const listWeeklyStats = async (req: Request, res: Response) => {
  try {
    const weeks = Number(req.query.weeks || 12);
    const data = await getWeeklyStats(Number.isNaN(weeks) ? 12 : weeks);
    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'weekly_stats_failed' });
  }
};

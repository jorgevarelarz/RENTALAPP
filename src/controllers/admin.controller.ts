import { Request, Response } from 'express';
import { User } from '../models/user.model';
import { Property } from '../models/property.model';
import { Contract } from '../models/contract.model';
import { UserPolicyAcceptance } from '../models/userPolicyAcceptance.model';
import { PolicyVersion } from '../models/policy.model';
import { getAuditStatusStats, getAuditSummary } from '../services/compliance.service';
import jwt from 'jsonwebtoken';
import { auditTrailEvents } from '../events/auditTrail.events';

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
    const token = String((req.query as any).token || '');
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

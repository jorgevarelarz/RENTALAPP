import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { Types } from 'mongoose';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/user.model';
import { deleteTP, readDecryptedTP, TENANT_PRO_DIR } from '../services/tenantProStorage';
import { notifyTenantProDecision } from '../utils/notification';

const router = Router();

// Tope de cordura para la renta máxima validada (€/mes)
const MAX_RENT_LIMIT = 100000;

function invalidUserId(userId: string) {
  return !Types.ObjectId.isValid(userId);
}

// Los ficheros se guardan cifrados sin el tipo; se reconoce por la cabecera.
function sniffMime(buf: Buffer): string | null {
  if (buf.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}

router.get(
  '/tenant-pro/pending',
  authenticate,
  authorizeRoles('admin'),
  asyncHandler(async (_req, res) => {
    const users: any[] = await User.find({ 'tenantPro.status': 'pending' })
      .select('name email createdAt tenantPro')
      .sort({ updatedAt: 1 })
      .lean();
    // Sin el nombre del fichero cifrado, el hash ni el historial de purgas
    res.json(
      users.map((u) => {
        const { auditTrail, docs, ...tenantPro } = u.tenantPro || {};
        return {
          _id: u._id,
          name: u.name,
          email: u.email,
          createdAt: u.createdAt,
          tenantPro: {
            ...tenantPro,
            docs: (docs || []).map(({ url, hash, reviewer, ...doc }: any) => ({ ...doc, available: !!url && !doc.archivedAt })),
          },
        };
      }),
    );
  }),
);

// El administrador abre el documento para revisarlo. Se descifra al vuelo y no se cachea.
router.get(
  '/tenant-pro/:userId/docs/:docId',
  authenticate,
  authorizeRoles('admin'),
  asyncHandler(async (req, res) => {
    const { userId, docId } = req.params;
    if (invalidUserId(userId) || !Types.ObjectId.isValid(docId)) return res.status(400).json({ error: 'invalid_id' });
    const user: any = await User.findById(userId).select('tenantPro.docs').lean();
    const doc = user?.tenantPro?.docs?.find((d: any) => String(d._id) === docId);
    if (!doc) return res.status(404).json({ error: 'doc_not_found' });
    if (!doc.url || doc.archivedAt) return res.status(410).json({ error: 'doc_purged' });
    const file = path.basename(String(doc.url));
    if (!fs.existsSync(path.join(TENANT_PRO_DIR, file))) return res.status(410).json({ error: 'doc_purged' });
    const buf = readDecryptedTP(file);
    const mime = sniffMime(buf);
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    });
    if (!mime) {
      res.set('Content-Disposition', `attachment; filename="tenant-pro-${doc.type}-${docId}.bin"`);
      return res.type('application/octet-stream').send(buf);
    }
    const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg';
    res.set('Content-Disposition', `inline; filename="tenant-pro-${doc.type}-${docId}.${ext}"`);
    res.type(mime).send(buf);
  }),
);

router.post(
  '/tenant-pro/:userId/decision',
  authenticate,
  authorizeRoles('admin'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { decision, maxRent } = (req.body || {}) as { decision?: unknown; maxRent?: unknown };
    if (invalidUserId(userId)) return res.status(400).json({ error: 'invalid_user_id' });
    if (decision !== 'approved' && decision !== 'rejected') return res.status(400).json({ error: 'invalid_decision' });
    // Aprobar sin renta máxima dejaba al inquilino «verificado» sin cifra (0 = sin dato en el chat)
    const amount = Number(maxRent);
    if (decision === 'approved' && !(Number.isFinite(amount) && amount > 0 && amount <= MAX_RENT_LIMIT)) {
      return res.status(400).json({ error: 'invalid_max_rent' });
    }
    const user = (await User.findById(userId)) as any;
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    // Solo se decide sobre una solicitud pendiente (un doble clic no reescribe la anterior)
    if (user.tenantPro?.status !== 'pending') return res.status(409).json({ error: 'not_pending' });

    const reviewerId = (req as any).user?.id || (req as any).user?._id;
    const now = new Date();

    if (decision === 'approved') {
      user.tenantPro.status = 'verified';
      user.tenantPro.isActive = true;
      user.tenantPro.maxRent = Math.round(amount);
      user.tenantPro.docs.forEach((doc: any) => {
        if (doc.status === 'pending') doc.status = 'approved';
        doc.reviewedAt = now;
        (doc as any).reviewer = reviewerId;
      });
    } else {
      user.tenantPro.status = 'rejected';
      user.tenantPro.isActive = false;
      user.tenantPro.maxRent = 0;
      user.tenantPro.docs.forEach((doc: any) => {
        if (doc.status === 'pending') doc.status = 'rejected';
        doc.reviewedAt = now;
        (doc as any).reviewer = reviewerId;
      });
    }
    user.tenantPro.lastDecisionAt = now;
    await user.save();
    notifyTenantProDecision(user.email, decision).catch(err => {
      console.error('No se pudo enviar la notificación Tenant PRO:', err);
    });
    res.json({ ok: true });
  }),
);

router.post(
  '/tenant-pro/:userId/purge',
  authenticate,
  authorizeRoles('admin'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (invalidUserId(userId)) return res.status(400).json({ error: 'invalid_user_id' });
    const user = (await User.findById(userId)) as any;
    if (!user) return res.status(404).json({ error: 'user_not_found' });
    for (const doc of user.tenantPro.docs || []) {
      deleteTP(doc.url as any);
    }
    user.tenantPro = {
      isActive: false,
      maxRent: 0,
      status: 'none',
      docs: [],
      auditTrail: [],
      consentAccepted: false,
    } as any;
    await user.save();
    res.json({ ok: true });
  }),
);

export default router;

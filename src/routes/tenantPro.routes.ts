import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/user.model';
import { ensureTenantProDir, encryptAndSaveTP } from '../services/tenantProStorage';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    const err: any = new Error('unsupported_mime');
    err.code = 'UNSUPPORTED_MIME';
    return cb(err);
  },
});
ensureTenantProDir();

const ConsentSchema = z.object({ consent: z.literal(true), version: z.string().min(1) });

router.post(
  '/tenant-pro/consent',
  authenticate,
  authorizeRoles('tenant'),
  asyncHandler(async (req, res) => {
    const parsed = ConsentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const u = (await User.findById((req as any).user?.id || (req as any).user?._id)) as any;
    if (!u) return res.sendStatus(404);
    u.tenantPro = u.tenantPro || ({} as any);
    u.tenantPro.consentAccepted = true;
    u.tenantPro.consentTextVersion = parsed.data.version;
    u.tenantPro.consentAcceptedAt = new Date();
    await u.save();
    res.json({ ok: true });
  }),
);

router.post(
  '/tenant-pro/docs',
  authenticate,
  authorizeRoles('tenant'),
  // Wrap multer to normalize errors
  (req, res, next) => {
    (upload.single('file') as any)(req, res, (err: any) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ code: 'file_too_large', message: 'Archivo demasiado grande (máx 10 MB).' });
      }
      if (err.code === 'UNSUPPORTED_MIME') {
        return res.status(400).json({ code: 'unsupported_mime', message: 'Formato no permitido. Sube PDF, JPG o PNG.' });
      }
      return res.status(400).json({ code: 'upload_error', message: err.message || 'Upload error' });
    });
  },
  asyncHandler(async (req, res) => {
    const fileUpload = (req as any).file as { originalname: string; buffer: Buffer } | undefined;
    if (!fileUpload) return res.status(400).json({ code: 'file_required', message: 'Archivo requerido' });
    const type = ((req as any).body?.type) as string | undefined;
    if (!type || !['nomina', 'contrato', 'renta', 'autonomo', 'otros'].includes(type)) {
      return res.status(400).json({ code: 'bad_type', message: 'Tipo de documento inválido' });
    }
    const u = (await User.findById((req as any).user?.id || (req as any).user?._id)) as any;
    if (!u) return res.sendStatus(404);
    if (!u.tenantPro?.consentAccepted) {
      return res.status(409).json({ error: 'consent required' });
    }
    const hash = crypto.createHash('sha256').update(fileUpload.buffer).digest('hex');
    const file = encryptAndSaveTP(fileUpload.originalname, fileUpload.buffer);
    u.tenantPro.status = 'pending';
    u.tenantPro.docs = u.tenantPro.docs || [];
    u.tenantPro.docs.push({
      type,
      url: file,
      status: 'pending',
      uploadedAt: new Date(),
      hash,
    } as any);
    await u.save();
    res.json({ ok: true });
  }),
);

router.get(
  '/tenant-pro/me',
  authenticate,
  authorizeRoles('tenant'),
  asyncHandler(async (req, res) => {
    const u: any = await User.findById((req as any).user?.id || (req as any).user?._id)
      .select('email tenantPro')
      .lean();
    if (!u) return res.sendStatus(404);
    const ttlDays = parseInt(String(process.env.TENANT_PRO_DOCS_TTL_DAYS || '365')) || 365;
    res.json({ ...(u.tenantPro || {}), ttlDays });
  }),
);

export default router;

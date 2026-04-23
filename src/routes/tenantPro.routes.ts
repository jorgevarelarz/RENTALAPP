import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/user.model';
import { ensureTenantProDir, encryptAndSaveTP } from '../services/tenantProStorage';

const router = Router();

type MulterError = { code?: string; message?: string };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    const err = Object.assign(new Error('unsupported_mime'), { code: 'UNSUPPORTED_MIME' });
    return cb(err);
  },
});
ensureTenantProDir();

const ConsentSchema = z.object({ consent: z.literal(true), version: z.string().min(1) });

const DOC_TYPES = ['nomina', 'contrato', 'renta', 'autonomo', 'otros'] as const;
type DocType = typeof DOC_TYPES[number];

router.post(
  '/tenant-pro/consent',
  authenticate,
  authorizeRoles('tenant'),
  asyncHandler(async (req, res) => {
    const parsed = ConsentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const userId = req.user?.id ?? req.user?._id;
    const u = await User.findById(userId) as (typeof User extends { new(): infer T } ? T : never) | null;
    if (!u) return res.sendStatus(404);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tp = (u as any).tenantPro ?? {};
    tp.consentAccepted = true;
    tp.consentTextVersion = parsed.data.version;
    tp.consentAcceptedAt = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (u as any).tenantPro = tp;
    await u.save();
    res.json({ ok: true });
  }),
);

router.post(
  '/tenant-pro/docs',
  authenticate,
  authorizeRoles('tenant'),
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (!err) return next();
      const multerErr = err as MulterError;
      if (multerErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ code: 'file_too_large', message: 'Archivo demasiado grande (máx 10 MB).' });
      }
      if (multerErr.code === 'UNSUPPORTED_MIME') {
        return res.status(400).json({ code: 'unsupported_mime', message: 'Formato no permitido. Sube PDF, JPG o PNG.' });
      }
      return res.status(400).json({ code: 'upload_error', message: multerErr.message ?? 'Upload error' });
    });
  },
  asyncHandler(async (req, res) => {
    const fileUpload = req.file;
    if (!fileUpload) return res.status(400).json({ code: 'file_required', message: 'Archivo requerido' });

    // Deep file-type check: validate actual file magic bytes, not just the declared MIME
    const ALLOWED_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    try {
      const ftMod = await import('file-type') as {
        fileTypeFromBuffer?: (buf: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
        fromBuffer?: (buf: Buffer) => Promise<{ mime: string; ext: string } | undefined>;
        default?: { fromBuffer?: (buf: Buffer) => Promise<{ mime: string; ext: string } | undefined> };
      };
      const fileTypeFromBuffer = ftMod.fileTypeFromBuffer ?? ftMod.fromBuffer ?? ftMod.default?.fromBuffer;
      if (typeof fileTypeFromBuffer === 'function') {
        const detected = await fileTypeFromBuffer(fileUpload.buffer);
        if (!detected || !ALLOWED_MIMES.has(detected.mime)) {
          return res.status(415).json({ code: 'unsupported_mime', message: 'Tipo de archivo no permitido.' });
        }
      }
    } catch {
      // If file-type fails to load, continue with multer's MIME check
    }

    const type = req.body?.type as string | undefined;
    if (!type || !(DOC_TYPES as readonly string[]).includes(type)) {
      return res.status(400).json({ code: 'bad_type', message: 'Tipo de documento inválido' });
    }
    const userId = req.user?.id ?? req.user?._id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = await User.findById(userId) as any;
    if (!u) return res.sendStatus(404);
    if (!u.tenantPro?.consentAccepted) {
      return res.status(409).json({ error: 'consent required' });
    }
    const hash = crypto.createHash('sha256').update(fileUpload.buffer).digest('hex');
    const filePath = encryptAndSaveTP(fileUpload.originalname, fileUpload.buffer);
    u.tenantPro.status = 'pending';
    u.tenantPro.docs = u.tenantPro.docs ?? [];
    u.tenantPro.docs.push({ type: type as DocType, url: filePath, status: 'pending', uploadedAt: new Date(), hash });
    await u.save();
    res.json({ ok: true });
  }),
);

router.get(
  '/tenant-pro/me',
  authenticate,
  authorizeRoles('tenant'),
  asyncHandler(async (req, res) => {
    const userId = req.user?.id ?? req.user?._id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = await User.findById(userId).select('email tenantPro').lean() as any;
    if (!u) return res.sendStatus(404);
    const ttlDays = parseInt(String(process.env.TENANT_PRO_DOCS_TTL_DAYS ?? '365')) || 365;
    res.json({ ...(u.tenantPro ?? {}), ttlDays });
  }),
);

export default router;

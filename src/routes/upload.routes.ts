import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();

// Ensure upload directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const ALLOWED_EXT = new Set(['jpg', 'png', 'webp', 'pdf']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const name = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    cb(null, name);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ok = ALLOWED_MIME.has(file.mimetype);
  if (ok) cb(null, true);
  else cb(new Error('invalid_file_type'));
}

// 10MB por archivo; hasta 6 archivos
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
});

// POST /api/uploads/images
router.post('/uploads/images', authenticate, (req: Request, res: Response) => {
  upload.array('files', 6)(req, res, (err: unknown) => {
    if (err) {
      const multerErr = err as { message?: string };
      const code = multerErr?.message === 'invalid_file_type' ? 415 : 400;
      return res.status(code).json({ error: multerErr.message || 'upload_error' });
    }
    const files = (req.files as Express.Multer.File[]) ?? [];
    void (async () => {
      try {
        const mod = await import('file-type') as {
          fileTypeFromFile?: (p: string) => Promise<{ mime: string; ext: string } | undefined>;
          fromFile?: (p: string) => Promise<{ mime: string; ext: string } | undefined>;
          default?: { fromFile?: (p: string) => Promise<{ mime: string; ext: string } | undefined> };
        };
        const fileTypeFromFile = mod.fileTypeFromFile ?? mod.fromFile ?? mod.default?.fromFile;
        if (typeof fileTypeFromFile !== 'function') {
          throw new Error('file_type_unavailable');
        }
        const renamed: string[] = [];
        for (const file of files) {
          const detected = await fileTypeFromFile(file.path);
          if (!detected || !ALLOWED_MIME.has(detected.mime) || !ALLOWED_EXT.has(detected.ext)) {
            await fs.promises.unlink(file.path);
            return res.status(415).json({ error: 'invalid_file_type' });
          }
          const targetName = `${path.basename(file.path)}.${detected.ext}`;
          const targetPath = path.join(UPLOAD_DIR, targetName);
          await fs.promises.rename(file.path, targetPath);
          renamed.push(targetName);
        }
        const base = process.env.APP_URL?.replace(/\/$/, '') ?? '';
        const urls = renamed.map(name => `${base}/uploads/${name}`);
        res.json({ urls });
      } catch (error: unknown) {
        logger.error('upload_error', { message: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ error: 'upload_error' });
      }
    })();
  });
});

export default router;

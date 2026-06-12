import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Ensure upload directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const ALLOWED_EXT = new Set(['jpg', 'png', 'webp', 'pdf']);

async function detectFileType(filePath: string): Promise<{ mime: string; ext: string } | undefined> {
  try {
    const mod: any = await import('file-type');
    const fileTypeFromFile =
      mod.fileTypeFromFile || mod.fromFile || mod.default?.fromFile;
    if (typeof fileTypeFromFile === 'function') {
      return fileTypeFromFile(filePath);
    }
  } catch {
    // Jest/CommonJS can fail to resolve ESM-only file-type. Fall through to
    // a minimal signature check so invalid uploads still fail closed.
  }

  const header = await fs.promises.readFile(filePath).then(buffer => buffer.subarray(0, 16));
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (header.length >= 12 && header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (header.length >= 4 && header.subarray(0, 4).toString() === '%PDF') {
    return { mime: 'application/pdf', ext: 'pdf' };
  }
  return undefined;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const name = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    cb(null, name);
  },
});

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
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
router.post('/uploads/images', authenticate as any, (req, res) => {
  upload.array('files', 6)(req as any, res as any, (err: any) => {
    if (err) {
      const code = err?.message === 'invalid_file_type' ? 415 : 400;
      return res.status(code).json({ error: err.message || 'upload_error' });
    }
    const files = ((req as any).files as Express.Multer.File[]) || [];
    void (async () => {
      try {
        const renamed: string[] = [];
        for (const file of files) {
          const detected = await detectFileType(file.path);
          if (!detected || !ALLOWED_MIME.has(detected.mime) || !ALLOWED_EXT.has(detected.ext)) {
            await fs.promises.unlink(file.path);
            return res.status(415).json({ error: 'invalid_file_type' });
          }
          const targetName = `${path.basename(file.path)}.${detected.ext}`;
          const targetPath = path.join(UPLOAD_DIR, targetName);
          await fs.promises.rename(file.path, targetPath);
          renamed.push(targetName);
        }
        const base = process.env.APP_URL?.replace(/\/$/, '') || '';
        const urls = renamed.map(name => `${base}/uploads/${name}`);
        res.json({ urls });
      } catch (error: any) {
        console.error('upload_error', error);
        res.status(500).json({ error: 'upload_error' });
      }
    })();
  });
});

export default router;

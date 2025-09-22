import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Ensure upload directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    const name = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
  if (ok) cb(null, true);
  else cb(new Error('invalid_file_type'));
}

// 10MB por archivo; hasta 6 archivos
const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/uploads/images
router.post('/uploads/images', authenticate as any, (req, res) => {
  upload.array('files', 6)(req as any, res as any, (err: any) => {
    if (err) {
      const code = err?.message === 'invalid_file_type' ? 400 : 400;
      return res.status(code).json({ error: err.message || 'upload_error' });
    }
  const files = ((req as any).files as Express.Multer.File[]) || [];
  const base = process.env.APP_URL?.replace(/\/$/, '') || '';
  const urls = files.map(f => `${base}/uploads/${path.basename(f.path)}`);
  res.json({ urls });
});
});

export default router;

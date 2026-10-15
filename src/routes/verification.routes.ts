import { Router } from 'express';
import mongoose from 'mongoose';
import { Verification } from '../models/verification.model';
import { User } from '../models/user.model';
import { getUserId } from '../utils/getUserId';
import { requireAdmin } from '../middleware/requireAdmin';
import { sendRouteError } from '../utils/routeError';
import { isOwnUploadUrl } from '../utils/uploadUrl';

// app.ts monta este router detrás de authenticate: todas las rutas exigen sesión.
const router = Router();

const METHODS = ['dni', 'nie', 'passport'];
const FILE_KEYS = ['idFrontUrl', 'idBackUrl', 'selfieUrl'];
const MAX_NOTES = 500;

// Documentos de identidad: solo ficheros subidos con /api/uploads/images, nunca URLs ajenas
function parseFiles(raw: unknown): Record<string, string> | null {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!FILE_KEYS.includes(key)) return null;
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string' || !isOwnUploadUrl(value)) return null;
    out[key] = value;
  }
  return out;
}

// La revisión es sobre una cuenta que existe: un ID cualquiera ya no crea registros sueltos
async function findTargetUser(userId: string) {
  if (!mongoose.isValidObjectId(userId)) return null;
  return User.exists({ _id: userId });
}

// Retrieve current verification status for the authenticated user
router.get('/me', async (req, res) => {
  try {
    const userId = getUserId(req);
    const v = await Verification.findOne({ userId }).lean();
    if (!v) return res.json({ status: 'unverified' });
    res.json(v);
  } catch (err: any) {
    sendRouteError(res, err, 'verification_request_failed');
  }
});

// Submit verification data by the user
router.post('/submit', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { method, files } = req.body || {};
    if (!METHODS.includes(method)) return res.status(400).json({ error: 'invalid_method' });
    const parsedFiles = parseFiles(files);
    if (!parsedFiles) return res.status(400).json({ error: 'invalid_files' });
    // Volver a enviar no puede quitar una verificación ya aprobada
    const current = await Verification.findOne({ userId }).select('status').lean();
    if (current?.status === 'verified') return res.status(409).json({ error: 'already_verified' });
    const v = await Verification.findOneAndUpdate(
      { userId },
      { $set: { method, files: parsedFiles, status: 'pending', notes: '' } },
      { new: true, upsert: true, runValidators: true },
    );
    res.status(201).json(v);
  } catch (err: any) {
    sendRouteError(res, err, 'verification_request_failed');
  }
});

// Admin approves verification for a user
router.post('/:userId/approve', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!(await findTargetUser(userId))) return res.status(404).json({ error: 'user_not_found' });
    const v = await Verification.findOneAndUpdate(
      { userId },
      { $set: { status: 'verified', notes: '' } },
      { new: true, upsert: true },
    );
    res.json(v);
  } catch (err: any) {
    sendRouteError(res, err, 'verification_request_failed');
  }
});

// Admin rejects verification for a user with notes
router.post('/:userId/reject', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { notes } = req.body || {};
    if (notes !== undefined && (typeof notes !== 'string' || notes.length > MAX_NOTES)) {
      return res.status(400).json({ error: 'invalid_notes' });
    }
    if (!(await findTargetUser(userId))) return res.status(404).json({ error: 'user_not_found' });
    const v = await Verification.findOneAndUpdate(
      { userId },
      { $set: { status: 'rejected', notes: (notes || '').trim() } },
      { new: true, upsert: true },
    );
    res.json(v);
  } catch (err: any) {
    sendRouteError(res, err, 'verification_request_failed');
  }
});

// Dev helper: instantly verify current user if ALLOW_UNVERIFIED=true (non-prod)
router.post('/dev/verify', async (req, res) => {
  if (!(process.env.ALLOW_UNVERIFIED === 'true' && process.env.NODE_ENV !== 'production')) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const userId = getUserId(req);
    const v = await Verification.findOneAndUpdate(
      { userId },
      { $set: { status: 'verified' } },
      { upsert: true, new: true },
    );
    res.json(v);
  } catch (err: any) {
    sendRouteError(res, err, 'verification_request_failed');
  }
});

export default router;

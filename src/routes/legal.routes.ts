import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { body, param } from 'express-validator';
import logger from '../utils/logger';
import { LegalDocument, LegalSlug } from '../models/legalDocument.model';
import asyncHandler from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';
import { requireVerified } from '../middleware/requireVerified';
import { requireAdmin } from '../middleware/requireAdmin';
import { validate } from '../middleware/validate';
import { getUserId } from '../utils/getUserId';
import { User } from '../models/user.model';

const router = Router();

const termsVersion = process.env.TERMS_VERSION || 'v1';
const privacyVersion = process.env.PRIVACY_VERSION || 'v1';
const tenantProConsentVersion = process.env.TENANT_PRO_CONSENT_VERSION || 'v1';

const fallbackVersions: Record<LegalSlug, string> = {
  terms: termsVersion,
  privacy: privacyVersion,
  'tenant-pro-consent': tenantProConsentVersion,
};

const legalSlugs: LegalSlug[] = ['terms', 'privacy', 'tenant-pro-consent'];

function readLegalDocument(slug: LegalSlug, version: string) {
  const filePath = path.resolve(process.cwd(), `legal/${slug}_${version}.md`);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    logger.error({ err: error, slug, version }, '[legal] No se pudo leer documento legal');
    return null;
  }
}

async function getLatestLegalDoc(slug: LegalSlug) {
  const doc = await LegalDocument.findOne({ slug }).sort({ createdAt: -1 }).lean();
  if (doc) return doc;

  const fallbackVersion = fallbackVersions[slug];
  const content = readLegalDocument(slug, fallbackVersion);
  if (!content) return null;
  return { slug, version: fallbackVersion, content };
}

function getAcceptanceFields(slug: LegalSlug) {
  if (slug === 'terms') {
    return { acceptedAtField: 'termsAcceptedAt', versionField: 'termsVersionAccepted', legalVersion: true } as const;
  }
  if (slug === 'privacy') {
    return { acceptedAtField: 'privacyAcceptedAt', versionField: 'privacyVersionAccepted', legalVersion: false } as const;
  }
  return null;
}

router.get(
  '/legal/:slug',
  [param('slug').isIn(legalSlugs).withMessage('slug_invalid')],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const slug = req.params.slug as LegalSlug;
    const doc = await getLatestLegalDoc(slug);
    if (!doc) {
      return res.status(404).json({ error: 'legal-text-unavailable', slug });
    }
    res.json(doc);
  }),
);

router.use('/legal/admin', authenticate as any, requireVerified as any, requireAdmin as any);

router.get(
  '/legal/status',
  authenticate as any,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const user: any = await User.findById(userId)
      .select('termsAcceptedAt termsVersionAccepted privacyAcceptedAt privacyVersionAccepted legalVersion')
      .lean();

    const [termsDoc, privacyDoc] = await Promise.all([getLatestLegalDoc('terms'), getLatestLegalDoc('privacy')]);

    res.json({
      terms: {
        latest: termsDoc,
        acceptedVersion: user?.termsVersionAccepted || null,
        acceptedAt: user?.termsAcceptedAt || null,
      },
      privacy: {
        latest: privacyDoc,
        acceptedVersion: user?.privacyVersionAccepted || null,
        acceptedAt: user?.privacyAcceptedAt || null,
      },
    });
  }),
);

router.get(
  '/legal/admin/:slug',
  [param('slug').isIn(legalSlugs).withMessage('slug_invalid')],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const slug = req.params.slug as LegalSlug;
    const docs = await LegalDocument.find({ slug })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ items: docs });
  }),
);

router.post(
  '/legal/admin/:slug',
  [
    param('slug').isIn(legalSlugs).withMessage('slug_invalid'),
    body('version').isString().trim().isLength({ min: 1, max: 32 }).withMessage('version_invalid'),
    body('content').isString().trim().isLength({ min: 10 }).withMessage('content_invalid'),
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    const slug = req.params.slug as LegalSlug;
    const { version, content } = req.body as { version: string; content: string };
    const createdBy = getUserId(req);

    const doc = await LegalDocument.create({ slug, version, content, createdBy });
    res.status(201).json({ ok: true, doc });
  }),
);

router.post(
  '/legal/accept',
  [
    body('slug').isIn(['terms', 'privacy']).withMessage('slug_invalid'),
    body('version').isString().trim().isLength({ min: 1, max: 64 }).withMessage('version_invalid'),
  ],
  validate,
  authenticate as any,
  asyncHandler(async (req: Request, res: Response) => {
    const slug = req.body.slug as LegalSlug;
    const version = String(req.body.version);
    const userId = getUserId(req);

    const latest = await getLatestLegalDoc(slug);
    if (!latest) {
      return res.status(400).json({ error: 'legal-text-unavailable', slug });
    }
    if (latest.version !== version) {
      return res.status(409).json({ error: 'outdated_version', expected: latest.version, received: version });
    }

    const fields = getAcceptanceFields(slug);
    if (!fields) {
      return res.status(400).json({ error: 'unsupported_slug' });
    }

    const update: Record<string, any> = {
      [fields.acceptedAtField]: new Date(),
      [fields.versionField]: version,
    };
    if (fields.legalVersion) {
      update.legalVersion = version;
    }

    await User.findByIdAndUpdate(userId, { $set: update }, { new: true });

    res.json({ ok: true, slug, version });
  }),
);

export default router;

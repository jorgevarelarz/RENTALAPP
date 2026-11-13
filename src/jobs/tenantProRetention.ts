import cron from 'node-cron';
import { User } from '../models/user.model';
import { deleteTP } from '../services/tenantProStorage';
import { logger } from '../utils/logger';

const DEFAULT_TTL_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

export function tenantProDocsTtlDays() {
  const days = Number(process.env.TENANT_PRO_DOCS_TTL_DAYS);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_TTL_DAYS;
}

/**
 * Borra los documentos Tenant PRO subidos hace más de TENANT_PRO_DOCS_TTL_DAYS
 * (365 por defecto), como promete la política de privacidad. Del documento solo
 * queda en `auditTrail` el tipo, el hash y la revisión. Un usuario que falla no
 * detiene a los demás.
 */
export async function purgeOldTenantProDocs(now = new Date()) {
  const cutoff = new Date(now.getTime() - tenantProDocsTtlDays() * DAY_MS);
  const summary = { users: 0, docs: 0, failed: 0 };

  const cursor = User.find({ 'tenantPro.docs': { $elemMatch: { uploadedAt: { $lt: cutoff } } } })
    .select('tenantPro.docs')
    .lean()
    .cursor();

  for await (const user of cursor as AsyncIterable<any>) {
    const expired = (user.tenantPro?.docs || []).filter(
      (doc: any) => doc.uploadedAt && new Date(doc.uploadedAt) < cutoff,
    );
    if (!expired.length) continue;
    try {
      // Primero el fichero: si falla la base, el siguiente pase lo reintenta y
      // no queda un documento cifrado huérfano que nadie vaya a borrar.
      for (const doc of expired) {
        if (doc.url) deleteTP(String(doc.url));
      }
      await User.updateOne(
        { _id: user._id },
        {
          $pull: { 'tenantPro.docs': { _id: { $in: expired.map((doc: any) => doc._id) } } },
          $push: {
            'tenantPro.auditTrail': {
              $each: expired.map((doc: any) => ({
                type: doc.type,
                hash: doc.hash,
                status: doc.status,
                reviewedAt: doc.reviewedAt,
                archivedAt: now,
              })),
            },
          },
        },
      );
      summary.users += 1;
      summary.docs += expired.length;
    } catch (err) {
      summary.failed += 1;
      logger.error({ type: 'tenant_pro_retention_error', userId: String(user._id), err }, 'Purga Tenant PRO fallida');
    }
  }

  return summary;
}

export const runTenantProRetention = async () => {
  try {
    const summary = await purgeOldTenantProDocs();
    logger.info({ type: 'tenant_pro_retention', ...summary }, 'Purga de documentos Tenant PRO');
  } catch (err) {
    logger.error({ type: 'tenant_pro_retention_error', err }, 'Purga Tenant PRO fallida');
  }
};

export const startTenantProRetentionJob = () => {
  // Diario a las 03:45 (hora del servidor)
  cron.schedule('45 3 * * *', runTenantProRetention);
};

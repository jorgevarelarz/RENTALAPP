import { addDays, isAfter } from 'date-fns';
import { User } from '../models/user.model';
import { deleteTP } from '../services/tenantProStorage';

const TTL = Number(process.env.TENANT_PRO_DOCS_TTL_DAYS || 365);

export async function purgeOldTenantProDocs() {
  const users = await User.find({ 'tenantPro.docs.0': { $exists: true } });
  const promises = [];
  for (const user of users as any[]) {
    let updated = false;
    const keep: any[] = [];
    const auditTrail = user.tenantPro.auditTrail || [];
    for (const doc of user.tenantPro.docs) {
      const uploadedAt = doc.uploadedAt || new Date();
      const expiry = addDays(uploadedAt, TTL);
      if (isAfter(new Date(), expiry)) {
        if (doc.url) {
          deleteTP(doc.url as any);
        }
        auditTrail.push({
          type: doc.type,
          hash: doc.hash,
          status: doc.status,
          reviewedAt: doc.reviewedAt,
          archivedAt: new Date(),
        });
        updated = true;
      } else {
        keep.push(doc);
      }
    }
    if (updated) {
      user.tenantPro.docs = keep as any;
      user.tenantPro.auditTrail = auditTrail;
      promises.push(user.save());
    }
  }
  await Promise.all(promises);
}

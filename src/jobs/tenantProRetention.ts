import { addDays, isAfter } from 'date-fns';
import { User } from '../models/user.model';
import { deleteTP } from '../services/tenantProStorage';

const TTL = Number(process.env.TENANT_PRO_DOCS_TTL_DAYS || 365);

export async function purgeOldTenantProDocs() {
  const users = await User.find({ 'tenantPro.docs.0': { $exists: true } });
  for (const user of users as any[]) {
    const keep: any[] = [];
    for (const doc of user.tenantPro.docs) {
      const uploadedAt = doc.uploadedAt || new Date();
      const expiry = addDays(uploadedAt, TTL);
      if (isAfter(new Date(), expiry)) {
        deleteTP(doc.url as any);
      } else {
        keep.push(doc);
      }
    }
    if (keep.length !== user.tenantPro.docs.length) {
      user.tenantPro.docs = keep as any;
      await user.save();
    }
  }
}

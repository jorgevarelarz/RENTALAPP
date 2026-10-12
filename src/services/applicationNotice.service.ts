import { Application } from '../models/application.model';
import { Property } from '../models/property.model';
import { User } from '../models/user.model';
import { sendApplicationNoticeEmail, type ApplicationNoticeEmail } from '../utils/email';
import { frontendUrl } from '../utils/frontendUrl';
import { logger } from '../utils/logger';

type Kind = ApplicationNoticeEmail['kind'];

/**
 * Avisa por correo a la otra parte de una solicitud de visita:
 * - `received`: solicitud nueva → propietario y agencia gestora (`agencyAccess: 'manage'`);
 * - `proposed` / `scheduled`: si actúa el inquilino, al propietario y su agencia; si actúa el
 *   propietario, su agencia o un administrador, al inquilino.
 * El enlace del casero abre el panel con los candidatos de ese inmueble. Nunca lanza.
 */
export async function notifyApplication(kind: Kind, applicationId: unknown, actorId: unknown): Promise<void> {
  try {
    const app = await Application.findById(applicationId).lean();
    if (!app) return;
    const property = await Property.findById(app.propertyId).select('title address city owner agencyId agencyAccess').lean();
    if (!property) return;
    const tenantActed = String(actorId) === String(app.tenantId);
    const date = kind === 'scheduled' ? app.visitDate : app.proposedDate;
    if (kind !== 'received' && !date) return;
    const base = {
      kind,
      date: date || undefined,
      propertyTitle: property.title,
      propertyAddress: [property.address, property.city].filter(Boolean).join(', ') || undefined,
    };
    const propertyId = encodeURIComponent(String(property._id));

    if (kind === 'received' || tenantActed) {
      const managerIds = [property.owner];
      if (property.agencyAccess === 'manage' && property.agencyId) managerIds.push(property.agencyId);
      const [tenant, managers] = await Promise.all([
        User.findById(app.tenantId).select('name tenantPro.status').lean(),
        User.find({ _id: { $in: managerIds } }).select('name email role').lean(),
      ]);
      await Promise.all(
        managers
          .filter(m => m.email && String(m._id) !== String(app.tenantId))
          .map(m =>
            sendApplicationNoticeEmail(m.email, {
              ...base,
              audience: 'manager',
              name: m.name,
              otherName: tenant?.name,
              link: frontendUrl(
                m.role === 'agency' ? `/agency/properties?solicitudes=${propertyId}` : `/landlord?solicitudes=${propertyId}`,
              ),
              ...(kind === 'received'
                ? { message: app.message, tenantVerified: (tenant as any)?.tenantPro?.status === 'verified' }
                : {}),
            }),
          ),
      );
      return;
    }

    const [tenant, actor] = await Promise.all([
      User.findById(app.tenantId).select('name email').lean(),
      User.findById(actorId).select('name role').lean(),
    ]);
    if (!tenant?.email) return;
    await sendApplicationNoticeEmail(tenant.email, {
      ...base,
      audience: 'tenant',
      name: tenant.name,
      // Un administrador actúa en nombre del propietario: no se da su nombre
      otherName: actor && actor.role !== 'admin' ? actor.name : undefined,
      link: frontendUrl('/tenant/applications'),
    });
  } catch (err) {
    logger.error({ type: 'application_notice_error', kind, err }, 'No se pudo avisar de la solicitud');
  }
}

import nodemailer from 'nodemailer';
import { logger } from './logger';
import { escapeHtml } from './escapeHtml';
import { frontendUrl } from './frontendUrl';

// Módulo único de email de la plataforma. Cualquier envío debe pasar por
// deliverEmail para compartir transporter, remitente y manejo de errores.

const smtpConfigured = Boolean(process.env.SMTP_HOST || process.env.SMTP_USER);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    })
  : null;

const defaultFrom =
  process.env.SMTP_FROM ||
  (process.env.SMTP_USER
    ? `"RentalApp Notificaciones" <${process.env.SMTP_USER}>`
    : 'no-reply@localhost');

type EmailOptions = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
};

const eur = (value: unknown) =>
  Number.isFinite(Number(value))
    ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value))
    : '';

const esDate = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
};

const contractLink = (contractId: string) => frontendUrl(`/contracts/${encodeURIComponent(contractId)}`);

/**
 * Resultado de un envío. Nunca lanza: quien necesite decir al usuario que el
 * correo no salió mira si es 'sent'. 'not_configured' = sin SMTP (desarrollo o
 * un servidor mal configurado): el correo tampoco llega.
 */
export type EmailDelivery = 'sent' | 'not_configured' | 'failed';

async function deliverEmail(options: EmailOptions): Promise<EmailDelivery> {
  const { to, subject } = options;
  if (!transporter) {
    logger.info({ type: 'email_mock', to, subject }, 'SMTP no configurado; email no enviado');
    return 'not_configured';
  }
  try {
    await transporter.sendMail({ from: defaultFrom, ...options });
    logger.info({ type: 'email_sent', to, subject }, 'Email enviado');
    return 'sent';
  } catch (error) {
    logger.error({ type: 'email_error', to, subject, err: error }, 'Error enviando email');
    return 'failed';
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<EmailDelivery> {
  return deliverEmail({ to, subject, html });
}

export async function sendPriceAlert(userEmail: string, property: any) {
  return sendEmail(
    userEmail,
    'Aviso: cambio de precio en propiedad',
    `<p>La propiedad «<strong>${escapeHtml(property.title)}</strong>» ahora cuesta ${escapeHtml(eur(property.price))}.</p>`,
  );
}

export async function sendAvailabilityAlert(userEmail: string, property: any) {
  const range = property.availableTo
    ? `del ${esDate(property.availableFrom)} al ${esDate(property.availableTo)}`
    : `desde el ${esDate(property.availableFrom)}`;

  return sendEmail(
    userEmail,
    'Aviso: cambio de disponibilidad',
    `<p>La propiedad «<strong>${escapeHtml(property.title)}</strong>» tiene nueva disponibilidad: ${escapeHtml(range)}.</p>`,
  );
}

export async function sendContractCreatedEmail(to: string, contractId: string) {
  return sendEmail(
    to,
    'Nuevo contrato creado',
    `<p>Se ha creado un nuevo contrato con ID ${escapeHtml(contractId)}.</p>`,
  );
}

export async function sendRentReminderEmail(to: string, contractId: string, amount: number) {
  return deliverEmail({
    to,
    subject: 'Recordatorio de pago de renta',
    text: `Le recordamos que la renta de €${amount} correspondiente al contrato ${contractId} vencerá pronto. Por favor, acceda a la plataforma para realizar el pago.`,
  });
}

export async function sendContractRenewalNotification(
  to: string,
  contractId: string,
  endDate: string,
) {
  return deliverEmail({
    to,
    subject: 'Próxima expiración de contrato',
    text: `Su contrato ${contractId} expirará el ${endDate}. Si desea renovar, póngase en contacto con la otra parte o inicie un nuevo contrato en la plataforma.`,
  });
}

export async function notifyTenantProDecision(email: string, decision: 'approved' | 'rejected') {
  const subject =
    decision === 'approved' ? 'Validación Tenant PRO aprobada' : 'Validación Tenant PRO rechazada';
  const text =
    decision === 'approved'
      ? 'Tu cuenta Tenant PRO ha sido aprobada. Ya puedes disfrutar de las ventajas de Only PRO.'
      : 'Tu solicitud Tenant PRO ha sido rechazada. Revisa la documentación y vuelve a intentarlo cuando estés listo.';
  return deliverEmail({ to: email, subject, text });
}

export async function sendContractReadyEmail(
  email: string,
  tenantName: string,
  contractId: string,
  propertyAddress: string,
) {
  const url = escapeHtml(contractLink(contractId));
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #2563EB;">Tienes un nuevo contrato pendiente</h2>
      <p>Hola <strong>${escapeHtml(tenantName)}</strong>,</p>
      <p>Se ha generado un contrato de arrendamiento para la propiedad en:</p>
      <p style="font-size: 16px; font-weight: bold; color: #333;">${escapeHtml(propertyAddress)}</p>
      <p>Revisa las condiciones y firma digitalmente para formalizar el alquiler.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Revisar y Firmar</a>
      </div>
      <p style="color: #666; font-size: 12px;">Si no puedes hacer clic, copia este enlace: ${url}</p>
    </div>
  `;
  await sendEmail(email, 'Acción requerida: Firma tu contrato de alquiler', html);
}

export async function sendPaymentReceiptEmail(
  email: string,
  payerName: string,
  amount: number,
  concept: string,
  date: Date,
) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #059669;">Pago recibido correctamente</h2>
      <p>Hola <strong>${escapeHtml(payerName)}</strong>,</p>
      <p>Hemos recibido tu pago. Detalles:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 10px; border: 1px solid #ddd;">Concepto</td>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${escapeHtml(concept)}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Importe</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(eur(amount))}</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 10px; border: 1px solid #ddd;">Fecha</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${escapeHtml(esDate(date))}</td>
        </tr>
      </table>
      <p>Puedes descargar este recibo desde tu panel de usuario.</p>
    </div>
  `;

  await sendEmail(email, `Recibo de Pago: ${concept}`, html);
}

export async function sendContractActiveEmail(
  email: string,
  tenantName: string,
  propertyTitle: string,
  contractId: string,
) {
  const dashboardLink = escapeHtml(contractLink(contractId));
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #10B981; text-align: center;">Tu contrato está ACTIVO</h2>
      <p>Hola <strong>${escapeHtml(tenantName)}</strong>,</p>
      <p>Tu contrato de alquiler para <strong>${escapeHtml(propertyTitle)}</strong> está oficialmente <strong>ACTIVO</strong>.</p>

      <div style="background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-radius: 6px;">
        <p style="margin: 0;">Contrato firmado</p>
        <p style="margin: 0;">Fianza recibida</p>
        <p style="margin: 0; font-weight: bold; color: #10B981;">Listo para entrar</p>
      </div>

      <p>Accede a tu panel para ver los detalles, gestionar pagos o contactar con el propietario.</p>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${dashboardLink}" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir a mi dashboard</a>
      </div>

      <p style="margin-top: 30px; font-size: 12px; color: #6b7280; text-align: center;">Este es un mensaje automático de RentalApp.</p>
    </div>
  `;

  await sendEmail(
    email,
    `Tu alquiler en ${propertyTitle} está activo`,
    html,
  );
}

export type CoTenantInviteEmail = {
  link: string;
  inviterName?: string;
  propertyTitle?: string;
  propertyAddress?: string;
  expiresAt: Date;
};

/** Invitación de co-titular: quién invita, qué vivienda y hasta cuándo vale el enlace. */
export function coTenantInviteEmail(invite: CoTenantInviteEmail) {
  const url = escapeHtml(invite.link);
  const inviter = invite.inviterName?.replace(/\s+/g, ' ').trim().slice(0, 80);
  const who = inviter ? `<strong>${escapeHtml(inviter)}</strong> te ha invitado` : 'Te han invitado';
  const place = [invite.propertyTitle, invite.propertyAddress].map(v => v?.trim()).filter(Boolean);
  const expires = invite.expiresAt.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  });
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; color: #111827;">
      <h2 style="margin-top: 0;">Invitación para compartir un alquiler</h2>
      <p>${who} a unirte como co-titular a su contrato de alquiler en RentalApp.</p>
      ${
        place.length
          ? `<div style="background-color: #f3f4f6; padding: 12px 16px; margin: 16px 0; border-radius: 6px;">
        ${place.map((v, i) => `<p style="margin: 0;${i === 0 ? ' font-weight: bold;' : ' color: #4b5563;'}">${escapeHtml(v)}</p>`).join('')}
      </div>`
          : ''
      }
      <p>Como co-titular podrás ver el contrato, firmarlo y descargar el PDF. Para aceptar, entra o crea tu cuenta con este mismo correo.</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${url}" style="background-color: #111827; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver la invitación</a>
      </div>
      <p style="color: #4b5563; font-size: 13px;">El enlace caduca el ${escapeHtml(expires)}. Si no esperabas esta invitación, puedes ignorar este correo.</p>
      <p style="color: #6b7280; font-size: 12px;">Si no puedes hacer clic, copia este enlace: ${url}</p>
    </div>
  `;
  const subject = inviter ? `${inviter} te invita a compartir su alquiler` : 'Invitación para compartir un alquiler';
  return { subject, html };
}

export async function sendCoTenantInviteEmail(to: string, invite: CoTenantInviteEmail): Promise<EmailDelivery> {
  const { subject, html } = coTenantInviteEmail(invite);
  return sendEmail(to, subject, html);
}

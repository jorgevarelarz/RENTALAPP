import nodemailer from 'nodemailer';
// If you plan to add SMS notifications, integrate a provider like Twilio or
// Nexmo here. For now we simulate SMS sends with a console log.

const smtpConfigured = Boolean(process.env.SMTP_HOST);

// Reuse the same transporter configuration defined in utils/email.ts
const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

const defaultFrom = process.env.SMTP_FROM || 'noreply@rental-app.com';

const deliverEmail = async (
  mailOptions: Record<string, unknown> & { to?: string; subject?: string; text?: string; from?: string }
) => {
  if (!mailOptions.from) {
    mailOptions.from = defaultFrom;
  }
  if (transporter) {
    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error enviando email de notificación:', error);
    }
  } else {
    console.log(
      `[Mock email] To: ${mailOptions.to} | Subject: ${mailOptions.subject} | Body: ${mailOptions.text || ''}`
    );
  }
};

export const sendEmail = async (to: string, subject: string, body: string) => {
  await deliverEmail({ to, subject, text: body });
};

/**
 * Sends an email reminding a tenant that their rent is due soon. Pass
 * contract details to customise the message. In production you might
 * localise the message and include a payment link.
 */
export const sendRentReminderEmail = async (
  to: string,
  contractId: string,
  amount: number,
) => {
  await deliverEmail({
    to,
    subject: 'Recordatorio de pago de renta',
    text: `Le recordamos que la renta de €${amount} correspondiente al contrato ${contractId} vencerá pronto. Por favor, acceda a la plataforma para realizar el pago.`,
  });
};

/**
 * Sends an email to inform both parties that the contract is about to
 * expire and may need renewal. In a real workflow you might create a new
 * contract automatically and include signature links.
 */
export const sendContractRenewalNotification = async (
  to: string,
  contractId: string,
  endDate: string,
) => {
  await deliverEmail({
    to,
    subject: 'Próxima expiración de contrato',
    text: `Su contrato ${contractId} expirará el ${endDate}. Si desea renovar, póngase en contacto con la otra parte o inicie un nuevo contrato en la plataforma.`,
  });
};

/**
 * Sends a text message (SMS) to a phone number. This is a stub; in
 * production, integrate with your SMS provider of choice and handle
 * delivery failures.
 */
export const sendSms = async (phoneNumber: string, message: string) => {
  // TODO: integrate with Twilio or other SMS provider
  console.log(`[Mock SMS] To: ${phoneNumber} | Body: ${message}`);
  await new Promise(resolve => setTimeout(resolve, 100));
};

export const sendSMS = sendSms;
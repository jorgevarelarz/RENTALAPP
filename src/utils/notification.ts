import nodemailer from 'nodemailer';
// If you plan to add SMS notifications, integrate a provider like Twilio or
// Nexmo here. For now we simulate SMS sends with a console log.

// Reuse the same transporter configuration defined in utils/email.ts
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@rental-app.com',
    to,
    subject: 'Recordatorio de pago de renta',
    text: `Le recordamos que la renta de €${amount} correspondiente al contrato ${contractId} vencerá pronto. Por favor, acceda a la plataforma para realizar el pago.`,
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error enviando recordatorio de renta:', error);
  }
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
  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@rental-app.com',
    to,
    subject: 'Próxima expiración de contrato',
    text: `Su contrato ${contractId} expirará el ${endDate}. Si desea renovar, póngase en contacto con la otra parte o inicie un nuevo contrato en la plataforma.`,
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error enviando notificación de renovación:', error);
  }
};

/**
 * Sends a text message (SMS) to a phone number. This is a stub; in
 * production, integrate with your SMS provider of choice and handle
 * delivery failures.
 */
export const sendSMS = async (phoneNumber: string, message: string) => {
  // TODO: integrate with Twilio or other SMS provider
  console.log(`Simulated SMS to ${phoneNumber}: ${message}`);
  await new Promise(resolve => setTimeout(resolve, 100));
};
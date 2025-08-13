import nodemailer from 'nodemailer';

// Configure the transport using environment variables. When deploying you
// should set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in your .env file.
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
 * Send an email notification when a new contract has been created. This is a
 * placeholder; in a production environment you would customise the
 * message and handle errors appropriately.
 */
export const sendContractCreatedEmail = async (to: string, contractId: string) => {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@rental-app.com',
    to,
    subject: 'Nuevo contrato creado',
    text: `Se ha creado un nuevo contrato con ID ${contractId}.`,
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error enviando email de notificación:', error);
  }
};
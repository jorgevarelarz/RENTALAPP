import nodemailer from 'nodemailer';

// Transporter SMTP (configurable vía variables de entorno)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL MOCK] To=${to} | ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"RentalApp Notificaciones" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email enviado a ${to} | ${subject}`);
  } catch (error) {
    console.error('Error enviando email:', error);
  }
}

export async function sendPriceAlert(userEmail: string, property: any) {
  return sendEmail(
    userEmail,
    'Aviso: cambio de precio en propiedad',
    `<p>La propiedad "<strong>${property.title}</strong>" ahora cuesta ${property.price} €</p>`,
  );
}

export async function sendAvailabilityAlert(userEmail: string, property: any) {
  const range = property.availableTo
    ? `${property.availableFrom} - ${property.availableTo}`
    : property.availableFrom;

  return sendEmail(
    userEmail,
    'Aviso: cambio de disponibilidad',
    `<p>La propiedad "<strong>${property.title}</strong>" tiene nueva fecha de disponibilidad: ${range}</p>`,
  );
}

export async function sendContractCreatedEmail(to: string, contractId: string) {
  return sendEmail(
    to,
    'Nuevo contrato creado',
    `<p>Se ha creado un nuevo contrato con ID ${contractId}.</p>`,
  );
}

export async function sendContractReadyEmail(
  email: string,
  tenantName: string,
  contractId: string,
  propertyAddress: string,
) {
  const url = `${process.env.FRONTEND_URL || ''}/contracts/${contractId}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #2563EB;">Tienes un nuevo contrato pendiente</h2>
      <p>Hola <strong>${tenantName}</strong>,</p>
      <p>Se ha generado un contrato de arrendamiento para la propiedad en:</p>
      <p style="font-size: 16px; font-weight: bold; color: #333;">${propertyAddress}</p>
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
      <p>Hola <strong>${payerName}</strong>,</p>
      <p>Hemos recibido tu pago. Detalles:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f9fafb;">
          <td style="padding: 10px; border: 1px solid #ddd;">Concepto</td>
          <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${concept}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">Importe</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${amount} €</td>
        </tr>
        <tr style="background-color: #f9fafb;">
          <td style="padding: 10px; border: 1px solid #ddd;">Fecha</td>
          <td style="padding: 10px; border: 1px solid #ddd;">${date.toLocaleDateString()}</td>
        </tr>
      </table>
      <p>Puedes descargar este recibo desde tu panel de usuario.</p>
    </div>
  `;

  await sendEmail(email, `Recibo de Pago: ${concept}`, html);
}

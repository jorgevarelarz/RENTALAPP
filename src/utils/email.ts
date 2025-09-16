/**
 * Email utility functions used across the application. Right now this module
 * exposes a very simple console-based mock that simulates email delivery. When
 * a real provider (Sendgrid, SES, etc.) is integrated the implementation of
 * sendEmail can be replaced while keeping the rest of the app untouched.
 */
export async function sendEmail(userId: string, subject: string, body: string) {
  console.log(`[EMAIL MOCK] To user=${userId} | ${subject}\n${body}`);
}

export async function sendPriceAlert(userId: string, property: any) {
  return sendEmail(
    userId,
    'Aviso: cambio de precio en propiedad',
    `La propiedad "${property.title}" ahora cuesta ${property.price} €`,
  );
}

export async function sendAvailabilityAlert(userId: string, property: any) {
  const range = property.availableTo
    ? `${property.availableFrom} - ${property.availableTo}`
    : property.availableFrom;

  return sendEmail(
    userId,
    'Aviso: cambio de disponibilidad',
    `La propiedad "${property.title}" tiene nueva fecha de disponibilidad: ${range}`,
  );
}

export async function sendContractCreatedEmail(to: string, contractId: string) {
  return sendEmail(
    to,
    'Nuevo contrato creado',
    `Se ha creado un nuevo contrato con ID ${contractId}.`,
  );
}

import PDFDocument from 'pdfkit';

/**
 * Data passed to the PDF generator to render a tenancy agreement. All
 * strings are expected to be present and any optional data should be
 * converted to empty strings upstream to avoid runtime errors.
 */
interface ContractData {
  landlordName: string;
  landlordDNI: string;
  landlordAddress: string;
  tenantName: string;
  tenantDNI: string;
  tenantAddress: string;
  propertyAddress: string;
  cadastralRef: string;
  durationMonths: number;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  paymentDay: number;
  bankAccount: string;
  city: string;
  dateSigned: string;
}

export const generateContractPDF = (data: ContractData): Buffer => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const buffers: Uint8Array[] = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {});

  // Title
  doc.fontSize(18).text('CONTRATO DE ARRENDAMIENTO DE VIVIENDA', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`En ${data.city}, a ${data.dateSigned}`, { align: 'right' });
  doc.moveDown(1);

  // Parties introduction
  doc.fontSize(12).text('REUNIDOS', { underline: true });
  doc.moveDown(0.5);
  doc
    .fontSize(10)
    .text(`Arrendador: ${data.landlordName}, DNI ${data.landlordDNI}, domicilio en ${data.landlordAddress}.`)
    .moveDown(0.3)
    .text(`Inquilino: ${data.tenantName}, DNI ${data.tenantDNI}, domicilio en ${data.tenantAddress}.`);
  doc.moveDown(1);

  // Background
  doc.fontSize(12).text('EXPONEN', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10).text(
    `Que el arrendador es titular de la vivienda sita en ${data.propertyAddress}, referencia catastral ${data.cadastralRef}, y desea ceder su uso al inquilino bajo las siguientes cláusulas:`,
  );
  doc.moveDown(1);

  // Clauses
  doc.fontSize(12).text('CLÁUSULAS', { underline: true });
  const clauses = [
    `1. Objeto: uso y disfrute de la vivienda descrita.`,
    `2. Duración: ${data.durationMonths} meses, desde ${data.startDate} hasta ${data.endDate}.`,
    `3. Renta: €${data.monthlyRent} mensuales, pagaderos antes del día ${data.paymentDay} de cada mes mediante transferencia a la cuenta ${data.bankAccount}.`,
    `4. Fianza: €${data.deposit}, entregada en este acto conforme al artículo 36 LAU.`,
    `5. Gastos: suministros y comunidad a cargo del inquilino.`,
    `6. Conservación: reparaciones menores por el inquilino; mayores por el arrendador.`,
    `7. Obras: no se podrán realizar sin autorización escrita del arrendador.`,
    `8. Subarriendo: prohibido sin consentimiento expreso.`,
    `9. Inventario: se adjunta como Anexo I.`,
    `10. Anexos:`,
  ];
  // Write clauses
  doc.moveDown(0.5).fontSize(10);
  clauses.forEach(text => {
    doc.text(text).moveDown(0.3);
  });
  // Annex section
  doc.moveDown(0.5);
  doc.fontSize(10).text('- Anexo I: Inventario de muebles y enseres');
  doc.text('- Anexo II: Certificado de eficiencia energética');
  doc.text('- Anexo III: Cédula de habitabilidad');
  doc.moveDown(1);
  // Signatures
  doc.moveDown(2);
  const sigY = doc.y;
  doc.text('__________________________', 80, sigY);
  doc.text('__________________________', 350, sigY);
  doc.text(`Arrendador: ${data.landlordName}`, 80, sigY + 15);
  doc.text(`Inquilino: ${data.tenantName}`, 350, sigY + 15);
  doc.end();
  return Buffer.concat(buffers);
};
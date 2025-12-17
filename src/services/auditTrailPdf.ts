import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { ContractSignatureEvent } from '../models/contractSignatureEvent.model';

export async function generateAuditTrailPdf(contractId: string) {
  const events = await ContractSignatureEvent.find({ contractId }).sort({ timestamp: 1, _id: 1 }).lean();
  const finalHash = events.length ? events[events.length - 1].currentHash : 'GENESIS';

  const dir = path.resolve(process.cwd(), 'storage/contracts-audit');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}

  const fileName = `contract_${contractId}.pdf`;
  const abs = path.join(dir, fileName);

  const doc = new PDFDocument({ size: 'A4', margin: 50, compress: false });
  const chunks: Buffer[] = [];
  doc.on('data', (d: Buffer) => chunks.push(d));

  doc.fontSize(18).text('RENTALAPP — Registro de Auditoría de Firma', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Contract ID: ${contractId}`);
  doc.text(`Generado: ${new Date().toISOString()}`);
  doc.text(`Hash final: ${finalHash}`);
  doc.moveDown(1);

  doc.fontSize(14).text('Eventos', { underline: true });
  doc.moveDown(0.5);

  if (events.length === 0) {
    doc.fontSize(12).text('No hay eventos registrados.');
  } else {
    doc.fontSize(10);
    for (const evt of events) {
      doc.text(`- ${new Date(evt.timestamp).toISOString()}  |  ${evt.eventType}`);
      if (evt.ip) doc.text(`  IP: ${evt.ip}`);
      if (evt.userAgent) doc.text(`  User-Agent: ${evt.userAgent}`);
      doc.text(`  Previous: ${evt.previousHash}`);
      doc.text(`  Current:  ${evt.currentHash}`);
      doc.moveDown(0.4);
    }
  }

  doc.end();

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  fs.writeFileSync(abs, buffer);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return {
    absPath: abs,
    fileName,
    sha256,
    finalHash,
  };
}


import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/contracts/demo', authenticate, (req, res) => {
  const { landlord, tenant, property, rent } = req.body;
  res.setHeader('Content-Type', 'application/pdf');
  const doc = new PDFDocument();
  doc.pipe(res);
  doc.fontSize(20).text('DEMO – sin validez legal', { align: 'center' });
  doc.moveDown();
  if (property) doc.text(`Propiedad: ${property}`);
  if (landlord) doc.text(`Propietario: ${landlord}`);
  if (tenant) doc.text(`Inquilino: ${tenant}`);
  if (rent) doc.text(`Renta: ${rent} EUR`);
  doc.end();
});

export default router;

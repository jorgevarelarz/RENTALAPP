import { Router } from 'express';
import { body } from 'express-validator';
import PDFDocument from 'pdfkit';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import asyncHandler from '../utils/asyncHandler';

const router = Router();

router.post(
  '/contracts/demo',
  authenticate,
  [
    body('landlord').isString().notEmpty(),
    body('tenant').isString().notEmpty(),
    body('property').isString().notEmpty(),
    body('rent').isNumeric().custom((v) => v > 0),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { landlord, tenant, property, rent } = req.body;
    res.setHeader('Content-Type', 'application/pdf');
    const doc = new PDFDocument();
    doc.pipe(res);
    doc.fontSize(20).text('DEMO – sin validez legal', { align: 'center' });
    doc.moveDown();
    doc.text(`Propiedad: ${property}`);
    doc.text(`Propietario: ${landlord}`);
    doc.text(`Inquilino: ${tenant}`);
    doc.text(`Renta: ${rent} EUR`);
    doc.end();
  })
);

export default router;

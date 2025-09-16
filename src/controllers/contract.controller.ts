import { Request, Response } from 'express';
import { Contract } from '../models/contract.model';
import { User } from '../models/user.model';
import { Property } from '../models/property.model';
import { generateContractPDF } from '../utils/pdfGenerator';
import { sendContractCreatedEmail } from '../utils/email';
import { encryptIBAN } from '../utils/payment';
import { recordContractHistory } from '../utils/history';
import { ContractHistory } from '../models/history.model';
import { decryptIBAN, createCustomerAndMandate, createPaymentIntent } from '../utils/payment';
import { depositToEscrow, depositToAuthority } from '../utils/deposit';
import { sendForSignature, checkSignatureStatus } from '../utils/signature';
import { sendRentReminderEmail, sendContractRenewalNotification } from '../utils/notification';
import PDFDocument from 'pdfkit';
import { createContractAction, signContractAction, initiatePaymentAction } from '../services/contract.actions';
import type { ResolvedClause } from '../services/clauses.service';

function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10));
  return { page, limit };
}

export const createContract = async (req: Request, res: Response) => {
  const {
    landlord,
    landlordId,
    tenant,
    tenantId,
    property,
    propertyId,
    region,
    clauses,
    rent,
    deposit,
    startDate,
    endDate,
    iban,
  } = req.body;
  const resolvedClauses = (req as any).resolvedClauses as ResolvedClause[] | undefined;
  try {
    const contract = await createContractAction({
      landlordId: landlord ?? landlordId,
      tenantId: tenant ?? tenantId,
      propertyId: property ?? propertyId,
      region,
      clauses,
      resolvedClauses,
      rent,
      deposit,
      startDate,
      endDate,
      iban,
    });
    res.status(201).json({ message: 'Contrato creado', contract });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

export const getContractPDF = async (req: Request, res: Response) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });

    const landlord = await User.findById(contract.landlord);
    const tenant = await User.findById(contract.tenant);
    const property = await Property.findById(contract.property);

    if (!landlord || !tenant || !property) {
      return res.status(404).json({ error: 'Datos incompletos para el contrato' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=contrato_${contract._id}.pdf`
    );

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    doc.fontSize(18).text('CONTRATO DE ARRENDAMIENTO DE VIVIENDA', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`En ${(property as any).city || ''}, a ${new Date().toISOString().split('T')[0]}`, { align: 'right' });
    doc.moveDown(1);

    doc.fontSize(12).text('REUNIDOS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10)
      .text(`Arrendador: ${landlord.name}, DNI ${(landlord as any).dni || ''}, domicilio en ${(landlord as any).address || ''}.`)
      .moveDown(0.3)
      .text(`Inquilino: ${tenant.name}, DNI ${(tenant as any).dni || ''}, domicilio en ${(tenant as any).address || ''}.`);
    doc.moveDown(1);

    doc.fontSize(12).text('EXPONEN', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(
      `Que el arrendador es titular de la vivienda sita en ${property.address}, referencia catastral ${(property as any).cadastralReference || ''}, y desea ceder su uso al inquilino bajo las siguientes cláusulas:`
    );
    doc.moveDown(1);

    doc.fontSize(12).text('CLÁUSULAS', { underline: true });
    doc.moveDown(0.5);
    const clauses = [
      `1. Objeto: uso y disfrute de la vivienda descrita.`,
      `2. Duración: ${Math.ceil((new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} meses, desde ${contract.startDate.toISOString().split('T')[0]} hasta ${contract.endDate.toISOString().split('T')[0]}.`,
      `3. Renta: €${contract.rent} mensuales, pagaderos antes del día 5 de cada mes.`,
      `4. Fianza: €${contract.deposit}, entregada en este acto conforme al artículo 36 LAU.`,
      `5. Gastos: suministros y comunidad a cargo del inquilino.`,
      `6. Conservación: reparaciones menores por el inquilino; mayores por el arrendador.`,
      `7. Obras: no se podrán realizar sin autorización escrita del arrendador.`,
      `8. Subarriendo: prohibido sin consentimiento expreso.`,
      `9. Inventario: se adjunta como Anexo I.`,
    ];
    clauses.forEach(c => doc.fontSize(10).text(c).moveDown(0.3));

    doc.moveDown(2);
    const sigY = doc.y;
    doc.text('__________________________', 80, sigY);
    doc.text('__________________________', 350, sigY);
    doc.text(`Arrendador: ${landlord.name}`, 80, sigY + 15);
    doc.text(`Inquilino: ${tenant.name}`, 350, sigY + 15);

    doc.end();

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Error generando el PDF' });
  }
};

export const signContract = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const contract = await signContractAction(req.params.id, user);
    res.json({ message: 'Contrato firmado', contract });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

export const getContractHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await ContractHistory.find({ contract: id }).sort({ timestamp: 1 });
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el historial del contrato' });
  }
};

export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const user = (req as any).user;
    const clientSecret = await initiatePaymentAction(id, amount, user);
    res.json({ message: 'Pago iniciado', clientSecret });
  } catch (error: any) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
};

export const payDeposit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { destination } = req.body;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    const user = (req as any).user;
    if (user.role !== 'tenant' || String(contract.tenant) !== user.id) {
      return res.status(403).json({ error: 'Solo el inquilino puede pagar la fianza' });
    }
    if (contract.depositPaid) {
      return res.status(400).json({ error: 'La fianza ya ha sido pagada' });
    }
    const depositAmount = contract.deposit;
    const dest = destination === 'authority' ? 'authority' : 'escrow';
    if (dest === 'escrow') {
      await depositToEscrow(contract.id, depositAmount);
    } else {
      await depositToAuthority(contract.id, depositAmount);
    }
    contract.depositPaid = true;
    contract.depositPaidAt = new Date();
    await contract.save();
    await recordContractHistory(contract.id, 'depositPaid', `Fianza pagada a ${dest}`);
    res.json({ message: 'Fianza pagada', contract });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Error al pagar la fianza', details: error.message });
  }
};

export const requestSignature = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    const landlord = await User.findById(contract.landlord);
    const tenant = await User.findById(contract.tenant);
    const property = await Property.findById(contract.property);
    if (!landlord || !tenant || !property) {
      return res.status(404).json({ error: 'Datos incompletos para el contrato' });
    }
    const data = {
      landlordName: landlord.name,
      landlordDNI: (landlord as any).dni || '',
      landlordAddress: (landlord as any).address || '',
      tenantName: tenant.name,
      tenantDNI: (tenant as any).dni || '',
      tenantAddress: (tenant as any).address || '',
      propertyAddress: property.address || '',
      cadastralRef: (property as any).cadastralReference || '',
      durationMonths: Math.ceil(
        (new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) /
          (1000 * 60 * 60 * 24 * 30),
      ),
      startDate: contract.startDate.toISOString().split('T')[0],
      endDate: contract.endDate.toISOString().split('T')[0],
      monthlyRent: contract.rent,
      deposit: contract.deposit,
      paymentDay: 5,
      bankAccount: process.env.BANK_ACCOUNT || '',
      city: (property as any).city || '',
      dateSigned: new Date().toISOString().split('T')[0],
    };
    const pdfBuffer = await generateContractPDF(data);
    const user = (req as any).user;
    const signerEmail = user.role === 'landlord' ? landlord.email : tenant.email;
    const signerName = user.role === 'landlord' ? landlord.name : tenant.name;
    const redirectUrl = process.env.SIGN_REDIRECT_URL || 'https://example.com/signing-complete';
    const { signatureUrl, envelopeId } = await sendForSignature({
      contractId: contract.id,
      documentBuffer: pdfBuffer,
      signerEmail,
      signerName,
      redirectUrl,
    });
    (contract as any).signatureEnvelopeId = envelopeId;
    await contract.save();
    await recordContractHistory(
      contract.id,
      'signatureRequested',
      `Firma electrónica solicitada por ${user.role}`,
    );
    res.json({ message: 'Firma electrónica iniciada', signatureUrl, envelopeId });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Error iniciando la firma', details: error.message });
  }
};

export const sendRentReminder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    const tenant = await User.findById(contract.tenant);
    if (!tenant?.email) {
      return res.status(404).json({ error: 'El inquilino no tiene email disponible' });
    }
    await sendRentReminderEmail(tenant.email, contract.id, contract.rent);
    await recordContractHistory(contract.id, 'rentReminderSent', 'Recordatorio de renta enviado');
    res.json({ message: 'Recordatorio de renta enviado' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Error enviando recordatorio', details: error.message });
  }
};

export const sendRenewalNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    const landlord = await User.findById(contract.landlord);
    const tenant = await User.findById(contract.tenant);
    const endDateStr = contract.endDate.toISOString().split('T')[0];
    if (landlord?.email) {
      await sendContractRenewalNotification(landlord.email, contract.id, endDateStr);
    }
    if (tenant?.email) {
      await sendContractRenewalNotification(tenant.email, contract.id, endDateStr);
    }
    await recordContractHistory(contract.id, 'renewalNoticeSent', 'Notificación de renovación enviada');
    res.json({ message: 'Notificaciones de renovación enviadas' });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Error enviando notificaciones', details: error.message });
  }
};

export const listContracts = async (req: Request, res: Response) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const q: any = {};
    if (req.query.status) q.status = req.query.status;

    const user = (req as any).user;
    if (user.role !== 'admin') {
      q.$or = [{ landlord: user.id }, { tenant: user.id }];
    }

    const [items, total] = await Promise.all([
      Contract.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Contract.countDocuments(q)
    ]);
    const userIds = new Set<string>();
    items.forEach(c => {
      userIds.add(String(c.landlord));
      userIds.add(String(c.tenant));
    });
    const users = await User.find(
      { _id: { $in: Array.from(userIds) } },
      { ratingAvg: 1, reviewCount: 1 }
    ).lean();
    const userMap = new Map(users.map(u => [String(u._id), u]));
    const hydrated = items.map(c => {
      const ownerId = String(c.landlord);
      const tenantId = String(c.tenant);
      return {
        ...c,
        ownerId,
        tenantId,
        owner: {
          id: ownerId,
          ratingAvg: userMap.get(ownerId)?.ratingAvg ?? 0,
          reviewCount: userMap.get(ownerId)?.reviewCount ?? 0,
        },
        tenant: {
          id: tenantId,
          ratingAvg: userMap.get(tenantId)?.ratingAvg ?? 0,
          reviewCount: userMap.get(tenantId)?.reviewCount ?? 0,
        },
      } as any;
    });
    res.json({ items: hydrated, total, page, limit });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
};

export const getContract = async (req: Request, res: Response) => {
  try {
    const c = await Contract.findById(req.params.id).lean();
    if (!c) return res.status(404).json({ error: 'Contrato no encontrado' });

    const user = (req as any).user;
    if (user.role !== 'admin' && String(c.landlord) !== user.id && String(c.tenant) !== user.id) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const ids = [String(c.landlord), String(c.tenant)];
    const users = await User.find({ _id: { $in: ids } }, { ratingAvg: 1, reviewCount: 1 }).lean();
    const userMap = new Map(users.map(u => [String(u._id), u]));
    const ownerId = String(c.landlord);
    const tenantId = String(c.tenant);
    const result: any = {
      ...c,
      ownerId,
      tenantId,
      owner: {
        id: ownerId,
        ratingAvg: userMap.get(ownerId)?.ratingAvg ?? 0,
        reviewCount: userMap.get(ownerId)?.reviewCount ?? 0,
      },
      tenant: {
        id: tenantId,
        ratingAvg: userMap.get(tenantId)?.ratingAvg ?? 0,
        reviewCount: userMap.get(tenantId)?.reviewCount ?? 0,
      },
    };
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
};
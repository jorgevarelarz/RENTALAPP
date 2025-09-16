import { Request, Response } from 'express';
import fs from 'fs/promises';
import { z, ZodError } from 'zod';
import { Contract } from '../models/contract.model';
import { User } from '../models/user.model';
import { Property } from '../models/property.model';
import { generateContractPDF } from '../utils/pdfGenerator';
import { getCatalogByRegion } from '../policies/clauses';
import { CLAUSE_POLICY_VERSION } from '../policies/clauses/catalog.v1';
import { computePdfHash } from '../utils/pdfHash';
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

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

const createContractSchema = z.object({
  landlord: objectId,
  tenant: objectId,
  property: objectId,
  region: z.string().toLowerCase(),
  rent: z.number().positive(),
  deposit: z.number().min(0),
  startDate: z.string().transform((s: string) => new Date(s)),
  endDate: z.string().transform((s: string) => new Date(s)),
  clauses: z.array(z.object({ id: z.string(), params: z.record(z.any()).default({}) })),
});

function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10));
  return { page, limit };
}

export async function create(req: Request, res: Response) {
  let data: z.infer<typeof createContractSchema>;
  try {
    data = createContractSchema.parse(req.body);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'invalid_payload', details: error.flatten() });
    }
    return res.status(400).json({ error: 'invalid_payload' });
  }

  const startTime = data.startDate.getTime();
  const endTime = data.endDate.getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) {
    return res.status(400).json({ error: 'invalid_date_range' });
  }

  const catalog = getCatalogByRegion(data.region);
  if (!catalog || Object.keys(catalog).length === 0) {
    return res.status(400).json({ error: 'region_not_supported' });
  }

  let normalized: { id: string; version: string; params: Record<string, unknown> }[];
  try {
    normalized = data.clauses.map(clause => {
      const def = catalog[clause.id];
      if (!def) {
        throw Object.assign(new Error('clause_unknown'), { status: 400, id: clause.id });
      }
      const parsed = def.paramsSchema.parse(clause.params || {});
      return { id: def.id, version: def.version, params: parsed as Record<string, unknown> };
    });
  } catch (error: unknown) {
    if ((error as any)?.status) {
      return res.status((error as any).status).json({ error: (error as any).message, clauseId: (error as any).id });
    }
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'invalid_clause_params', details: error.flatten() });
    }
    console.error('Error validando cláusulas:', error);
    return res.status(400).json({ error: 'clause_validation_failed' });
  }

  try {
    const contract = await Contract.create({
      landlord: data.landlord,
      tenant: data.tenant,
      property: data.property,
      region: data.region,
      rent: data.rent,
      deposit: data.deposit,
      startDate: data.startDate,
      endDate: data.endDate,
      clauses: normalized,
      clausePolicyVersion: CLAUSE_POLICY_VERSION,
      status: 'pending_signature',
    });

    const clausesText = normalized.map(clause => {
      const def = catalog[clause.id];
      return `• ${def.label}
${def.render(clause.params)}`;
    });

    const { absolutePath, publicPath } = await generateContractPDF({ contract, clausesText });
    const pdfHash = computePdfHash(absolutePath);

    await Contract.findByIdAndUpdate(contract._id, { pdfPath: publicPath, pdfHash });

    const actorId = (req as any).user?.id;
    await recordContractHistory(contract._id, 'CREATED', actorId, {
      region: data.region,
      clausePolicyVersion: CLAUSE_POLICY_VERSION,
    });
    await recordContractHistory(contract._id, 'PDF_GENERATED', actorId, { pdfPath: publicPath, pdfHash });

    return res.status(201).json({ contract: { ...contract.toObject(), pdfPath: publicPath, pdfHash } });
  } catch (error) {
    console.error('Error al crear el contrato:', error);
    return res.status(500).json({ error: 'contract_creation_failed' });
  }
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
    const catalogForSignature = contract.region ? getCatalogByRegion(contract.region) : null;
    const clausesText = Array.isArray(contract.clauses)
      ? contract.clauses.map(clause => {
          const current = clause as any;
          const definition = catalogForSignature?.[current.id];
          if (definition) {
            try {
              return `• ${definition.label}\n${definition.render(current.params ?? {})}`;
            } catch (err) {
              console.error('Error renderizando cláusula para firma:', err);
            }
          }
          const paramsText = current?.params ? JSON.stringify(current.params) : '';
          return paramsText ? `• ${current.id}\n${paramsText}` : `• ${current.id}`;
        })
      : [];
    const { absolutePath: signaturePdfPath } = await generateContractPDF({ contract, clausesText });
    const pdfBuffer = await fs.readFile(signaturePdfPath);
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
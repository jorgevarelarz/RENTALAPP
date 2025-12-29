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
import { depositToEscrow } from '../utils/deposit';
import { signaturitProvider } from '../signature/signaturit';
import * as docusignProvider from '../services/signature/docusign.provider';
import { sendRentReminderEmail, sendContractRenewalNotification } from '../utils/notification';
import { sendContractReadyEmail } from '../utils/email';
import { Payment } from '../models/payment.model';
import { stripe } from '../utils/stripe';
import PDFDocument from 'pdfkit';
import { createContractAction, signContractAction, initiatePaymentAction } from '../services/contract.actions';
import type { ResolvedClause } from '../services/clauses.service';
import { generateContractPdfFile } from '../services/pdfGenerator';
// @ts-ignore
import SignaturitClient from 'signaturit-sdk';

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
      return `• ${def.label}\n${def.render(clause.params)}`;
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

    // Notificar al inquilino para que revise/filme
    const tenantUser = await User.findById(contract.tenant).lean();
    const propertyDoc = await Property.findById(contract.property).lean();
    if (tenantUser?.email) {
      sendContractReadyEmail(
        tenantUser.email,
        tenantUser.name || 'Inquilino',
        String(contract._id),
        propertyDoc?.address || propertyDoc?.title || 'Propiedad',
      ).catch(console.error);
    }

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
    if (error.message === 'Solo el inquilino puede iniciar pagos') {
      return res.status(403).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

export const payDeposit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { successUrl, cancelUrl } = req.body;
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
    const sessionUrl = await depositToEscrow(
      contract.id,
      depositAmount,
      successUrl || process.env.DEPOSIT_SUCCESS_URL || 'https://example.com/deposit/success',
      cancelUrl || process.env.DEPOSIT_CANCEL_URL || 'https://example.com/deposit/cancel'
    );
    res.json({ message: 'Iniciando pago de fianza', sessionUrl });
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

    const provider = (process.env.SIGN_PROVIDER || 'mock').toLowerCase();
    if (provider === 'docusign') {
      const embedded = String(process.env.SIGN_EMBEDDED || 'false').toLowerCase() === 'true';
      const env = await docusignProvider.createEnvelope({ contract, landlord, tenant, embedded });
      await Contract.findByIdAndUpdate(contract._id, {
        $set: {
          signature: {
            provider: 'docusign',
            envelopeId: env.envelopeId,
            status: env.status,
            updatedAt: new Date(),
            events: [{ at: new Date(), type: 'created' }, { at: new Date(), type: env.status }],
          },
          status: 'signing',
        },
      });
      await recordContractHistory(contract.id, 'signatureRequested', 'Firma DocuSign solicitada');
      return res.json({ envelopeId: env.envelopeId, status: env.status, recipientUrls: env.recipientUrls });
    }

    // Mock/default flow (signaturit stub)
    const { requestId, signerLinks } = await signaturitProvider.createSignatureFlow({
      contractId: contract.id,
      pdfPath: signaturePdfPath,
      signers: [
        { role: 'owner', userId: landlord.id, name: landlord.name, email: landlord.email },
        { role: 'tenant', userId: tenant.id, name: tenant.name, email: tenant.email },
      ],
      returnUrl: process.env.SIGN_REDIRECT_URL || 'https://example.com/signing-complete',
      webhookUrl: process.env.SIGN_WEBHOOK_URL || 'https://api.example.com/webhook/signature',
    });

    (contract as any).signatureRequestId = requestId;
    await contract.save();
    await recordContractHistory(contract.id, 'signatureRequested', 'Firma mock solicitada');
    res.json({ message: 'Firma electrónica iniciada', signerLinks, requestId });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Error iniciando la firma', details: error.message });
  }
};

export const createSigningSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    if (!process.env.SIGNATURIT_TOKEN) {
      return res.status(500).json({ error: 'SIGNATURIT_TOKEN no configurado' });
    }

    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    if (String(contract.tenant) !== user?.id) {
      return res.status(403).json({ error: 'Solo el inquilino puede firmar este contrato' });
    }

    const tenant = await User.findById(contract.tenant);
    const landlord = await User.findById(contract.landlord);
    const property = await Property.findById(contract.property);

    const pdfPath = await generateContractPdfFile({
      ...contract.toObject(),
      tenantName: tenant?.name || (contract as any).tenantName,
      tenantIdDoc: (tenant as any)?.dni || (contract as any).tenantIdDoc,
      tenantEmail: tenant?.email || (contract as any).tenantEmail,
      landlordName: landlord?.name || (contract as any).landlordName,
      landlordIdDoc: (landlord as any)?.dni || (contract as any).landlordIdDoc,
      propertyAddress: property?.address || (contract as any).propertyAddress,
      rentAmount: contract.rent ?? (contract as any).rentAmount,
      depositAmount: contract.deposit ?? (contract as any).depositAmount,
    });

    const client = new SignaturitClient(process.env.SIGNATURIT_TOKEN, true);
    const response = await client.createSignature(pdfPath, {
      recipients: [
        {
          name: tenant?.name || (contract as any).tenantName || 'Inquilino',
          email: tenant?.email || (contract as any).tenantEmail || 'email@test.com',
        },
      ],
      delivery_type: 'url',
    });

    await fs.unlink(pdfPath).catch(() => {});

    const signingUrl =
      (response as any)?.url ||
      (response as any)?.signing_url ||
      (response as any)?.signingUrl ||
      (response as any)?.processed_documents?.[0]?.url;

    contract.signature = {
      ...(contract.signature || {}),
      provider: 'signaturit' as any,
      envelopeId: (response as any)?.id || (response as any)?.signature_id,
      status: 'sent',
      updatedAt: new Date(),
      recipientUrls: { tenantUrl: signingUrl },
    };
    contract.status = 'signing';
    await contract.save();

    res.json({ signingUrl });
  } catch (error: any) {
    console.error('Error Signaturit:', error);
    res.status(500).json({ error: 'Error al conectar con proveedor de firma' });
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

export const createRentPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    if (String(contract.tenant) !== userId) {
      return res.status(403).json({ error: 'Solo el inquilino puede pagar la renta' });
    }
    if (contract.status !== 'active' && contract.status !== 'signed') {
      return res.status(400).json({ error: 'El contrato no está activo' });
    }

    const now = new Date();
    const monthName = now.toLocaleString('es-ES', { month: 'long' });
    const concept = `Renta ${monthName} ${now.getFullYear()}`;
    const amount = contract.rent ?? (contract as any).rentAmount ?? 0;
    const amountCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'eur',
      metadata: {
        type: 'rent',
        contractId: String(contract._id),
        payerId: String(userId),
        concept,
      },
      automatic_payment_methods: { enabled: true },
    });

    await Payment.create({
      contract: contract._id,
      payer: userId,
      payee: contract.landlord,
      amount,
      currency: 'eur',
      stripePaymentIntentId: paymentIntent.id,
      status: 'pending',
      type: 'rent',
      concept,
      billingMonth: now.getMonth() + 1,
      billingYear: now.getFullYear(),
    });

    res.json({ clientSecret: paymentIntent.client_secret, amount });
  } catch (error: any) {
    console.error('Error creando pago de renta:', error);
    res.status(500).json({ error: 'Error al iniciar el pago' });
  }
};

export const getContractPayments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });

    const userId = (req as any).user?.id;
    const isAdmin = (req as any).user?.role === 'admin';
    const isParty = isAdmin || String(contract.tenant) === userId || String(contract.landlord) === userId;
    if (!isParty) return res.status(403).json({ error: 'No autorizado' });

    const payments = await Payment.find({ contract: id, status: 'succeeded' }).sort({ createdAt: -1 }).lean();
    res.json(payments);
  } catch (error: any) {
    console.error('Error obteniendo historial de pagos', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
};

export const getLandlordEarnings = async (req: Request, res: Response) => {
  try {
    const landlordId = (req as any).user?._id;
    if (!landlordId) return res.status(403).json({ error: 'No autorizado' });

    const contracts = await Contract.find({ landlord: landlordId }).select('_id').lean();
    const contractIds = contracts.map(c => c._id);
    if (contractIds.length === 0) {
      return res.json({ totalEarnings: 0, monthEarnings: 0, totalTransactions: 0, chart: [] });
    }

    const allPayments = await Payment.aggregate([
      { $match: { contract: { $in: contractIds }, status: 'succeeded' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthPayments = await Payment.aggregate([
      {
        $match: {
          contract: { $in: contractIds },
          status: 'succeeded',
          paidAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const chartData = await Payment.aggregate([
      {
        $match: {
          contract: { $in: contractIds },
          status: 'succeeded',
          paidAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: { month: { $month: '$paidAt' }, year: { $year: '$paidAt' } },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      totalEarnings: allPayments[0]?.total || 0,
      monthEarnings: monthPayments[0]?.total || 0,
      totalTransactions: allPayments[0]?.count || 0,
      chart: chartData.map(d => ({
        label: `${d._id.month}/${d._id.year}`,
        amount: d.amount,
      })),
    });
  } catch (error) {
    console.error('Error calculando ganancias:', error);
    res.status(500).json({ error: 'Error interno de servidor' });
  }
};

export const exportEarningsReport = async (req: Request, res: Response) => {
  try {
    const landlordId = (req as any).user?._id;
    if (!landlordId) return res.status(403).json({ error: 'No autorizado' });

    const contracts = await Contract.find({ landlord: landlordId }).select('_id propertyAddress tenantName').lean();
    const contractMap = contracts.reduce((acc: Record<string, any>, c: any) => {
      acc[String(c._id)] = c;
      return acc;
    }, {});
    const contractIds = contracts.map(c => c._id);

    const payments = await Payment.find({ contract: { $in: contractIds }, status: 'succeeded' })
      .sort({ paidAt: -1 })
      .lean();

    let csv = 'Fecha,Concepto,Propiedad,Inquilino,Importe (EUR),Estado,ID Transaccion\n';
    payments.forEach(p => {
      const contract = contractMap[String(p.contract)] || {};
      const date = p.paidAt ? new Date(p.paidAt).toLocaleDateString('es-ES') : '-';
      const amount = Number(p.amount || 0).toFixed(2);
      const clean = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
      const cleanConcept = clean(p.concept || '');
      const cleanAddress = clean(contract.propertyAddress || 'Propiedad');
      const cleanTenant = clean(contract.tenantName || 'Inquilino');
      csv += `${date},${cleanConcept},${cleanAddress},${cleanTenant},${amount},Pagado,${p.stripePaymentIntentId || ''}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment(`reporte_ingresos_${new Date().toISOString().slice(0, 10)}.csv`);
    return res.send(csv);
  } catch (error) {
    console.error('Error exportando CSV:', error);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
};

export const listContracts = async (req: Request, res: Response) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const q: any = {};
    if (req.query.status) q.status = req.query.status;

    const user = (req as any).user;
    if (!user) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (user.role !== 'admin') {
      q.$or = [{ landlord: user.id }, { tenant: user.id }];
    }

    const [items, total] = await Promise.all([
      Contract.find(q)
        .populate('property')
        .populate({ path: 'landlord', select: 'name email ratingAvg reviewCount' })
        .populate({ path: 'tenant', select: 'name email ratingAvg reviewCount' })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Contract.countDocuments(q)
    ]);

    if (user.role !== 'admin' && total === 0) {
        return res.status(200).json({ items: [], total: 0, page, limit });
    }

    const getId = (value: any) => {
      if (value && typeof value === 'object' && '_id' in value) {
        return String((value as any)._id);
      }
      return value ? String(value) : '';
    };
    const getUser = (value: any) => {
      if (value && typeof value === 'object' && '_id' in value) {
        return value as any;
      }
      return null;
    };
    const hydrated = items.map(c => {
      const landlord = getUser(c.landlord);
      const tenant = getUser(c.tenant);
      const ownerId = getId(c.landlord);
      const tenantId = getId(c.tenant);
      return {
        ...c,
        ownerId,
        tenantId,
        landlordName: landlord?.name,
        landlordEmail: landlord?.email,
        tenantName: tenant?.name,
        tenantEmail: tenant?.email,
        owner: {
          id: ownerId,
          ratingAvg: landlord?.ratingAvg ?? 0,
          reviewCount: landlord?.reviewCount ?? 0,
        },
        tenant: {
          id: tenantId,
          ratingAvg: tenant?.ratingAvg ?? 0,
          reviewCount: tenant?.reviewCount ?? 0,
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
    const user = (req as any).user;
    if (!user) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const c = await Contract.findById(req.params.id)
      .populate('property')
      .populate({ path: 'landlord', select: 'name email ratingAvg reviewCount' })
      .populate({ path: 'tenant', select: 'name email ratingAvg reviewCount' })
      .lean();
    if (!c) return res.status(404).json({ error: 'Contrato no encontrado' });

    const getId = (value: any) => {
      if (value && typeof value === 'object' && '_id' in value) {
        return String((value as any)._id);
      }
      return value ? String(value) : '';
    };
    const landlord = c.landlord && typeof c.landlord === 'object' ? (c.landlord as any) : null;
    const tenant = c.tenant && typeof c.tenant === 'object' ? (c.tenant as any) : null;
    const ownerId = getId(c.landlord);
    const tenantId = getId(c.tenant);
    const isLandlord = ownerId === user.id;
    const isTenant = tenantId === user.id;
    const isAdmin = user.role === 'admin';

    if (!isLandlord && !isTenant && !isAdmin) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const result: any = {
      ...c,
      ownerId,
      tenantId,
      landlordName: landlord?.name,
      landlordEmail: landlord?.email,
      tenantName: tenant?.name,
      tenantEmail: tenant?.email,
      owner: {
        id: ownerId,
        ratingAvg: landlord?.ratingAvg ?? 0,
        reviewCount: landlord?.reviewCount ?? 0,
      },
      tenant: {
        id: tenantId,
        ratingAvg: tenant?.ratingAvg ?? 0,
        reviewCount: tenant?.reviewCount ?? 0,
      },
    };
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
};

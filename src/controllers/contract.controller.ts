import { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { Contract } from '../models/contract.model';
import { User } from '../models/user.model';
import { Property } from '../models/property.model';
import { generateContractPDF } from '../utils/pdfGenerator';
import { getCatalogByRegion } from '../policies/clauses';
import { CLAUSE_POLICY_VERSION } from '../policies/clauses/catalog.v1';
import { computePdfHash } from '../utils/pdfHash';
import { recordContractHistory } from '../utils/history';
import { ContractHistory } from '../models/history.model';
import { depositToEscrow, depositToAuthority } from '../utils/deposit';
import { signaturitProvider } from '../signature/signaturit';
import * as docusignProvider from '../core/signature/docusign.provider';
import { sendRentReminderEmail, sendContractRenewalNotification } from '../utils/notification';
import PDFDocument from 'pdfkit';
import { createContractAction, signContractAction, initiatePaymentAction } from '../core/contract.actions';
import { ensureStripeCustomerForUser } from '../core/stripeCustomer';
import type { ResolvedClause } from '../core/clauses.service';
import getRequestLogger from '../utils/requestLogger';
import { AppError, badRequest, notFound } from '../utils/errors';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

const supplyOptions = ['agua', 'luz', 'gas', 'internet'] as const;
const payerOptions = ['landlord', 'tenant', 'shared'] as const;
const penaltyOptions = ['none', '1monthPerYearPending'] as const;
const guaranteeOptions = ['none', 'aval', 'seguroImpago'] as const;

const buildOptionalClausesSchema = (landlordType: 'individual' | 'company') =>
  z
    .object({
      furnished: z.boolean(),
      inventoryAttached: z.boolean(),
      pets: z.enum(['allowed', 'forbidden', 'conditional'] as const),
      petsConditions: z.string().optional(),
      subleaseAllowed: z.boolean(),
      durationMonths: z.number().int().positive(),
      automaticExtension: z.boolean(),
      depositExtra: z.number().min(0).max(2),
      guarantee: z.enum(guaranteeOptions),
      rentUpdateINE: z.boolean(),
      paymentBySEPA: z.boolean(),
      communityAndIBI: z.object({
        payer: z.enum(payerOptions),
        annualCost: z.number().optional(),
      }),
      supplies: z.array(
        z.object({
          supply: z.enum(supplyOptions),
          payer: z.enum(payerOptions),
        }),
      ),
      minorWorksAllowed: z.boolean(),
      majorWorksWithAuth: z.boolean(),
      penalty: z.enum(penaltyOptions),
      habitualUseOnly: z.boolean(),
      teleworkAllowed: z.boolean(),
      landlordInsurance: z.boolean(),
      tenantInsurance: z.boolean(),
      digitalInventory: z.boolean(),
      digitalNotifications: z.boolean(),
    })
    .superRefine((data, ctx) => {
      const minDuration = landlordType === 'company' ? 84 : 60;
      if (data.durationMonths < minDuration) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['durationMonths'],
          message: `La duración mínima es de ${minDuration} meses para este tipo de arrendador`,
        });
      }
      if (!data.furnished && data.inventoryAttached) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['inventoryAttached'],
          message: 'Solo se puede adjuntar inventario si la vivienda está amueblada',
        });
      }
      if (data.pets === 'conditional' && !data.petsConditions?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['petsConditions'],
          message: 'Describe las condiciones para las mascotas',
        });
      }
      if (data.communityAndIBI.payer === 'tenant') {
        const cost = data.communityAndIBI.annualCost ?? 0;
        if (cost <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['communityAndIBI', 'annualCost'],
            message: 'Indica el coste anual de referencia',
          });
        }
      }
      const seen = new Set<string>();
      data.supplies.forEach(entry => {
        if (seen.has(entry.supply)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['supplies'],
            message: 'Cada suministro debe definirse una sola vez',
          });
        }
        seen.add(entry.supply);
      });
    });

type OptionalClauses = z.infer<ReturnType<typeof buildOptionalClausesSchema>>;

const normalizeOptionalClauses = (input: OptionalClauses): Record<string, any> => ({
  ...input,
  inventoryAttached: input.furnished ? input.inventoryAttached : false,
  petsConditions: input.pets === 'conditional' ? input.petsConditions?.trim() : undefined,
  communityAndIBI: {
    payer: input.communityAndIBI.payer,
    ...(input.communityAndIBI.payer === 'tenant'
      ? { annualCost: input.communityAndIBI.annualCost }
      : {}),
  },
});

const baseContractSchema = z.object({
  landlord: objectId,
  tenant: objectId,
  property: objectId,
  region: z.string().toLowerCase(),
  rent: z.number().positive(),
  deposit: z.number().min(0),
  startDate: z.string().transform((s: string) => new Date(s)),
  endDate: z.string().transform((s: string) => new Date(s)),
  landlordType: z.enum(['individual', 'company']).optional(),
});

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
  const rawClauses = req.body?.clauses;
  const isOptionalClauses = rawClauses && typeof rawClauses === 'object' && !Array.isArray(rawClauses);

  if (isOptionalClauses) {
    let base: z.infer<typeof baseContractSchema>;
    try {
      base = baseContractSchema.parse(req.body);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw badRequest('invalid_payload', error.flatten());
      }
      throw badRequest('invalid_payload');
    }

    let optionalClauses: Record<string, any>;
    try {
      const parsedOptional = buildOptionalClausesSchema(base.landlordType ?? 'individual').parse(rawClauses);
      optionalClauses = normalizeOptionalClauses(parsedOptional);
    } catch (validationErr: unknown) {
      if (validationErr instanceof ZodError) {
        return res.status(400).json({ error: 'invalid_optional_clauses', details: validationErr.flatten() });
      }
      return res.status(400).json({ error: (validationErr as any)?.message || 'invalid_optional_clauses' });
    }

    try {
      const contract = await createContractAction({
        landlordId: base.landlord,
        tenantId: base.tenant,
        propertyId: base.property,
        region: base.region,
        clauses: optionalClauses,
        rent: base.rent,
        deposit: base.deposit,
        startDate: base.startDate,
        endDate: base.endDate,
        landlordType: base.landlordType ?? 'individual',
      });
      return res.status(201).json({ message: 'Contrato creado', contract });
    } catch (err: any) {
      getRequestLogger(req).error({ err, body: req.body }, 'Error en createContract (optional clauses)');
      return res.status(400).json({ error: err.message || 'contract_creation_failed' });
    }
  }

  let data: z.infer<typeof createContractSchema>;
  try {
    data = createContractSchema.parse(req.body);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw badRequest('invalid_payload', error.flatten());
    }
    throw badRequest('invalid_payload');
  }

  const startTime = data.startDate.getTime();
  const endTime = data.endDate.getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) {
    throw badRequest('invalid_date_range');
  }

  const catalog = getCatalogByRegion(data.region);
  if (!catalog || Object.keys(catalog).length === 0) {
    throw badRequest('region_not_supported');
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
      throw new AppError((error as any).message, {
        status: (error as any).status,
        code: (error as any).message,
        details: { clauseId: (error as any).id },
      });
    }
    if (error instanceof ZodError) {
      throw badRequest('invalid_clause_params', error.flatten());
    }
    getRequestLogger(req).error({ err: error }, 'Error validando cláusulas');
    throw badRequest('clause_validation_failed');
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
    getRequestLogger(req).error({ err: error }, 'Error al crear el contrato');
    throw new AppError('contract_creation_failed', { status: 500, code: 'contract_creation_failed' });
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
    landlordType: landlordTypeRaw,
  } = req.body;
  const landlordType: 'individual' | 'company' = landlordTypeRaw === 'company' ? 'company' : 'individual';

  let optionalClauses: Record<string, any> | undefined;
  try {
    if (clauses && typeof clauses === 'object' && !Array.isArray(clauses)) {
      const parsed = buildOptionalClausesSchema(landlordType).parse(clauses);
      optionalClauses = normalizeOptionalClauses(parsed);
    }
  } catch (validationErr: any) {
    if (validationErr instanceof z.ZodError) {
      return res.status(400).json({ error: 'invalid_optional_clauses', details: validationErr.flatten() });
    }
    return res.status(400).json({ error: validationErr?.message || 'invalid_optional_clauses' });
  }
  const resolvedClauses = (req as any).resolvedClauses as ResolvedClause[] | undefined;
  try {
    const contract = await createContractAction({
      landlordId: landlord ?? landlordId,
      tenantId: tenant ?? tenantId,
      propertyId: property ?? propertyId,
      region,
      clauses: optionalClauses ?? clauses,
      resolvedClauses: Array.isArray(clauses) ? resolvedClauses : undefined,
      rent,
      deposit,
      startDate,
      endDate,
      iban,
      landlordType,
    });
    res.status(201).json({ message: 'Contrato creado', contract });
  } catch (err: any) {
    getRequestLogger(req).error({ err, body: req.body }, 'Error en createContract');
    res.status(400).json({ error: err.message });
  }
};

export const getContractPDF = async (req: Request, res: Response) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) throw notFound('Contrato no encontrado');

    const landlord = await User.findById(contract.landlord);
    const tenant = await User.findById(contract.tenant);
    const property = await Property.findById(contract.property);

    if (!landlord || !tenant || !property) {
      throw notFound('Datos incompletos para el contrato');
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
    const optionalClauses = !Array.isArray(contract.clauses) ? (contract.clauses as Record<string, any>) : {};

    const clauses = [
      `1. Objeto: uso y disfrute de la vivienda descrita.`,
      `2. Duración: ${Math.ceil((new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30))} meses, desde ${contract.startDate.toISOString().split('T')[0]} hasta ${contract.endDate.toISOString().split('T')[0]}.`,
      `3. Renta: €${contract.rent} mensuales, pagaderos antes del día 5 de cada mes.`,
      `4. Fianza: €${contract.deposit}, entregada en este acto conforme al artículo 36 LAU.`,
    ];

    if (optionalClauses && typeof optionalClauses === 'object') {
      const supplyLabel: Record<string, string> = {
        agua: 'agua',
        luz: 'luz',
        gas: 'gas',
        internet: 'internet',
      };
      const payerLabel: Record<string, string> = {
        landlord: 'el arrendador',
        tenant: 'el inquilino',
        shared: 'ambas partes al 50%',
      };

      if (optionalClauses.furnished) {
        clauses.push('La vivienda se entrega amueblada y el inquilino se obliga a conservar el mobiliario en el estado recibido.');
        if (optionalClauses.inventoryAttached) {
          clauses.push('Se incorpora inventario detallado de mobiliario y enseres como anexo al contrato.');
        }
      } else {
        clauses.push('La vivienda se entrega sin mobiliario, respondiendo el inquilino únicamente del desgaste por uso normal.');
      }

      if (optionalClauses.pets === 'allowed') {
        clauses.push('Se permite la estancia de mascotas siempre que no causen daños ni molestias a la comunidad.');
      } else if (optionalClauses.pets === 'forbidden') {
        clauses.push('No se permiten mascotas en la vivienda salvo autorización expresa posterior.');
      } else if (optionalClauses.pets === 'conditional') {
        clauses.push(`Se permiten mascotas bajo las siguientes condiciones: ${optionalClauses.petsConditions}.`);
      }

      if (optionalClauses.subleaseAllowed) {
        clauses.push('El subarriendo parcial requerirá consentimiento escrito del arrendador conforme al artículo 8 LAU.');
      } else {
        clauses.push('Queda prohibido el subarriendo total o parcial sin autorización escrita del arrendador.');
      }

      if (optionalClauses.automaticExtension) {
        clauses.push('A la finalización del plazo pactado el contrato se prorrogará automáticamente en los términos del artículo 10 LAU.');
      }

      if (typeof optionalClauses.depositExtra === 'number' && optionalClauses.depositExtra > 0) {
        clauses.push(`El inquilino entrega una garantía adicional equivalente a ${optionalClauses.depositExtra} mes(es) de renta, que se devolverá a la finalización del contrato.`);
      }

      if (optionalClauses.guarantee === 'aval') {
        clauses.push('El arrendatario entrega aval bancario a primer requerimiento para garantizar el cumplimiento de las obligaciones económicas.');
      } else if (optionalClauses.guarantee === 'seguroImpago') {
        clauses.push('El arrendador declara haber contratado un seguro de impago de rentas sin coste para el arrendatario.');
      } else {
        clauses.push('No se establece garantía adicional distinta a la fianza legal.');
      }

      if (optionalClauses.rentUpdateINE) {
        clauses.push('La renta se actualizará anualmente aplicando la variación anual del IPC publicado por el INE conforme al artículo 18 LAU.');
      } else {
        clauses.push('Las partes acuerdan que la renta permanecerá inalterada durante la vigencia contractual.');
      }

      if (optionalClauses.paymentBySEPA) {
        clauses.push('El pago de la renta se realizará mediante domiciliación SEPA en la cuenta indicada por el inquilino.');
      } else {
        clauses.push('Las partes podrán emplear transferencia u otros medios acordados para el pago de la renta.');
      }

      if (optionalClauses.communityAndIBI) {
        const payer = optionalClauses.communityAndIBI.payer;
        if (payer === 'tenant') {
          const amount = optionalClauses.communityAndIBI.annualCost ?? 0;
          clauses.push(`El inquilino asume el pago de la cuota de comunidad e IBI, con referencia anual de ${amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}.`);
        } else if (payer === 'landlord') {
          clauses.push('El arrendador asume los gastos de comunidad e IBI.');
        } else if (payer === 'shared') {
          clauses.push('Las partes compartirán los gastos de comunidad e IBI en la proporción que acuerden por escrito.');
        }
      }

      if (Array.isArray(optionalClauses.supplies)) {
        optionalClauses.supplies.forEach((item: any) => {
          if (supplyLabel[item.supply]) {
            clauses.push(`El suministro de ${supplyLabel[item.supply]} será abonado por ${payerLabel[item.payer]}.`);
          }
        });
      }

      if (optionalClauses.minorWorksAllowed) {
        clauses.push('Se permiten pequeñas actuaciones (pintura, colgar cuadros) siempre que no alteren la estructura ni instalaciones.');
      } else {
        clauses.push('No se autorizan obras menores sin consentimiento previo del arrendador.');
      }

      if (optionalClauses.majorWorksWithAuth) {
        clauses.push('Las obras mayores requerirán autorización escrita expresa del arrendador.');
      } else {
        clauses.push('Las obras que afecten a elementos estructurales quedan prohibidas salvo pacto posterior por escrito.');
      }

      if (optionalClauses.penalty === '1monthPerYearPending') {
        clauses.push('En caso de desistimiento anticipado el arrendatario abonará como indemnización un mes de renta por cada año del contrato que reste por cumplir, prorrateándose los períodos inferiores, conforme al artículo 11 LAU.');
      }

      if (optionalClauses.habitualUseOnly) {
        clauses.push('La vivienda se destinará exclusivamente a domicilio habitual del arrendatario y su unidad familiar.');
      }
      if (optionalClauses.teleworkAllowed) {
        clauses.push('Se permite el teletrabajo sin atención al público ni instalación de maquinaria industrial.');
      } else {
        clauses.push('No se permitirá el ejercicio de actividades profesionales que impliquen atención al público en la vivienda.');
      }

      if (optionalClauses.landlordInsurance) {
        clauses.push('El arrendador mantendrá un seguro de continente en vigor durante la vigencia del contrato.');
      }
      if (optionalClauses.tenantInsurance) {
        clauses.push('El arrendatario contratará un seguro de responsabilidad civil y contenido que cubra los daños ocasionados en la vivienda.');
      } else {
        clauses.push('Se recomienda al arrendatario la contratación de un seguro de contenido, sin constituir obligación contractual.');
      }

      if (optionalClauses.digitalInventory) {
        clauses.push('Se incorpora inventario digital (fotográfico) accesible a través de la plataforma RentalApp.');
      }
      if (optionalClauses.digitalNotifications) {
        clauses.push('Ambas partes aceptan las notificaciones electrónicas enviadas por email o a través de la aplicación como medio válido de comunicación.');
      } else {
        clauses.push('Las notificaciones entre las partes se realizarán por escrito mediante carta certificada o burofax.');
      }
    }
    clauses.forEach(c => doc.fontSize(10).text(c).moveDown(0.3));

    doc.moveDown(2);
    const sigY = doc.y;
    doc.text('__________________________', 80, sigY);
    doc.text('__________________________', 350, sigY);
    doc.text(`Arrendador: ${landlord.name}`, 80, sigY + 15);
    doc.text(`Inquilino: ${tenant.name}`, 350, sigY + 15);

    doc.end();

  } catch (err: any) {
    getRequestLogger(req).error({ err, contractId: req.params.id }, 'Error generando el PDF del contrato');
    throw new AppError('Error generando el PDF', { status: 500, code: 'contract_pdf_failed' });
  }
};

export const signContract = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const contract = await signContractAction(req.params.id, user);
    res.json({ message: 'Contrato firmado', contract });
  } catch (err: any) {
    getRequestLogger(req).error({ err, contractId: req.params.id }, 'Error al firmar contrato');
    res.status(400).json({ error: err.message });
  }
};

export const getContractHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await ContractHistory.find({ contract: id }).sort({ timestamp: 1 });
    res.json(history);
  } catch (error) {
    getRequestLogger(req).error({ err: error, contractId: req.params.id }, 'Error al obtener historial de contrato');
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
    getRequestLogger(req).error({ err: error, contractId: req.params.id }, 'Error iniciando pago de contrato');
    if (error.message === 'Solo el inquilino puede iniciar pagos') {
      return res.status(403).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

export const payDeposit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { destination, successUrl, cancelUrl } = req.body;
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
      const sessionUrl = await depositToEscrow(
        contract.id,
        depositAmount,
        successUrl || process.env.DEPOSIT_SUCCESS_URL || 'https://example.com/deposit/success',
        cancelUrl || process.env.DEPOSIT_CANCEL_URL || 'https://example.com/deposit/cancel'
      );
      res.json({ message: 'Iniciando pago de fianza', sessionUrl });
    } else {
      await depositToAuthority(contract.id, depositAmount);
      contract.depositPaid = true;
      contract.depositPaidAt = new Date();
      await contract.save();
      await recordContractHistory(contract.id, 'depositPaid', `Fianza pagada a ${dest}`);
      res.json({ message: 'Fianza pagada', contract });
    }
  } catch (error: any) {
    getRequestLogger(req).error({ err: error, contractId: req.params.id }, 'Error pagando fianza');
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
    await Promise.all([
      ensureStripeCustomerForUser(String(tenant._id || tenant.id), 'signature:tenant'),
      ensureStripeCustomerForUser(String(landlord._id || landlord.id), 'signature:landlord'),
    ]);
    const catalogForSignature = contract.region ? getCatalogByRegion(contract.region) : null;
    const clausesText = Array.isArray(contract.clauses)
      ? contract.clauses.map(clause => {
          const current = clause as any;
          const definition = catalogForSignature?.[current.id];
          if (definition) {
            try {
              return `• ${definition.label}\n${definition.render(current.params ?? {})}`; 
            } catch (err) {
              getRequestLogger(req).error({ err, contractId: contract.id }, 'Error renderizando cláusula para firma');
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
    getRequestLogger(req).error({ err: error, contractId: req.params.id }, 'Error solicitando firma');
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
    getRequestLogger(req).error({ err: error, contractId: req.params.id }, 'Error enviando recordatorio de renta');
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
    getRequestLogger(req).error({ err: error, contractId: req.params.id }, 'Error enviando notificaciones de renovación');
    res.status(500).json({ error: 'Error enviando notificaciones', details: error.message });
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
    const userIdForStripe = user?.id || user?._id;
    if (userIdForStripe && (user.role === 'tenant' || user.role === 'landlord')) {
      await ensureStripeCustomerForUser(String(userIdForStripe), `list_contracts:${user.role}`);
    }
    if (user.role !== 'admin') {
      q.$or = [{ landlord: user.id }, { tenant: user.id }];
    }

    const [items, total] = await Promise.all([
      Contract.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Contract.countDocuments(q)
    ]);

    if (user.role !== 'admin' && total === 0) {
        return res.status(200).json({ items: [], total: 0, page, limit });
    }

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
    if (!user) {
      return res.status(403).json({ error: 'No autorizado' });
    }
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

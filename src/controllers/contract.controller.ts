import { Request, Response } from 'express';
import fs from 'fs/promises';
import { z, ZodError } from 'zod';
import { Contract } from '../models/contract.model';
import { Types } from 'mongoose';
import { User } from '../models/user.model';
import { Property } from '../models/property.model';
import { generateContractPDF } from '../utils/pdfGenerator';
import { contractRegionKey, getCatalogByRegion } from '../policies/clauses';
import { CLAUSE_POLICY_VERSION } from '../policies/clauses/catalog.v1';
import { computePdfHash } from '../utils/pdfHash';
import { recordContractHistory } from '../utils/history';
import { ContractHistory } from '../models/history.model';
import { signaturitProvider } from '../signature/signaturit';
import { ensureFirmaSignature, ensureLandlordOrAdmin, initSignature, renderClausesForSignature, toContractView, urlsVisibleTo } from '../services/signature.service';
import * as docusignProvider from '../services/signature/docusign.provider';
import { sendContractReadyEmail } from '../utils/email';
import PDFDocument from 'pdfkit';
import { signContractAction } from '../services/contract.actions';
import { recordFunnelEvent } from '../services/funnelEvents.service';
import { generateContractPdfFile } from '../services/pdfGenerator';
import { evaluateAndPersist } from '../modules/rentalPublic';
// @ts-ignore
import { ensureCanReadContract, isActiveCoTenant } from '../utils/contractAccess';
import { ContractParty } from '../models/contractParty.model';

const objectId = z.string().regex(/^[a-f\d]{24}$/i).transform((s: string) => s.toLowerCase());

const createContractSchema = z.object({
  landlord: objectId,
  tenant: objectId,
  property: objectId,
  // Opcional: la región sale del inmueble; si viene, tiene que coincidir con la suya.
  region: z.string().toLowerCase().optional(),
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

/**
 * Quién puede crear un contrato sobre un inmueble (A2): el propietario, la agencia que lo gestiona
 * (`agencyAccess: 'manage'`) o un administrador. El arrendador del contrato tiene que ser el dueño
 * del inmueble y el inquilino, otra cuenta que exista.
 */
async function checkContractParties(
  actor: any,
  data: { landlord: string; tenant: string; property: string },
): Promise<{ status: number; error: string; property?: any }> {
  const property: any = await Property.findById(data.property)
    .select('owner agencyId agencyAccess refAgencyId region')
    .lean();
  if (!property) return { status: 404, error: 'property_not_found' };

  const actorId = String(actor?._id ?? actor?.id ?? '');
  const role = actor?.role;
  const allowed =
    role === 'admin' ||
    (role === 'landlord' && String(property.owner) === actorId) ||
    (role === 'agency' &&
      property.agencyId != null &&
      String(property.agencyId) === actorId &&
      property.agencyAccess === 'manage');
  if (!allowed) return { status: 403, error: 'forbidden' };

  if (String(property.owner) !== data.landlord) return { status: 400, error: 'landlord_not_owner' };
  if (data.tenant === data.landlord) return { status: 400, error: 'tenant_is_landlord' };
  if (!(await User.exists({ _id: data.tenant }))) return { status: 400, error: 'tenant_not_found' };
  return { status: 200, error: '', property };
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

  const actor: any = req.user;
  let parties: Awaited<ReturnType<typeof checkContractParties>>;
  try {
    parties = await checkContractParties(actor, data);
  } catch (error) {
    console.error('Error al crear el contrato:', error);
    return res.status(500).json({ error: 'contract_creation_failed' });
  }
  if (parties.status !== 200) return res.status(parties.status).json({ error: parties.error });

  // La región (y con ella la fianza autonómica) es la del inmueble, no la que diga el cuerpo.
  const region = contractRegionKey(parties.property?.region);
  if (data.region && contractRegionKey(data.region) !== data.region) {
    return res.status(400).json({ error: 'region_not_supported' });
  }
  if (!region) return res.status(400).json({ error: 'region_not_supported' });
  if (data.region && data.region !== region) {
    return res.status(400).json({ error: 'region_mismatch', propertyRegion: region });
  }
  const catalog = getCatalogByRegion(region);
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
    const actorIdRaw = actor?._id ?? actor?.id;
    const isAgency = actor?.role === 'agency';

    let agencyIdToAttach: any = undefined;
    if (isAgency && actorIdRaw) {
      agencyIdToAttach = actorIdRaw;
    }

    // Atribución de captación: si la propiedad vino de un propietario dado de alta
    // por una agencia, esta cobra share del primer contrato y de las renovaciones
    // con el mismo inquilino. Un inquilino nuevo corta la atribución.
    let refAgencyIdToAttach: any = undefined;
    if (!agencyIdToAttach) {
      const propertyDoc: any = parties.property;
      if (propertyDoc?.refAgencyId) {
        const priorContracts = await Contract.find({ property: data.property })
          .select('tenant')
          .lean();
        const sameTenantChain = priorContracts.every(
          (c: any) => String(c.tenant) === String(data.tenant),
        );
        if (sameTenantChain) {
          refAgencyIdToAttach = propertyDoc.refAgencyId;
        }
      }
    }

    const contract = await Contract.create({
      landlord: data.landlord,
      tenant: data.tenant,
      property: data.property,
      agencyId: agencyIdToAttach,
      refAgencyId: refAgencyIdToAttach,
      region,
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

    const actorId = req.user?.id;
    await recordContractHistory(contract._id, 'CREATED', actorId, {
      region,
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

    try {
      await evaluateAndPersist(String(contract._id), {
        changeDate: contract.startDate,
        reason: 'contract_created',
        source: 'system',
        requestId: (res.locals as any)?.requestId,
      });
    } catch (complianceErr) {
      console.error('Error evaluando compliance Rental Public:', {
        contractId: String(contract._id),
        message: (complianceErr as any)?.message,
        stack: (complianceErr as any)?.stack,
      });
    }

    await recordFunnelEvent(req, 'contract', {
      resourceType: 'contract',
      resourceId: String(contract._id),
      meta: { propertyId: String(contract.property), landlordId: String(contract.landlord), tenantId: String(contract.tenant) },
    });

    return res.status(201).json({ contract: { ...contract.toObject(), pdfPath: publicPath, pdfHash } });
  } catch (error) {
    console.error('Error al crear el contrato:', error);
    return res.status(500).json({ error: 'contract_creation_failed' });
  }
}

export const getContractPDF = async (req: Request, res: Response) => {
  try {
    if (!(await isActiveCoTenant(req.params.id, req.user?.id))) {
      await ensureCanReadContract({ contractId: req.params.id, user: req.user as any });
    }
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
    // Los errores de acceso de ensureCanReadContract traen su estado (400/403/404).
    if (err?.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Error generando el PDF' });
  }
};

export const signContract = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id || !user?.role) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const userRef = { id: String(user.id), role: String(user.role) };
    const contract = await signContractAction(req.params.id, userRef);
    res.json({ message: 'Contrato firmado', contract });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

export const getContractHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ensureCanReadContract({ contractId: id, user: req.user as any });
    const history = await ContractHistory.find({ contract: id }).sort({ timestamp: 1 });
    res.json(history);
  } catch (error) {
    console.error(error);
    const status = (error as any)?.status || 500;
    res.status(status).json({ error: status === 403 ? 'forbidden' : 'Error al obtener el historial del contrato' });
  }
};

export const requestSignature = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    ensureLandlordOrAdmin(contract, req.user as any);
    const landlord = await User.findById(contract.landlord);
    const tenant = await User.findById(contract.tenant);
    const property = await Property.findById(contract.property);
    if (!landlord || !tenant || !property) {
      return res.status(404).json({ error: 'Datos incompletos para el contrato' });
    }
    const provider = (process.env.SIGN_PROVIDER || 'mock').toLowerCase();
    if (provider === 'firma') {
      const result = await initSignature(id, req.user as any);
      return res.json({ envelopeId: result.envelopeId, status: result.status, recipientUrls: result.recipientUrls });
    }
    const clausesText = renderClausesForSignature(contract);
    const { absolutePath: signaturePdfPath } = await generateContractPDF({ contract, clausesText });

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
          status: 'pending_signature',
        },
      });
      await recordContractHistory(contract.id, 'signatureRequested', 'Firma DocuSign solicitada');
      return res.json({ envelopeId: env.envelopeId, status: env.status, recipientUrls: urlsVisibleTo(contract, req.user as any, env.recipientUrls) });
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
    if (error?.status && error.status < 500) return res.status(error.status).json({ error: error.message });
    res.status(500).json({ error: 'Error iniciando la firma', details: error.message });
  }
};

export const createSigningSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const signProvider = (process.env.SIGN_PROVIDER || 'mock').toLowerCase();
    if (signProvider === 'firma') {
      const contract = await Contract.findById(id);
      if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
      if (String(contract.tenant) !== user?.id) {
        return res.status(403).json({ error: 'Solo el inquilino puede firmar este contrato' });
      }
      try {
        const { recipientUrls } = await ensureFirmaSignature(contract);
        if (!recipientUrls?.tenantUrl) return res.status(502).json({ error: 'Firma.dev no devolvió el enlace de firma' });
        return res.json({ signingUrl: recipientUrls.tenantUrl, provider: 'firma' });
      } catch (error: any) {
        console.error('Error Firma.dev:', error);
        const status = error?.status || 502;
        return res.status(status).json({ error: status === 502 ? 'Error al conectar con Firma.dev' : error.message });
      }
    }
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

    let flow: Awaited<ReturnType<typeof signaturitProvider.createSignatureFlow>>;
    try {
      flow = await signaturitProvider.createSignatureFlow({
        contractId: String(contract._id),
        pdfPath,
        signers: [
          {
            role: 'tenant',
            userId: String(tenant?._id || contract.tenant),
            name: tenant?.name || (contract as any).tenantName || 'Inquilino',
            email: tenant?.email || (contract as any).tenantEmail || 'email@test.com',
          },
        ],
        returnUrl: process.env.SIGN_REDIRECT_URL || 'https://example.com/signing-complete',
        webhookUrl: process.env.SIGN_WEBHOOK_URL || 'https://api.example.com/webhook/signature',
      });
    } finally {
      // El PDF lleva DNI: se borra también si el proveedor falla
      await fs.unlink(pdfPath).catch(() => {});
    }
    const { requestId, signerLinks } = flow;

    const signingUrl = signerLinks.tenant;

    contract.signature = {
      ...(contract.signature || {}),
      provider: 'signaturit' as any,
      envelopeId: requestId,
      status: 'sent',
      updatedAt: new Date(),
      recipientUrls: { tenantUrl: signingUrl },
    };
    contract.status = 'pending_signature';
    await contract.save();

    res.json({ signingUrl });
  } catch (error: any) {
    console.error('Error Signaturit:', error);
    res.status(500).json({ error: 'Error al conectar con proveedor de firma' });
  }
};

export const listContracts = async (req: Request, res: Response) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const q: any = {};
    if (typeof req.query.status === 'string' && req.query.status) q.status = req.query.status;
    // Opcional: «Mis contratos» pide también los contratos en los que el usuario es co-titular.
    // El resto de pantallas (incidencias, panel del casero) siguen viendo solo casero e inquilino principal.
    const includeCoTenant = req.query.include === 'cotenant';
    let coTenantIds = new Set<string>();

    const user = req.user;
    if (!user) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (user.role === 'agency') {
      // Agencies can only see contracts for properties they still manage (pre-handoff).
      const managedProperties = await Property.find({
        agencyId: user.id,
        agencyAccess: 'manage',
      })
        .select('_id')
        .lean();
      const ids = managedProperties.map(p => p._id);
      q.property = { $in: ids.length ? ids : [new Types.ObjectId('000000000000000000000000')] };
      q.agencyId = user.id;
    } else if (user.role !== 'admin') {
      q.$or = [{ landlord: user.id }, { tenant: user.id }];
      if (includeCoTenant && user.id && Types.ObjectId.isValid(user.id)) {
        const parties = await ContractParty.find({
          role: 'TENANT',
          userId: user.id,
          status: { $in: ['JOINED', 'SIGNED'] },
        })
          .select('contractId')
          .lean();
        coTenantIds = new Set(parties.map(p => String(p.contractId)));
        if (coTenantIds.size) q.$or.push({ _id: { $in: [...coTenantIds] } });
      }
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
      const myRole =
        ownerId === String(user.id) ? 'landlord'
        : tenantId === String(user.id) ? 'tenant'
        : coTenantIds.has(String(c._id)) ? 'cotenant'
        : undefined;
      return {
        ...toContractView(c as any, user as any),
        ownerId,
        tenantId,
        ...(myRole ? { myRole } : {}),
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
    const user = req.user;
    if (!user) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const c = await Contract.findById(req.params.id)
      .populate('property')
      .populate({ path: 'landlord', select: 'name email ratingAvg reviewCount' })
      .populate({ path: 'tenant', select: 'name email ratingAvg reviewCount' })
      .lean();
    if (!c) return res.status(404).json({ error: 'Contrato no encontrado' });

    if (user.role === 'agency') {
      const property: any = (c as any).property;
      const managesStill =
        property?.agencyAccess === 'manage' &&
        String(property?.agencyId || '') === String(user.id) &&
        String((c as any).agencyId || '') === String(user.id);
      if (!managesStill) {
        return res.status(403).json({ error: 'forbidden' });
      }
    }

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
    // La agencia gestora ya pasó la comprobación de arriba; antes caía aquí en 403.
    const isAgency = user.role === 'agency';
    // Co-titular que ya aceptó la invitación: puede ver el contrato que va a firmar.
    const isCoTenant =
      !isLandlord && !isTenant && !isAdmin && !isAgency && (await isActiveCoTenant(c._id, user.id));

    if (!isLandlord && !isTenant && !isAdmin && !isAgency && !isCoTenant) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const result: any = {
      ...toContractView(c as any, user as any),
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

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
/**
 * Create a new rental contract. Requires the tenantId, propertyId, rent,
 * deposit, startDate and endDate in the request body. The landlord is
 * inferred from the property owner.
 */
export const createContract = async (req: Request, res: Response) => {
  const { tenantId, propertyId, rent, deposit, startDate, endDate, iban } = req.body;
  try {
    // Ensure the property exists
    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    // Compose a new contract document. Optionally encrypt and store the IBAN
    const newContractData: any = {
      landlord: property.ownerId,
      tenant: tenantId,
      property: propertyId,
      rent,
      deposit,
      startDate,
      endDate,
    };
    if (iban) {
      try {
        newContractData.ibanEncrypted = encryptIBAN(iban);
      } catch (encErr) {
        const message = (encErr as any)?.message || String(encErr);
        return res.status(400).json({ error: 'Error al encriptar el IBAN', details: message });
      }
    }
    const contract = new Contract(newContractData);
    await contract.save();
    // Record history entry for creation
    await recordContractHistory(contract.id, 'created', 'Contrato creado');
    // After saving the contract we can send notification emails to landlord and tenant.
    try {
      const landlord = await User.findById(property.ownerId);
      const tenant = await User.findById(tenantId);
      if (landlord?.email) {
        await sendContractCreatedEmail(landlord.email, contract.id);
      }
      if (tenant?.email) {
        await sendContractCreatedEmail(tenant.email, contract.id);
      }
    } catch (notifyErr) {
      // Log and proceed; email errors should not block the response
      console.error('Error enviando notificaciones:', notifyErr);
    }
    res.status(201).json({ message: 'Contrato creado', contract });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Generate and return a PDF representation of a contract. The endpoint
 * expects the contract id as a path parameter.
 */
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

    // Preparar cabeceras HTTP para la descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=contrato_${contract._id}.pdf`
    );

    // Crear documento PDF en streaming
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // ======================
    // Contenido del contrato
    // ======================
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

    // Finalizar y enviar
    doc.end();

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Error generando el PDF' });
  }
};

/**
 * Sign an existing contract. Marks the contract as signed by the tenant and
 * records the signature timestamp.
 */
export const signContract = async (req: Request, res: Response) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Autenticación requerida' });
    let actionLabel = '';
    // Determine who is signing based on the user's role
    if (user.role === 'tenant') {
      if (contract.signedByTenant) {
        return res.status(400).json({ error: 'El inquilino ya ha firmado este contrato' });
      }
      contract.signedByTenant = true;
      actionLabel = 'signedByTenant';
    } else if (user.role === 'landlord') {
      if (contract.signedByLandlord) {
        return res.status(400).json({ error: 'El arrendador ya ha firmado este contrato' });
      }
      contract.signedByLandlord = true;
      actionLabel = 'signedByLandlord';
    } else {
      return res.status(403).json({ error: 'Rol no autorizado para firmar' });
    }
    // If both parties have signed, set or update signedAt to now and activate
    if (contract.signedByTenant && contract.signedByLandlord) {
      contract.signedAt = new Date();
      // When both have signed, mark the contract as active
      contract.status = 'active';
    }
    await contract.save();
    // Record history entry
    await recordContractHistory(contract.id, actionLabel, `Contrato firmado por ${user.role}`);
    // Notify the other party that the contract has been signed
    try {
      const landlord = await User.findById(contract.landlord);
      const tenant = await User.findById(contract.tenant);
      // Determine which party should be notified
      if (user.role === 'tenant' && landlord?.email) {
        await sendContractCreatedEmail(landlord.email, contract.id);
      } else if (user.role === 'landlord' && tenant?.email) {
        await sendContractCreatedEmail(tenant.email, contract.id);
      }
    } catch (notifyErr) {
      console.error('Error enviando notificaciones de firma:', notifyErr);
    }
    res.json({ message: 'Contrato firmado', contract });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Error al firmar el contrato' });
  }
};

/**
 * Retrieve the change history for a given contract. Returns an array of
 * history entries sorted by timestamp ascending.
 */
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

/**
 * Initiate an automatic SEPA Direct Debit payment for a contract using Stripe.
 * If the contract does not yet have a Stripe customer ID, this handler
 * decrypts the stored IBAN, creates a customer and attaches a mandate.
 * The amount can be provided in the body; if omitted, the monthly rent is used.
 */
export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    // Only tenants can initiate payments for rent/deposit
    const user = (req as any).user;
    if (user.role !== 'tenant' || String(contract.tenant) !== user.id) {
      return res.status(403).json({ error: 'Solo el inquilino puede iniciar pagos' });
    }
    let customerId = contract.stripeCustomerId;
    // If no customer ID, decrypt IBAN and create customer + mandate
    if (!customerId) {
      if (!contract.ibanEncrypted) {
        return res.status(400).json({ error: 'El contrato no tiene un IBAN asociado' });
      }
      // Decrypt IBAN from contract
      let iban: string;
      try {
        iban = decryptIBAN(contract.ibanEncrypted);
      } catch (decErr) {
        const message = (decErr as any)?.message || String(decErr);
        return res.status(400).json({ error: 'No se pudo descifrar el IBAN', details: message });
      }
      const tenant = await User.findById(contract.tenant);
      if (!tenant) return res.status(404).json({ error: 'Inquilino no encontrado' });
      customerId = await createCustomerAndMandate(tenant.name, tenant.email, iban);
      contract.stripeCustomerId = customerId;
      await contract.save();
    }
    // Determine payment amount (EUR). Use contract rent if no amount specified
    const payAmount = typeof amount === 'number' && amount > 0 ? amount : contract.rent;
    const paymentIntent = await createPaymentIntent(customerId, payAmount, 'eur');
    await recordContractHistory(contract.id, 'paymentInitiated', `Pago iniciado por €${payAmount / 1}`);
    res.json({ message: 'Pago iniciado', clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: 'Error iniciando el pago', details: error.message });
  }
};

/**
 * Handles the payment of the deposit (fianza) for a contract. A deposit can
 * either be held by the platform (escrow) or transferred to a public
 * authority. The caller must specify a 'destination' in the body with
 * values 'escrow' (default) or 'authority'. Only the tenant of the
 * contract may pay the deposit. Once a deposit is paid the contract's
 * depositPaid flag is set and a history entry is recorded.
 */
export const payDeposit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { destination } = req.body;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ error: 'Contrato no encontrado' });
    // Only the tenant associated with the contract can pay the deposit
    const user = (req as any).user;
    if (user.role !== 'tenant' || String(contract.tenant) !== user.id) {
      return res.status(403).json({ error: 'Solo el inquilino puede pagar la fianza' });
    }
    // Prevent paying the deposit twice
    if (contract.depositPaid) {
      return res.status(400).json({ error: 'La fianza ya ha sido pagada' });
    }
    const depositAmount = contract.deposit;
    // Determine destination; default to escrow
    const dest = destination === 'authority' ? 'authority' : 'escrow';
    if (dest === 'escrow') {
      await depositToEscrow(contract.id, depositAmount);
    } else {
      await depositToAuthority(contract.id, depositAmount);
    }
    // Mark deposit as paid
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

/**
 * Initiates an electronic signature process for a contract. Generates the
 * PDF for the contract, sends it to the configured signature provider
 * and returns a URL where the user can sign the document. This endpoint
 * can be called by either party (tenant or landlord) but only once per
 * contract. After initiating, the signature provider will send webhooks or
 * require polling to update the status.
 */
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
    // Build PDF payload
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
    // Determine who is requesting the signature and set up the signer
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
    // For demonstration we store the envelopeId on the contract document for later
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

/**
 * Sends a rent payment reminder to the tenant associated with the
 * contract. This can be used by a landlord to nudge the tenant before
 * automatic charges or by a scheduled task. It records a history entry.
 */
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

/**
 * Sends a contract renewal notification to both landlord and tenant when a
 * contract is close to its end date. This would typically be triggered
 * by a scheduled job but can also be invoked manually via this endpoint.
 */
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
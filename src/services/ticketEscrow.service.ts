import Escrow from '../models/escrow.model';
import Ticket from '../models/ticket.model';
import PlatformEarning from '../models/platformEarning.model';
import { releasePayment } from '../utils/payment';
import { calcPlatformFee } from '../utils/calcFee';

/**
 * Pasado este tiempo, una liberación en `releasing` se da por abandonada (proceso caído, error
 * de base de datos a mitad) y otra petición o el job de recuperación pueden retomarla.
 */
export const ESCROW_RELEASE_TTL_MS = 2 * 60 * 1000;

const httpError = (message: string, status: number) => Object.assign(new Error(message), { status });

/**
 * Libera el escrow de un ticket en pasos que se pueden repetir sin efectos dobles:
 *
 *   1. held → releasing (atómico; fija el desglose y quién lo pidió)
 *   2. captura en Stripe con clave de idempotencia; la referencia se guarda en el escrow
 *   3. ganancia de la plataforma (upsert por escrowId)
 *   4. cierre del ticket
 *   5. releasing → released (siempre lo último)
 *
 * Si el proceso se corta en cualquier punto, el escrow se queda en `releasing` y una llamada
 * posterior (el usuario repitiendo o `resumeStuckEscrowReleases`) continúa desde el paso que
 * falta: nunca vuelve a capturar un pago ya capturado ni duplica la ganancia.
 */
export async function releaseTicketEscrow(ticketId: string, actor: string, action: string) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket?.escrowId) throw httpError('no escrow', 400);

  const now = new Date();
  let esc = await Escrow.findOneAndUpdate(
    {
      _id: ticket.escrowId,
      $or: [
        { status: 'held' },
        { status: 'releasing', releasingAt: { $lt: new Date(now.getTime() - ESCROW_RELEASE_TTL_MS) } },
        // Escrows que ya estaban en releasing antes de existir releasingAt
        { status: 'releasing', releasingAt: { $exists: false } },
      ],
    },
    { $set: { status: 'releasing', releasingAt: now } },
    { new: true },
  );
  if (!esc) {
    const current = await Escrow.findById(ticket.escrowId).select('status').lean();
    if (current?.status === 'releasing') throw httpError('release_in_progress', 409);
    throw httpError('escrow_not_held', 409);
  }

  // El desglose y el autor se fijan en el primer intento: un reintento no los recalcula
  if (!esc.breakdown?.gross || !esc.releaseAction) {
    const gross = (ticket.quote?.amount ?? 0) + (ticket.extra?.status === 'approved' ? ticket.extra.amount : 0);
    esc = (await Escrow.findByIdAndUpdate(
      esc._id,
      {
        $set: {
          ...(esc.breakdown?.gross ? {} : { breakdown: calcPlatformFee(gross) }),
          ...(esc.releaseAction ? {} : { releaseAction: action, releaseActor: actor }),
        },
      },
      { new: true },
    ))!;
  }
  const breakdown = esc.breakdown!;

  // 2) Captura, solo si no consta ya
  if (!esc.releaseRef) {
    let rel;
    try {
      rel = await releasePayment({
        ref: esc.paymentRef!,
        amount: breakdown.gross,
        currency: 'eur',
        fee: breakdown.fee,
        meta: { ticketId: String(ticket._id) },
        idempotencyKey: `escrow-release-${String(esc._id)}`,
      });
    } catch (err) {
      // Seguro aunque Stripe sí llegara a capturar: el reintento usa la misma clave de
      // idempotencia y, si ha caducado, releasePayment reconoce el PaymentIntent ya capturado.
      await Escrow.updateOne(
        { _id: esc._id, status: 'releasing', releaseRef: { $exists: false } },
        { $set: { status: 'held' }, $unset: { releasingAt: 1 } },
      );
      throw err;
    }
    await Escrow.updateOne(
      { _id: esc._id, releaseRef: { $exists: false } },
      {
        $set: { releaseRef: rel.ref },
        $push: { ledger: { ts: new Date(), type: 'release', payload: { ...rel, breakdown } } },
      },
    );
    esc.releaseRef = rel.ref;
  }

  // 3) Ganancia de la plataforma: una por escrow
  await PlatformEarning.updateOne(
    { escrowId: String(esc._id) },
    {
      $setOnInsert: {
        kind: 'rent',
        ticketId: String(ticket._id),
        escrowId: String(esc._id),
        gross: breakdown.gross,
        fee: breakdown.fee,
        netToPro: breakdown.netToPro,
        currency: esc.currency || 'EUR',
        releaseRef: esc.releaseRef,
        proId: ticket.proId,
        serviceKey: ticket.service,
      },
    },
    { upsert: true },
  );

  // 4) Cierre del ticket
  await Ticket.updateOne(
    { _id: ticket._id, status: { $ne: 'closed' } },
    {
      $set: { status: 'closed' },
      $push: { history: { ts: new Date(), actor: esc.releaseActor || actor, action: esc.releaseAction || action, payload: breakdown } },
    },
  );

  // 5) Hecho
  const released = await Escrow.findOneAndUpdate(
    { _id: esc._id, status: 'releasing' },
    { $set: { status: 'released' }, $unset: { releasingAt: 1 } },
    { new: true },
  );
  return {
    ticket: (await Ticket.findById(ticket._id))!,
    escrow: released || (await Escrow.findById(esc._id))!,
  };
}

/**
 * Termina las liberaciones que se quedaron a medias (en `releasing` más allá del TTL).
 * Devuelve cuántas se completaron y cuáles siguen fallando.
 */
export async function resumeStuckEscrowReleases() {
  const cutoff = new Date(Date.now() - ESCROW_RELEASE_TTL_MS);
  const stuck = await Escrow.find({
    status: 'releasing',
    $or: [{ releasingAt: { $lt: cutoff } }, { releasingAt: { $exists: false } }],
  })
    .select('ticketId releaseActor releaseAction')
    .lean();

  let completed = 0;
  const failed: { escrowId: string; error: string }[] = [];
  for (const esc of stuck) {
    try {
      await releaseTicketEscrow(esc.ticketId, esc.releaseActor || 'system', esc.releaseAction || 'released_by_recovery');
      completed++;
    } catch (err: any) {
      failed.push({ escrowId: String(esc._id), error: err?.message || String(err) });
    }
  }
  return { found: stuck.length, completed, failed };
}

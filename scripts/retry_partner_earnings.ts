import 'dotenv/config';
import mongoose from 'mongoose';
import { stripe } from '../src/utils/stripe';
import { PartnerEarning } from '../src/models/partnerEarning.model';

async function main() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI;
  if (!mongoUrl) throw new Error('Missing MONGO_URL');
  await mongoose.connect(mongoUrl);

  const limit = Number(process.env.RETRY_PARTNER_EARNINGS_LIMIT || 25);
  const docs = await PartnerEarning.find({
    kind: 'rent_fee_share',
    status: 'failed',
    stripeTransferId: { $exists: false },
  })
    .sort({ updatedAt: 1, _id: 1 })
    .limit(Number.isFinite(limit) ? limit : 25);

  console.log(`[retry_partner_earnings] found=${docs.length}`);

  for (const d of docs as any[]) {
    const idempotencyKey = `partner_earning:rent_fee_share:${d.stripeEventId}`;
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: d.partnerShareCents,
          currency: d.currency || 'eur',
          destination: d.destinationStripeAccountId,
          transfer_group: d.transferGroup,
          metadata: {
            kind: d.kind,
            contractId: String(d.contractId),
            stripePaymentIntentId: d.stripePaymentIntentId,
            sharePct: String(d.sharePct),
            platformFeeCents: String(d.platformFeeCents),
          },
        },
        { idempotencyKey },
      );

      d.stripeTransferId = transfer.id;
      d.status = 'created';
      d.error = undefined;
      await d.save();
      console.log(`[retry_partner_earnings] ok id=${String(d._id)} transfer=${transfer.id}`);
    } catch (e: any) {
      d.error = String(e?.message || 'transfer_failed');
      await d.save();
      console.error(`[retry_partner_earnings] fail id=${String(d._id)} error=${d.error}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });


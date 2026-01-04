import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Contract } from '../src/models/contract.model';
import Ticket from '../src/models/ticket.model';
import Appointment from '../src/models/appointment.model';
import ServiceOffer from '../src/models/serviceOffer.model';
import { Application } from '../src/models/application.model';
import { Property } from '../src/models/property.model';
import { ensureDirectConversation } from '../src/utils/ensureDirectConversation';

dotenv.config();

type Pair = [string, string];

function addPair(set: Set<string>, a?: string, b?: string) {
  if (!a || !b) return;
  const key = [String(a), String(b)].sort().join(':');
  set.add(key);
}

async function run() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/rentalapp';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const pairs = new Set<string>();

  const contracts = await Contract.find({}).select('tenant landlord').lean();
  contracts.forEach(c => addPair(pairs, String(c.tenant), String(c.landlord)));

  const tickets = await Ticket.find({}).select('openedBy ownerId proId').lean();
  tickets.forEach(t => {
    addPair(pairs, String(t.openedBy), String(t.ownerId));
    if (t.proId) {
      addPair(pairs, String(t.proId), String(t.ownerId));
      addPair(pairs, String(t.proId), String(t.openedBy));
    }
  });

  const appointments = await Appointment.find({}).select('tenantId ownerId proId').lean();
  appointments.forEach(a => {
    addPair(pairs, String(a.tenantId), String(a.ownerId));
    if (a.proId) addPair(pairs, String(a.tenantId), String(a.proId));
  });

  const offers = await ServiceOffer.find({}).select('ownerId proId').lean();
  offers.forEach(o => addPair(pairs, String(o.ownerId), String(o.proId)));

  const apps = await Application.find({}).select('tenantId propertyId').lean();
  const propIds = apps.map(a => a.propertyId).filter(Boolean);
  const props = propIds.length > 0 ? await Property.find({ _id: { $in: propIds } }).select('_id owner').lean() : [];
  const ownerByProp = new Map(props.map(p => [String(p._id), String(p.owner)]));
  apps.forEach(a => {
    const owner = ownerByProp.get(String(a.propertyId));
    if (owner) addPair(pairs, String(a.tenantId), owner);
  });

  let created = 0;
  for (const key of pairs) {
    const [a, b] = key.split(':');
    await ensureDirectConversation(a, b);
    created++;
  }

  console.log(`Direct conversations ensured: ${created}`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

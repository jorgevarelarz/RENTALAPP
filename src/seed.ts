import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './models/user.model';
import Ticket from './models/ticket.model';
import { Property } from './models/property.model';
import Lead from './models/lead.model';

async function main() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/rental-app';
  await mongoose.connect(mongoUrl);

  const password = 'password';
  let landlord = await User.findOne({ email: 'landlord@example.com' });
  if (!landlord) {
    const passwordHash = await bcrypt.hash(password, 10);
    landlord = await User.create({ name: 'Demo Landlord', email: 'landlord@example.com', passwordHash, role: 'landlord' });
  }
  let tenant = await User.findOne({ email: 'tenant@example.com' });
  if (!tenant) {
    const passwordHash = await bcrypt.hash(password, 10);
    tenant = await User.create({ name: 'Demo Tenant', email: 'tenant@example.com', passwordHash, role: 'tenant' });
  }
  let pro = await User.findOne({ email: 'pro@example.com' });
  if (!pro) {
    const passwordHash = await bcrypt.hash(password, 10);
    pro = await User.create({ name: 'Demo Pro', email: 'pro@example.com', passwordHash, role: 'pro' });
  }

  const baseProperty = {
    owner: landlord.id,
    description: 'Nice flat',
    address: 'Demo street 1',
    region: 'madrid',
    city: 'Madrid',
    location: { type: 'Point', coordinates: [-3.70379, 40.41678] },
    price: 500,
    deposit: 500,
    sizeM2: 70,
    rooms: 2,
    bathrooms: 1,
    furnished: false,
    petsAllowed: false,
    availableFrom: new Date(),
    images: ['https://example.com/p1.jpg', 'https://example.com/p2.jpg', 'https://example.com/p3.jpg'],
    status: 'active',
  };

  const p1 = await Property.create({ ...baseProperty, title: 'Demo Apartment' });
  const p2 = await Property.create({
    ...baseProperty,
    title: 'Second Property',
    address: 'Sample avenue 2',
    price: 800,
    deposit: 800,
    location: { type: 'Point', coordinates: [-3.69, 40.41] },
  });

  // Crea un ticket de demo asignado al pro
  const t = await Ticket.create({
    contractId: new mongoose.Types.ObjectId().toString(),
    propertyId: p1.id,
    openedBy: tenant.id,
    ownerId: landlord.id,
    proId: pro.id,
    service: 'plumbing',
    title: 'Goteo en baño',
    description: 'Latiguillo pierde agua',
    status: 'awaiting_schedule',
    history: [{ ts: new Date(), actor: String(tenant.id), action: 'opened' }],
  } as any);

  console.log('Seed completed');
  console.log(`Landlord -> landlord@example.com / ${password}`);
  console.log(`Tenant   -> tenant@example.com / ${password}`);
  console.log(`Pro      -> pro@example.com / ${password}`);
  console.log(`Properties created: ${p1.id}, ${p2.id}`);
  console.log(`Ticket created: ${t.id}`);

  await Lead.findOneAndUpdate(
    { externalLeadId: 'demo-owner-lead' },
    {
      externalLeadId: 'demo-owner-lead',
      source: 'seed',
      leadType: 'OWNER',
      leadStatus: 'PARTIALLY_QUALIFIED',
      conversationStage: 'PROPERTY_MEDIA_PENDING',
      qualificationScore: 72,
      nextBestAction: 'Solicitar fotos y documentación antes del seguimiento comercial.',
      suggestedQuestions: ['¿Tienes fotos disponibles?'],
      lastInboundMessage: 'Quiero vender mi piso en Salamanca por 450000 euros, tiene 95 m2 y 3 habitaciones.',
      lastReplyMessage: 'Gracias. Necesitamos fotos y documentación para continuar.',
      extractedData: {
        operation: 'sale',
        zone: 'Salamanca',
        targetPrice: 450000,
        squareMeters: 95,
        bedrooms: 3,
        hasPhotos: false,
        hasDocumentation: false,
      },
      messageCount: 1,
    },
    { upsert: true, new: true },
  );

  await Lead.findOneAndUpdate(
    { externalLeadId: 'demo-buyer-lead' },
    {
      externalLeadId: 'demo-buyer-lead',
      source: 'seed',
      leadType: 'BUYER',
      leadStatus: 'QUALIFIED',
      conversationStage: 'READY_FOR_FOLLOWUP',
      qualificationScore: 85,
      nextBestAction: 'Programar seguimiento con inmuebles recomendados.',
      suggestedQuestions: [],
      lastInboundMessage: 'Busco comprar en Retiro, presupuesto 700000 euros, 3 habitaciones y necesito hipoteca.',
      lastReplyMessage: 'Perfecto, ya tenemos base suficiente para preparar el seguimiento.',
      extractedData: {
        zone: 'Retiro',
        budgetMax: 700000,
        bedrooms: 3,
        financingNeeded: true,
      },
      messageCount: 1,
    },
    { upsert: true, new: true },
  );

  console.log('Demo leads created: demo-owner-lead, demo-buyer-lead');
  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

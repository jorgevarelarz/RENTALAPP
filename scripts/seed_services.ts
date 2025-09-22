import mongoose from 'mongoose';
import { Service } from '../src/models/Service';

async function main() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/rental-app';
  await mongoose.connect(mongoUrl);
  const items = [
    { name: 'Iberdrola', type: 'energy', logo: 'https://logo.clearbit.com/iberdrola.com', url: 'https://iberdrola.com/alta', description: 'Da de alta la luz en minutos', priority: 1, active: true },
    { name: 'Movistar', type: 'internet', logo: 'https://logo.clearbit.com/movistar.es', url: 'https://www.movistar.es/contratar', description: 'Fibra y móvil para tu hogar', priority: 2, active: true },
    { name: 'Mapfre', type: 'insurance', logo: 'https://logo.clearbit.com/mapfre.es', url: 'https://www.mapfre.es/seguros-hogar/', description: 'Seguro de hogar con cobertura total', priority: 3, active: true },
    { name: 'LimpiezaPro', type: 'pro', logo: 'https://via.placeholder.com/80x40?text=Limpieza', url: 'https://limpiezapro.example.com/alta', description: 'Servicio de limpieza profesional', priority: 4, active: true },
  ];
  for (const it of items) {
    await Service.updateOne({ name: it.name }, { $set: it }, { upsert: true });
  }
  console.log('Seeded services:', items.length);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });


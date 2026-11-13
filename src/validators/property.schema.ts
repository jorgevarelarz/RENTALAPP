import { z } from 'zod';
import { isOwnUploadUrl } from '../utils/uploadUrl';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

// Foto del anuncio: URL http(s) o una subida propia («/uploads/<nombre>»), que es
// lo que devuelve /api/uploads/images cuando falta APP_URL. Ni javascript: ni data:.
const imageUrl = z
  .string()
  .max(500)
  .refine(v => /^https?:\/\/[^\s]+$/i.test(v) || isOwnUploadUrl(v), 'invalid_image_url');

export const propertyCreateSchema = z.object({
  owner: objectId,
  title: z.string().min(5).max(120),
  description: z.string().max(8000).optional(),
  address: z.string().min(5),
  region: z.string().min(2).toLowerCase(),
  city: z.string().min(2),
  location: z.object({ lng: z.number(), lat: z.number() }),
  price: z.number().min(0),
  deposit: z.number().min(0),
  sizeM2: z.number().min(1),
  rooms: z.number().min(0),
  bathrooms: z.number().min(0),
  furnished: z.boolean(),
  petsAllowed: z.boolean(),
  condition: z.enum(['obra_nueva', 'reformado', 'buen_estado', 'a_reformar']).optional(),
  floor: z.number().min(0).max(60).optional(),
  hasElevator: z.boolean().optional(),
  yearBuilt: z.number().min(1800).max(new Date().getFullYear() + 2).optional(),
  availableFrom: z.string().transform(s => new Date(s)),
  availableTo: z.string().transform(s => new Date(s)).optional(),
  images: z.array(imageUrl).max(20).optional(),
  onlyTenantPro: z.boolean().optional(),
  requiredTenantProMaxRent: z.number().min(0).optional(),
});

export const propertyUpdateSchema = propertyCreateSchema.partial();

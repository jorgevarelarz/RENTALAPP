import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);

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
  availableFrom: z.string().transform(s => new Date(s)),
  availableTo: z.string().transform(s => new Date(s)).optional(),
  images: z.array(z.string().url()).max(20).optional(),
});

export const propertyUpdateSchema = propertyCreateSchema.partial();

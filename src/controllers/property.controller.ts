import { Request, Response } from 'express';
import { Property } from '../models/property.model';

/**
 * Create a new property listing.
 * Requires authentication – the user ID is taken from the request.user object.
 */
export const createProperty = async (req: Request, res: Response) => {
  const { title, description, price, address, photos } = req.body;
  // The authenticate middleware attaches the decoded token to req.user
  const ownerId = (req as any).user.id;
  try {
    const property = new Property({ title, description, price, address, photos, ownerId });
    await property.save();
    res.status(201).json(property);
  } catch {
    res.status(400).json({ error: 'Error al crear propiedad' });
  }
};

/**
 * Retrieve all properties, populating the owner name and email.
 */
export const getAllProperties = async (_req: Request, res: Response) => {
  const properties = await Property.find().populate('ownerId', 'name email');
  res.json(properties);
};
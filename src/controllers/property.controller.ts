import { Request, Response } from 'express';
import { Property } from '../models/property.model';

/**
 * Create a new property listing.
 * Requires authentication – the user ID is taken from the request.user object.
 */
export const createProperty = async (req: Request, res: Response) => {
  const { title, description, price, address, photos } = req.body;
  const ownerId = (req as any).user.id;
  try {
    const property = new Property({ title, description, price, address, photos, ownerId, status: 'published' });
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
  const properties = await Property.find({ status: 'published' }).lean();
  res.json(properties);
};

export const getPropertyById = async (req: Request, res: Response) => {
  const property = await Property.findOne({ _id: req.params.id, status: 'published' }).lean();
  if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });
  res.json(property);
};

/**
 * Update a property (owner only). Allows updating title, description, price, address, photos.
 */
export const updateProperty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    const user = (req as any).user;
    const prop: any = await Property.findById(id);
    if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (String(prop.ownerId) !== String(user.id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const { title, description, price, address, photos, status } = req.body || {};
    if (title !== undefined) prop.title = title;
    if (description !== undefined) prop.description = description;
    if (price !== undefined) prop.price = price;
    if (address !== undefined) prop.address = address;
    if (photos !== undefined) prop.photos = photos;
    if (status !== undefined) prop.status = status;
    await prop.save();
    res.json(prop);
  } catch (e: any) {
    res.status(400).json({ error: 'Error al actualizar propiedad', details: e.message });
  }
};

/**
 * Delete a property (owner only).
 */
export const deleteProperty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    const user = (req as any).user;
    const prop: any = await Property.findById(id);
    if (!prop) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (String(prop.ownerId) !== String(user.id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    await Property.deleteOne({ _id: id });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: 'Error al eliminar propiedad', details: e.message });
  }
};

import { Request, Response } from 'express';
import { Coliving } from '../models/coliving.model';

/**
 * Create a new coliving space listing.
 * Requires authentication – the user ID is taken from the request.user object.
 */
export const createColiving = async (req: Request, res: Response) => {
  const { 
    title, 
    description, 
    address, 
    photos, 
    roomType, 
    amenities, 
    monthlyRent, 
    deposit, 
    houseRules 
  } = req.body;
  
  const ownerId = (req as any).user.id;

  try {
    const coliving = new Coliving({
      title,
      description,
      address,
      photos,
      ownerId,
      roomType,
      amenities,
      monthlyRent,
      deposit,
      houseRules,
      status: 'published'
    });
    await coliving.save();
    res.status(201).json(coliving);
  } catch (error) {
    res.status(400).json({ error: 'Error al crear el espacio de coliving' });
  }
};

/**
 * Retrieve all coliving spaces.
 */
export const getAllColivings = async (_req: Request, res: Response) => {
  const colivings = await Coliving.find({ status: 'published' }).lean();
  res.json(colivings);
};

/**
 * Retrieve a single coliving space by its ID.
 */
export const getColivingById = async (req: Request, res: Response) => {
  const coliving = await Coliving.findOne({ _id: req.params.id, status: 'published' }).lean();
  if (!coliving) return res.status(404).json({ error: 'Espacio de coliving no encontrado' });
  res.json(coliving);
};

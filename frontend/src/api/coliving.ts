import { api as client } from '../api/client';

/**
 * Fetches all coliving spaces from the backend.
 */
export const listColivings = async () => {
  const res = await client.get('/api/coliving');
  return res.data;
};

/**
 * Fetches a single coliving space by its ID.
 */
export const getColiving = async (id: string) => {
  const res = await client.get(`/api/coliving/${id}`);
  return res.data;
};

/**
 * Creates a new coliving space.
 * @param data The data for the new coliving space.
 */
export const createColiving = async (data: any) => {
  // The API client likely handles the token automatically, so we don't need to pass it here.
  // This is an assumption based on the structure of other services.
  const res = await client.post('/api/coliving', data);
  return res.data;
};

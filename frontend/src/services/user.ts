import { api as axios } from '../api/client';

export const userService = {
  getLandlordStats: async () => {
    const res = await axios.get('/api/users/me/stats', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    return res.data as any;
  },
};

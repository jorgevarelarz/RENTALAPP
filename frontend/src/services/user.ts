import { api as axios } from '../api/client';

export interface UserProfile {
  id: string;
  _id?: string;
  email: string;
  name: string;
  role: 'tenant' | 'landlord' | 'admin' | 'pro';
  phone?: string;
  avatar?: string;
  bio?: string;
  ratingAvg?: number;
  reviewCount?: number;
  jobTitle?: string;
  monthlyIncome?: number;
  companyName?: string;
  serviceCategory?: string;
  createdAt?: string;
}

export const userService = {
  getProfile: async () => {
    const res = await axios.get<UserProfile>('/api/users/me');
    const data: any = res.data;
    return { ...data, id: data.id ?? data._id } as UserProfile;
  },
  updateProfile: async (data: Partial<UserProfile>) => {
    const res = await axios.put<UserProfile>('/api/users/me', data);
    const body: any = res.data;
    return { ...body, id: body.id ?? body._id } as UserProfile;
  },
  uploadAvatar: async (formData: FormData) => {
    const res = await axios.post('/api/uploads/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const url = res.data?.urls?.[0];
    return { url };
  },
  getLandlordStats: async () => {
    const res = await axios.get('/api/users/me/stats', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    return res.data as any;
  },
};

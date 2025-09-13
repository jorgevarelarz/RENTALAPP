import axios from 'axios';

const API_BASE =
  process.env.REACT_APP_API_URL || process.env.VITE_API_URL || 'http://localhost:3000';

export const login = async (email: string, password: string) => {
  const response = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
  return response.data.token;
};

export const register = async (
  name: string,
  email: string,
  password: string,
  role: 'tenant' | 'landlord' | 'pro',
) => {
  await axios.post(`${API_BASE}/api/auth/register`, { name, email, password, role });
};

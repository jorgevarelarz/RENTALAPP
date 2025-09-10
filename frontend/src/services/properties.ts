import axios from 'axios';

const API_URL =
  process.env.VITE_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:4000';

export const createProperty = async (token: string, data: any) => {
  const res = await axios.post(`${API_URL}/api/properties`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const listProperties = async () => {
  const res = await axios.get(`${API_URL}/api/properties`);
  return res.data;
};

export const getProperty = async (id: string) => {
  const res = await axios.get(`${API_URL}/api/properties/${id}`);
  return res.data;
};

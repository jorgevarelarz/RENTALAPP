import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export const createProperty = async (token: string, data: any) => {
  const res = await axios.post(`${API_URL}/properties`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const listProperties = async () => {
  const res = await axios.get(`${API_URL}/properties`);
  return res.data;
};

export const getProperty = async (id: string) => {
  const res = await axios.get(`${API_URL}/properties/${id}`);
  return res.data;
};

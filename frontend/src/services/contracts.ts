import axios from 'axios';

const API_URL =
  process.env.VITE_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:4000';

export const downloadDemoContract = async (token: string, payload: any) => {
  const res = await axios.post(`${API_URL}/api/contracts/demo`, payload, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });
  return res.data;
};

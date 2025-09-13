import axios from 'axios';

const API_BASE =
  process.env.REACT_APP_API_URL || process.env.VITE_API_URL || 'http://localhost:3000';

export const downloadDemoContract = async (token: string, payload: any) => {
  const res = await axios.post(`${API_BASE}/api/contracts/demo`, payload, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });
  return res.data as Blob;
};

export const listContracts = async (token: string, userId: string) => {
  const res = await axios.get(`${API_BASE}/api/contracts`, {
    headers: { Authorization: `Bearer ${token}`, 'x-user-id': userId },
  });
  return res.data as { items: any[] };
};

export const getContract = async (token: string, userId: string, id: string) => {
  const res = await axios.get(`${API_BASE}/api/contracts/${id}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-user-id': userId },
  });
  return res.data as any;
};

export const signContract = async (token: string, userId: string, id: string) => {
  const res = await axios.patch(`${API_BASE}/api/contracts/${id}/sign`, {}, {
    headers: { Authorization: `Bearer ${token}`, 'x-user-id': userId },
  });
  return res.data as any;
};

export const payDeposit = async (token: string, userId: string, id: string, destination: 'escrow'|'authority'='escrow') => {
  const res = await axios.post(`${API_BASE}/api/contracts/${id}/deposit`, { destination }, {
    headers: { Authorization: `Bearer ${token}`, 'x-user-id': userId },
  });
  return res.data as any;
};

export const downloadPdf = async (token: string, userId: string, id: string) => {
  const res = await axios.get(`${API_BASE}/api/contracts/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}`, 'x-user-id': userId },
    responseType: 'blob',
  });
  return res.data as Blob;
};

import axios from 'axios';

const API_BASE =
  process.env.REACT_APP_API_URL || process.env.VITE_API_URL || 'http://localhost:3000';

export const getMyVerification = async (userId: string) => {
  const res = await axios.get(`${API_BASE}/api/verification/me`, {
    headers: { 'x-user-id': userId },
  });
  return res.data as { status: string };
};

export const devVerifyMe = async (userId: string) => {
  const res = await axios.post(
    `${API_BASE}/api/verification/dev/verify`,
    {},
    { headers: { 'x-user-id': userId } }
  );
  return res.data;
};


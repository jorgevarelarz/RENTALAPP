import axios from 'axios';

const API_BASE =
  process.env.REACT_APP_API_URL || process.env.VITE_API_URL || 'http://localhost:3000';

export const createPaymentIntent = async (token: string, amountEUR: number) => {
  const res = await axios.post(
    `${API_BASE}/api/payments/intent`,
    { amountEUR },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data.clientSecret as string;
};

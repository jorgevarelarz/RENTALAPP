import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export const createPaymentIntent = async (token: string, amountEUR: number) => {
  const res = await axios.post(
    `${API_URL}/payments/intent`,
    { amountEUR },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data.clientSecret as string;
};

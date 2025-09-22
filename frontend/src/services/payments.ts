import { api as axios } from '../api/client';

export const createPaymentIntent = async (token: string, amountEUR: number) => {
  const res = await axios.post(
    `/api/payments/intent`,
    { amountEUR },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data.clientSecret as string;
};

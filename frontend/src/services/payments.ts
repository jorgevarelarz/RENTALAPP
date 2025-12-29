import { api as axios } from '../api/client';

export const createPaymentIntent = async (token: string, amountEUR: number) => {
  const res = await axios.post(
    `/api/payments/intent`,
    { amountEUR },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data.clientSecret as string;
};

export const getPayments = async (token: string) => {
  const res = await axios.get(`/api/payments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as any[];
};

export const payReceipt = async (token: string, id: string) => {
  const res = await axios.post(
    `/api/payments/${id}/pay`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data as { clientSecret?: string; amount?: number; currency?: string };
};

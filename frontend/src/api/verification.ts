import { api as axios } from '../api/client';

export const getMyVerification = async (userId: string) => {
  const res = await axios.get(`/api/verification/me`, {
    headers: { 'x-user-id': userId },
  });
  return res.data as { status: string };
};

export const devVerifyMe = async (userId: string) => {
  const res = await axios.post(
    `/api/verification/dev/verify`,
    {},
    { headers: { 'x-user-id': userId } }
  );
  return res.data;
};

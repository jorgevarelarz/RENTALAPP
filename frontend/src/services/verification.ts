import { api } from "../api/client";

export type VerificationStatusResponse = {
  status: string;
  verificationProvider?: string;
  verifiedAt?: string;
};

export async function getMyVerification(userId: string): Promise<VerificationStatusResponse> {
  const { data } = await api.get(`/api/verification/me`, { params: { userId } });
  return data;
}

export async function devVerifyMe(userId: string): Promise<void> {
  await api.post(`/api/verification/dev-verify`, { userId });
}

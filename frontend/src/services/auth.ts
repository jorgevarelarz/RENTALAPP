import { api as axios } from "../api/client";

export type User = {
  _id: string;
  email: string;
  role: "tenant" | "landlord" | "pro" | "admin";
  isVerified?: boolean;
  tenantPro?: {
    status?: string;
    maxRent?: number;
    consentAccepted?: boolean;
  };
  token: string;
};

export async function login(email: string, password: string): Promise<User> {
  const { data } = await axios.post("/api/auth/login", { email, password });
  const user: User = { ...data.user, token: data.token };
  localStorage.setItem("user", JSON.stringify(user));
  axios.defaults.headers.common["Authorization"] = `Bearer ${user.token}`;
  return user;
}

export async function register(
  name: string,
  email: string,
  password: string,
  role: "tenant" | "landlord" | "pro"
) {
  await axios.post("/api/auth/register", { name, email, password, role });
}

export function logout() {
  localStorage.removeItem("user");
  delete axios.defaults.headers.common["Authorization"];
}

export function getStoredUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export function bootstrapAuthHeader() {
  const u = getStoredUser();
  if (u?.token) axios.defaults.headers.common["Authorization"] = `Bearer ${u.token}`;
}

export async function requestPasswordReset(email: string) {
  await axios.post(`/api/auth/request-reset`, { email });
}

export async function resetPassword(token: string, password: string) {
  await axios.post(`/api/auth/reset`, { token, password });
}

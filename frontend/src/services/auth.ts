import { api as axios } from "../api/client";

// Mensaje del backend (auth.controller.ts) para cualquier fallo de credenciales.
export const INVALID_CREDENTIALS_MESSAGE = "Usuario o contraseña incorrectos";

// Igual que el backend (auth.routes.ts): mínimo 8 caracteres en registro y restablecimiento.
export const PASSWORD_MIN_LENGTH = 8;

export function passwordPolicyError(password: string): string | null {
  return password.length < PASSWORD_MIN_LENGTH
    ? `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`
    : null;
}

export type User = {
  _id: string;
  email: string;
  role: "tenant" | "landlord" | "pro" | "admin" | "agency";
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

export async function exchangeOAuthCode(code: string): Promise<{ user: User; redirect: string }> {
  const { data } = await axios.post('/api/auth/oauth/exchange', { code });
  const user: User = { ...data.user, token: data.token };
  setStoredUser(user);
  return { user, redirect: data.redirect || '/' };
}

export function logout() {
  localStorage.removeItem("user");
  delete axios.defaults.headers.common["Authorization"];
}

export function setStoredUser(user: User) {
  localStorage.setItem("user", JSON.stringify(user));
  axios.defaults.headers.common["Authorization"] = `Bearer ${user.token}`;
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

import { api as axios } from "../api/client";

export type TicketRole = "tenant" | "landlord" | "pro";

export async function createTicket(payload: Record<string, unknown>) {
  const { data } = await axios.post("/api/tickets", payload);
  return data;
}

/** Sube las fotos de una avería (sin EXIF, nombre aleatorio) y devuelve sus URLs de /uploads. */
export async function uploadTicketPhotos(files: File[]): Promise<string[]> {
  const form = new FormData();
  files.forEach(file => form.append("files", file));
  const { data } = await axios.post("/api/uploads/images", form);
  return data?.urls || [];
}

export async function getTicket(id: string) {
  const { data } = await axios.get(`/api/tickets/${id}`);
  return data;
}

export async function listMyTickets(role: TicketRole, params: Record<string, unknown> = {}) {
  const path =
    role === "tenant"
      ? "/api/tickets/my/tenant"
      : role === "landlord"
        ? "/api/tickets/my/owner"
        : "/api/tickets/my/pro";
  const { data } = await axios.get(path, { params });
  return data as { items: any[]; page: number; total: number };
}

export async function assignPro(id: string, proId: string) {
  const { data } = await axios.post(`/api/tickets/${id}/assign`, { proId });
  return data;
}

export async function unassignPro(id: string) {
  const { data } = await axios.post(`/api/tickets/${id}/unassign`);
  return data;
}

export async function sendQuote(id: string, amount: number, note?: string) {
  const { data } = await axios.post(`/api/tickets/${id}/quote`, { amount, note });
  return data;
}

export async function approveQuote(id: string) {
  const { data } = await axios.post(`/api/tickets/${id}/approve`);
  return data;
}

export async function requestExtra(id: string, amount: number, reason: string) {
  const { data } = await axios.post(`/api/tickets/${id}/extra`, { amount, reason });
  return data;
}

export async function decideExtra(id: string, decision: "approved" | "rejected") {
  const { data } = await axios.post(`/api/tickets/${id}/extra/decide`, { approve: decision === "approved" });
  return data;
}

export async function completeWork(id: string, invoiceUrl?: string) {
  const { data } = await axios.post(`/api/tickets/${id}/complete`, { invoiceUrl });
  return data;
}

/** El propietario valida el trabajo terminado y libera el pago al profesional. */
export async function validateTicket(id: string) {
  const { data } = await axios.post(`/api/tickets/${id}/validate`);
  return data;
}

/** El inquilino confirma que la avería está arreglada (también libera el pago). */
export async function resolveTicket(id: string) {
  const { data } = await axios.post(`/api/tickets/${id}/resolve`);
  return data;
}

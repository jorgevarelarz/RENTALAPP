import { api as axios } from "../api/client";

export type TicketRole = "tenant" | "landlord" | "pro";

export async function createTicket(payload: Record<string, unknown>) {
  const { data } = await axios.post("/api/tickets", payload);
  return data;
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
  const { data } = await axios.post(`/api/tickets/${id}/extra/decide`, { decision });
  return data;
}

export async function completeWork(id: string, invoiceUrl?: string) {
  const { data } = await axios.post(`/api/tickets/${id}/complete`, { invoiceUrl });
  return data;
}

export async function closeTicket(id: string) {
  const { data } = await axios.post(`/api/tickets/${id}/close`);
  return data;
}

export async function openDispute(id: string, reason: string) {
  const { data } = await axios.post(`/api/tickets/${id}/dispute`, { reason });
  return data;
}

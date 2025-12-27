import { api as axios } from "../api/client";

// Ticket appointments (pro/tenant)
export async function proposeAppointment(ticketId: string, whenIso: string) {
  const start = new Date(whenIso);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const payload = { start: start.toISOString(), end: end.toISOString(), timezone };
  const { data } = await axios.post(`/api/appointments/${ticketId}/propose`, payload);
  return data;
}

export async function acceptAppointment(ticketId: string) {
  const { data } = await axios.post(`/api/appointments/${ticketId}/accept`);
  return data;
}

export async function rejectAppointment(ticketId: string, reason?: string) {
  const { data } = await axios.post(`/api/appointments/${ticketId}/reject`, { reason });
  return data;
}

// Property applications
export async function proposeApplicationVisit(applicationId: string, whenIso: string) {
  const { data } = await axios.post(`/api/applications/${applicationId}/propose`, { visitDate: whenIso });
  return data;
}

export async function acceptApplicationVisit(applicationId: string) {
  const { data } = await axios.post(`/api/applications/${applicationId}/accept`);
  return data;
}

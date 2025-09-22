import { api as axios } from "../api/client";

// Backend expects: POST /api/appointments/:ticketId/propose with { start, end, timezone }
export async function proposeAppointment(ticketId: string, whenIso: string) {
  const start = new Date(whenIso);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // default to 1h slot
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const payload = { start: start.toISOString(), end: end.toISOString(), timezone };
  const { data } = await axios.post(`/api/appointments/${ticketId}/propose`, payload);
  return data;
}

// Accept/reject are keyed by ticketId per backend
export async function acceptAppointment(ticketId: string) {
  const { data } = await axios.post(`/api/appointments/${ticketId}/accept`);
  return data;
}

export async function rejectAppointment(ticketId: string, reason?: string) {
  const { data } = await axios.post(`/api/appointments/${ticketId}/reject`, { reason });
  return data;
}

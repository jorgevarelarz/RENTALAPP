import axios from "axios";

export async function proposeAppointment(ticketId: string, whenIso: string) {
  const { data } = await axios.post(`/api/appointments/${ticketId}/propose`, { when: whenIso });
  return data;
}

export async function confirmAppointment(appointmentId: string) {
  const { data } = await axios.post(`/api/appointments/${appointmentId}/confirm`);
  return data;
}

export async function rejectAppointment(appointmentId: string, reason?: string) {
  const { data } = await axios.post(`/api/appointments/${appointmentId}/reject`, { reason });
  return data;
}

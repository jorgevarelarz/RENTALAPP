import axios from "axios";

export async function sendEmail(to: string, subject: string, body: string) {
  return axios.post("/api/notify/email", { to, subject, body });
}

export async function sendSms(to: string, body: string) {
  return axios.post("/api/notify/sms", { to, body });
}

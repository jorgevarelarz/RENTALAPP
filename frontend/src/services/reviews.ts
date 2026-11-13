import { api as axios } from "../api/client";

export type ProReview = { id: string; score: number; comment?: string; createdAt: string; author: string };

/** Valorar al profesional de una incidencia cerrada (la incidencia es la relación que da derecho a opinar). */
export async function reviewTicketPro(ticketId: string, proUserId: string, score: number, comment: string) {
  const { data } = await axios.post("/api/reviews", {
    toUserId: proUserId,
    roleContext: "pro",
    relatedId: ticketId,
    score,
    comment: comment.trim() || undefined,
  });
  return data;
}

export async function getProReviews(proProfileId: string, page = 1, limit = 5) {
  const { data } = await axios.get(`/api/pros/${proProfileId}/reviews`, { params: { page, limit } });
  return data as { items: ProReview[]; total: number; page: number; limit: number };
}

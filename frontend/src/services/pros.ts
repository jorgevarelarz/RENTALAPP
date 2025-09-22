import { api as axios } from "../api/client";

export async function searchPros(city?: string, service?: string) {
  const { data } = await axios.get("/api/pros", { params: { city, service } });
  return data as { items: any[] };
}

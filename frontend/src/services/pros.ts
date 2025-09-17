import axios from "axios";

export async function searchPros(city?: string, service?: string) {
  const { data } = await axios.get("/api/pros", { params: { city, service } });
  return data as { items: any[] };
}
